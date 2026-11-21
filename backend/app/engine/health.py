"""Frost, heat and fungal-disease favourability. The fungal index is a HEURISTIC (course section 4.4):
it signals favourable conditions, never an infection. Thresholds must be validated by a plant pathologist."""

FUNGAL_RH, FUNGAL_TMIN, FUNGAL_TMAX = 80.0, 10.0, 28.0   # ASSUMPTION


def temperature_risks(crop, future_days, greenhouse=False):
    """Look at the next 72 hours. Greenhouses are shielded from frost, not from heat."""
    nxt = future_days[:3]
    if not nxt:
        return {"frost": False, "heat": False, "tmin": None, "tmax": None}
    tmin = min(d["tmin"] for d in nxt)
    tmax = max(d["tmax"] for d in nxt)
    return {"frost": (not greenhouse) and tmin <= crop["frost_c"] + 1.0, "heat": tmax >= crop["heat_c"],
            "tmin": round(tmin, 1), "tmax": round(tmax, 1)}


def fungal_risk(future_days):
    days = future_days[:5]
    known = [d for d in days if d.get("rh") is not None]
    if not known:
        return {"level": "unknown", "favourable_days": None}
    fav = sum(1 for d in known if d["rh"] >= FUNGAL_RH and FUNGAL_TMIN <= (d["tmax"] + d["tmin"]) / 2 <= FUNGAL_TMAX)
    level = "high" if fav >= 4 else "medium" if fav >= 2 else "low"
    return {"level": level, "favourable_days": fav}
