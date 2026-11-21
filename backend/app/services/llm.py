"""Claude API wrappers: advisor rewrite, grounded chat, plant scanner, lab-report extraction.

Principle (course doc, section 3): calculation before writing. Every number sent to the model comes
from the deterministic engine, and the model is instructed to use only those numbers.
Everything here degrades gracefully when ANTHROPIC_API_KEY is missing or the call fails.
"""
import base64
import json

from flask import current_app

LANG_NAMES = {"en": "English", "fr": "French", "ar": "Arabic (simple wording, understandable to Tunisian farmers)", "ja": "Japanese (polite, plain wording)"}
RELAY = {"TN": "a CRDA adviser or an agricultural technician", "JP": "the local JA (agricultural cooperative) or the prefectural agricultural extension center"}


def available():
    return bool(current_app.config["ANTHROPIC_API_KEY"])


def _client():
    import anthropic
    return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])


def _text(resp):
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()


def parse_json(text):
    """Extract the first balanced JSON object or array from a model reply."""
    for open_c, close_c in (("{", "}"), ("[", "]")):
        s = text.find(open_c)
        if s < 0:
            continue
        depth = 0
        for i in range(s, len(text)):
            depth += text[i] == open_c
            depth -= text[i] == close_c
            if depth == 0:
                try:
                    return json.loads(text[s:i + 1])
                except ValueError:
                    break
    return None


def grounding(a):
    """The only data the model may quote: computed indicators of one plot."""
    f, e, s, w = a["fertilizer"], a["energy"], a["salinity"], a["water"]["summary"]
    return {
        "plot": {"name": a["plot"]["name"], "crop": a["crop"]["name"]["en"], "area_ha": a["plot"]["area_ha"], "date": a["today"]},
        "water": w, "salinity": {k: s[k] for k in ("ecw", "ece_est", "threshold_ece", "yield_rel", "verdict", "lr", "alternatives")},
        "fertilizer": {"dose_kg_n_ha": f["dose"], "horizon_days": f["horizon_days"],
                       "current_practice": f["sim_current"]["summary"], "recommended_practice": f["sim_recommended"]["summary"], "savings": f["savings"]},
        "energy": None if not e else {k: e[k] for k in ("total_kwh_m3", "annual_kwh", "annual_cost", "treated_fraction", "payback_months_p50", "brine_m3", "pv_kw", "currency")},
        "risks": a["risks"], "warnings": a["warnings"], "nitrate_limit_mg_l": a["nitrate_limit"], "weather_source": a["weather"]["source"],
    }


def _system(region, lang, extra=""):
    return (f"You are an agricultural advisor for farmers in {'Tunisia' if region == 'TN' else 'Japan'}. Reply in {LANG_NAMES.get(lang, 'English')}, in short sentences with simple words. "
            "You receive computed indicators as JSON. NEVER invent a number: quote only numbers present in the JSON, with units. "
            "Say clearly when a value is an estimate, a model output or missing. Do not prescribe pesticide doses or products; do not promise yields. "
            f"For high-stakes decisions refer to {RELAY[region]}. Start with the action, then the reason. {extra}")


def rewrite_advice(region, lang, a):
    """Ask the model to phrase the engine's advice items. Returns {code: text} or None."""
    if not available():
        return None
    try:
        prompt = ("Indicators:\n" + json.dumps(grounding(a), ensure_ascii=False) + "\n\nAdvice items selected by the rules engine:\n" + json.dumps(a["advice"], ensure_ascii=False) +
                  "\n\nFor each item write ONE or two sentences: the action, then the quantified reason using only numbers from the data or the item params. "
                  'Reply ONLY with a JSON array like [{"code": "...", "text": "..."}] in the same order.')
        r = _client().messages.create(model=current_app.config["ANTHROPIC_MODEL"], max_tokens=900, system=_system(region, lang), messages=[{"role": "user", "content": prompt}])
        arr = parse_json(_text(r))
        return {x["code"]: x["text"] for x in arr} if isinstance(arr, list) else None
    except Exception as exc:
        current_app.logger.warning("advice rewrite failed: %s", exc)
        return None


def chat(region, lang, a, question, history=None):
    """Grounded Q and A. Returns the answer text, or None if the model is unavailable."""
    if not available():
        return None
    try:
        msgs = [{"role": h["role"], "content": h["content"]} for h in (history or [])[-6:] if h.get("role") in ("user", "assistant")]
        msgs.append({"role": "user", "content": "Indicators (JSON):\n" + json.dumps(grounding(a), ensure_ascii=False) + "\n\nQuestion: " + question})
        r = _client().messages.create(model=current_app.config["ANTHROPIC_MODEL"], max_tokens=700,
                                      system=_system(region, lang, "Answer in at most 120 words with one clear next action. If the question needs data that is not in the JSON, say what is missing and ask for it."),
                                      messages=msgs)
        return _text(r)
    except Exception as exc:
        current_app.logger.warning("chat failed: %s", exc)
        return None


def _media_block(image_bytes, mime):
    data = base64.standard_b64encode(image_bytes).decode()
    if mime == "application/pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": mime, "data": data}}
    return {"type": "image", "source": {"type": "base64", "media_type": mime, "data": data}}


SCAN_SCHEMA = ('{"culture_detectee": "string", "qualite_image": "bonne|moyenne|mauvaise", "hypotheses": [{"nom": "string", "type": "fongique|bacterienne|virale|carence|ravageur|stress|salinite", '
               '"confiance": 0.0, "signes_observes": ["string"], "a_verifier": ["string"]}], "gravite": "faible|moyenne|elevee", "actions_prudentes": ["string"], "consulter_expert": true}')


def scan_image(region, lang, image_bytes, mime, crop_name, context):
    """Plant scanner (course section 5). Returns the parsed JSON dict or raises."""
    system = (f"You analyse plant photos for farmers in {'Tunisia' if region == 'TN' else 'Japan'}. You help diagnose, you never give a definitive diagnosis. Output language of the text fields: {LANG_NAMES.get(lang, 'English')}. "
              "List at most 3 hypotheses ranked by probability, cap each confidence at 0.85, and consider salinity burn and nutrient deficiency as well as disease and pests. "
              "If a viral disease or a regulated organism is suspected, advise isolating the plants and contacting the regional agricultural service. "
              "Do not give pesticide products or doses: suggest cultural practices, biological control families, or consultation. If the image is not a plant, return hypotheses: [] and consulter_expert: false. "
              f"Reply ONLY with JSON following this schema: {SCAN_SCHEMA}")
    user = [_media_block(image_bytes, mime), {"type": "text", "text": f"Crop declared by the farmer: {crop_name or 'unknown'}. Context: {json.dumps(context, ensure_ascii=False)}"}]
    r = _client().messages.create(model=current_app.config["ANTHROPIC_MODEL"], max_tokens=1200, system=system, messages=[{"role": "user", "content": user}])
    out = parse_json(_text(r))
    if not isinstance(out, dict):
        raise ValueError("model reply was not valid JSON")
    for h in out.get("hypotheses", []):
        h["confiance"] = min(float(h.get("confiance", 0)), 0.85)
    return out


LAB_SCHEMA = ('{"type": "soil|water", "date": "YYYY-MM-DD or null", "lab": "string or null", "values": {"ph": {"v": null, "conf": 0.0}, "ec": {"v": null, "unit": "dS/m", "conf": 0.0}, '
              '"n_ppm": {"v": null, "conf": 0.0}, "p_ppm": {"v": null, "conf": 0.0}, "k_ppm": {"v": null, "conf": 0.0}, "om": {"v": null, "unit": "%", "conf": 0.0}}, "unreadable_fields": ["string"]}')


def extract_lab(image_bytes, mime):
    system = ("You extract values from a soil or irrigation-water laboratory report (French, Arabic, Japanese or English). Extract ONLY values that are printed in the document, never infer or estimate. "
              "Convert EC to dS/m (1 mS/cm = 1 dS/m, 1 uS/cm = 0.001 dS/m, 1 mS/m = 0.01 dS/m). Convert nitrogen to mg/kg (ppm) of mineral N when the unit allows it, else leave null. Organic matter in %. "
              "Give a confidence between 0 and 1 for each value and list fields that are unreadable. Reply ONLY with JSON following this schema: " + LAB_SCHEMA)
    r = _client().messages.create(model=current_app.config["ANTHROPIC_MODEL"], max_tokens=900, system=system,
                                  messages=[{"role": "user", "content": [_media_block(image_bytes, mime), {"type": "text", "text": "Extract the values."}]}])
    out = parse_json(_text(r))
    if not isinstance(out, dict):
        raise ValueError("model reply was not valid JSON")
    return out
