"""Deterministic rules that turn computed indicators into at most three prioritised pieces of advice.
The frontend translates each `code` with its parameters. An LLM may rewrite them (services/llm.py),
but it never computes numbers: this module is the source of truth."""

URGENCY_SCORE = {"high": 3, "medium": 2, "low": 1}


def build(ind):
    """ind: dict of indicators prepared by services/analysis.py. Returns the top-3 advice list."""
    a = []

    def add(code, urgency, confidence, score_bonus=0.0, **params):
        a.append({"code": code, "urgency": urgency, "confidence": confidence, "params": params,
                  "score": URGENCY_SCORE[urgency] + score_bonus})

    r = ind["risks"]
    if r.get("frost"):
        add("frost_risk", "high", "medium", 0.9, tmin=r["tmin"])
    if r.get("heat"):
        add("heat_risk", "high", "medium", 0.8, tmax=r["tmax"])
    w = ind["water"]
    if w["days_to_irrigation"] == 0:
        add("irrigate_today", "high", "medium", 0.7, mm=w["next_irrigation_gross_mm"], pct=w["depletion_pct_raw"])
    elif w["days_to_irrigation"] is not None and w["days_to_irrigation"] <= 3:
        add("irrigate_soon", "medium", "medium", 0.4, days=w["days_to_irrigation"], date=w["next_irrigation_date"])
    if w["rain_next3_mm"] >= 8 and w["days_to_irrigation"] is not None and w["days_to_irrigation"] <= 3:
        add("rain_skip", "medium", "low", 0.5, mm=w["rain_next3_mm"])
    s = ind["salinity"]
    if s["verdict"] == "NOT_SUITABLE":
        add("salinity_not_suitable", "high", "medium", 0.95, ecw=s["ecw"], alt=[x["crop_id"] for x in s["alternatives"]])
    elif s["verdict"] == "RISKY":
        add("salinity_risky", "medium", "medium", 0.6, ecw=s["ecw"], yr=s["yield_rel"], lr=s["lr"])
    if s["lr"] and s["lr"] > 0.05 and s["lr_feasible"]:
        add("leaching_needed", "medium", "medium", 0.3, lr=s["lr"])
    f = ind["fert"]
    if f["over_pct"] is not None and f["over_pct"] >= 20:
        add("over_fertilization", "high" if f["over_pct"] >= 40 else "medium", "medium", 0.5 + min(f["over_pct"], 100) / 200,
            pct=f["over_pct"], current=f["current"], mid=f["mid"])
    n = ind["nitrate"]
    if n["mg_l"] is not None and n["limit"] and n["mg_l"] > n["limit"]:
        add("nitrate_risk", "high", "low", 0.85, mg=n["mg_l"], limit=n["limit"])
    if f.get("next_application"):
        add("apply_n_soon", "medium", "low", 0.2, date=f["next_application"]["date"], kg=f["next_application"]["kg_n"])
    fg = r.get("fungal_level")
    if fg in ("high", "medium"):
        add("fungal_risk", "high" if fg == "high" else "medium", "low", 0.1)
    age = ind.get("soil_test_age_days")
    if age is None:
        add("soil_test_missing", "low", "high", 0.4)
    elif age > 365:
        add("soil_test_old", "low", "high", 0.3, days=age)
    e = ind["energy"]
    if e["payback_months_p50"] and e["payback_months_p50"] < 72:
        add("solar_pays_back", "low", "medium", 0.2, months=round(e["payback_months_p50"]))
    if e["treated_fraction"] and e["treated_fraction"] > 0:
        add("brine_note", "low", "medium", 0.1, brine=round(e["brine_m3"]))
    a.sort(key=lambda x: x["score"], reverse=True)
    return a[:3] if a else [{"code": "all_good", "urgency": "low", "confidence": "medium", "params": {}, "score": 0}]
