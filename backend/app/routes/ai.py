import json

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import Scan
from ..services import analysis, data, llm, scanner
from .plots import own_plot

bp = Blueprint("ai", __name__, url_prefix="/api/ai")
ALLOWED = {"image/jpeg", "image/png", "image/webp"}


def _lang(b):
    reg = data.region(g.user.region)
    return b.get("lang") if b.get("lang") in ("en", "fr", "ar", "ja") else reg["default_lang"]


@bp.get("/status")
@login_required
def status():
    return jsonify(llm=llm.available(), gemini=llm.gemini_available(), offline=current_app.config["OFFLINE_MODE"])


@bp.post("/advice")
@login_required
def advice():
    b = request.get_json(silent=True) or {}
    p = own_plot(int(b.get("plot_id", 0) or 0))
    if not p:
        return jsonify(error="not_found"), 404
    a = analysis.analyze(p, g.user, light=True)
    texts = llm.rewrite_advice(g.user.region, _lang(b), a)
    items = [dict(x, text=(texts or {}).get(x["code"])) for x in a["advice"]]
    return jsonify(advice=items, llm=texts is not None)


@bp.post("/chat")
@login_required
def chat():
    b = request.get_json(silent=True) or {}
    p = own_plot(int(b.get("plot_id", 0) or 0))
    q = (b.get("message") or "").strip()
    if not p or not q:
        return jsonify(error="invalid_input"), 400
    a = analysis.analyze(p, g.user, light=True)
    reply, model_used = llm.chat(g.user.region, _lang(b), a, q[:1000], b.get("history"))
    return jsonify(reply=reply, llm=model_used, advice=a["advice"])


@bp.post("/scan")
@login_required
def scan():
    f = request.files.get("file")
    if not f or f.mimetype not in ALLOWED:
        return jsonify(error="invalid_file"), 400
    try:
        clean, quality = scanner.prepare(f.read())
    except Exception:
        return jsonify(error="invalid_image"), 400
    if not quality["ok"]:
        return jsonify(ok=False, quality=quality)
    crop_id = request.form.get("crop_id") or None
    crop = data.crop(crop_id) if crop_id else None
    lang = _lang(request.form)
    context = {"region": g.user.region, "stage": request.form.get("stage") or None}
    plot_id = request.form.get("plot_id", type=int)
    if plot_id and own_plot(plot_id):
        a = analysis.analyze(own_plot(plot_id), g.user, light=True)
        context["recent_weather"] = {"rain_next3_mm": a["water"]["summary"]["rain_next3_mm"], "fungal_level": a["risks"]["fungal_level"], "water_ec": a["salinity"]["ecw"]}
    mode, result = "unconfigured", None
    if llm.gemini_available():
        try:
            result, mode = llm.scan_image_gemini(g.user.region, lang, clean, "image/jpeg", context), "gemini"
        except Exception as exc:
            current_app.logger.warning("Gemini scan failed: %s", exc)
            result, mode = None, "error"
    rec = None
    if result:
        rec = Scan(user_id=g.user.id, plot_id=plot_id, crop=crop_id, result_json=json.dumps(result, ensure_ascii=False))
        db.session.add(rec)
        db.session.commit()
    return jsonify(ok=True, mode=mode, quality=quality, result=result, scan_id=rec.id if rec else None)


@bp.post("/scan/<int:sid>/confirm")
@login_required
def confirm_scan(sid):
    s = db.session.get(Scan, sid)
    if not s or s.user_id != g.user.id:
        return jsonify(error="not_found"), 404
    s.confirmed = ((request.get_json(silent=True) or {}).get("label") or "")[:60]
    db.session.commit()
    return jsonify(scan=s.to_dict())


@bp.get("/scans")
@login_required
def scans():
    rows = Scan.query.filter_by(user_id=g.user.id).order_by(Scan.id.desc()).limit(30).all()
    return jsonify(scans=[s.to_dict() for s in rows])


@bp.post("/extract-lab")
@login_required
def extract_lab():
    f = request.files.get("file")
    if not f or (f.mimetype not in ALLOWED and f.mimetype != "application/pdf"):
        return jsonify(error="invalid_file"), 400
    raw = f.read()
    if not llm.gemini_available():
        return jsonify(ok=True, mode="unconfigured", result=None)
    try:
        if f.mimetype != "application/pdf":
            raw = scanner.prepare(raw, max_side=1800)[0]
            mime = "image/jpeg"
        else:
            mime = "application/pdf"
        return jsonify(ok=True, mode="model", result=llm.extract_lab(raw, mime))
    except Exception as exc:
        current_app.logger.warning("lab extraction failed: %s", exc)
        return jsonify(ok=True, mode="error", result=None)
