"""Fertiliser dose, and a daily forecast of soil nitrogen and root-zone salinity.

Simplified decision-support model: every coefficient is in config.py and tagged ASSUMPTION.
"""
import math

from . import config as C
from . import water
from .salinity import yield_rel


def soil_n_pool(test, defaults):
    if test and test.get("n_ppm") is not None:
        n0, known = test["n_ppm"] * C.N_PPM_TO_KG_HA, True
    else:
        n0, known = defaults["n_min_kg_ha"], False
    om = test["om"] if test and test.get("om") is not None else defaults["om_pct"]
    return n0, om, known


def dose_range(crop, region_id, n0, om, current):
    supply = C.N_AVAILABLE_FRACTION * n0 + om * C.OM_MINERAL_KG_PER_PCT
    mid = max(0.0, (crop["n_demand"] - supply) / C.NUE)
    cap = (crop.get("n_guideline_cap") or {}).get(region_id)
    capped = False
    if cap and mid > cap:
        mid, capped = float(cap), True
    low, high = 0.8 * mid, 1.2 * mid
    if cap:
        high = min(high, cap)
    over = ((current - mid) / mid * 100.0) if mid > 0 else None
    return {"low": round(low, 0), "mid": round(mid, 0), "high": round(high, 0), "current": current,
            "over_pct": None if over is None else round(over, 0), "supply_kg_ha": round(supply, 0),
            "capped_by_guideline": capped, "guideline_cap": cap}


def growth_curve(T):
    mu, sigma = 0.55 * T, 0.22 * T
    g = [math.exp(-0.5 * ((i - mu) / sigma) ** 2) for i in range(T)]
    s = sum(g)
    return [x / s for x in g]


def _gi(crop, g, T, d0, k):
    idx = d0 + k
    if crop["perennial"]:
        idx %= T
    return g[idx] if 0 <= idx < T else 0.0


def horizon_share(crop, d0, H):
    T = sum(crop["stages"])
    g = growth_curve(T)
    return sum(_gi(crop, g, T, d0, k) for k in range(H))


def simulate(ctx, days, policy):
    """ctx: crop, fc, wp, eff, ecw, today, season_start, ece0, dr0, n0, om.
    policy: {events: {day_index: kg N}, lf: leaching fraction, auto_n: bool}."""
    crop, H = ctx["crop"], len(days)
    taw, raw = water.taw_raw(crop, ctx["fc"], ctx["wp"])
    zr, eff, ecw = crop["zr"], ctx["eff"], ctx["ecw"]
    W = ctx["fc"] * zr * 1000.0
    T = sum(crop["stages"])
    g = growth_curve(T)
    d0 = (ctx["today"] - ctx["season_start"]).days
    n_dem = crop["n_demand"]
    gh = [_gi(crop, g, T, d0, k) for k in range(H + C.N_COVER_DAYS)]
    ecsw0 = max(ecw, 5.0 * ctx["ece0"] - ecw)
    S, dr, n_min = ecsw0 * W, ctx["dr0"], ctx["n0"]
    lf = policy.get("lf", 0.0)
    events, auto = policy.get("events", {}), policy.get("auto_n", False)
    last_event = -999
    series = []
    tot = {"fert": 0.0, "leach": 0.0, "uptake": 0.0, "drain": 0.0, "applied": 0.0}
    for i, day in enumerate(days):
        fert = events.get(i, 0.0)
        if auto:
            cover = sum(n_dem * gh[i + k] for k in range(C.N_COVER_DAYS))
            heavy = any(days[j]["rain"] >= C.HEAVY_RAIN_MM for j in range(i, min(H, i + 3)))
            if cover > 0 and n_min < 1.1 * cover and not heavy and i - last_event >= C.N_MIN_GAP_DAYS:
                amt = min(C.N_SPLIT_CAP * n_dem, 1.3 * cover - n_min)
                if amt >= 5:
                    fert, last_event = amt, i
        pu = water.eff_rain(day["rain"])
        kc = water.kc_at(crop, (day["date"] - ctx["season_start"]).days)
        ks = 1.0 if dr <= raw else max(0.0, (taw - dr) / ((1 - crop["p"]) * taw))
        dr = dr - pu + ks * kc * day["et0"]
        drain = 0.0
        if dr < 0:
            drain, dr = -dr, 0.0
        irr_net = 0.0
        if dr >= C.TRIGGER_FRACTION * raw:
            irr_net, dr = dr, 0.0
        irr_gross = irr_net / eff
        extra = irr_gross * lf / (1 - lf) if irr_net > 0 and lf > 0 else 0.0
        drain += extra
        applied = irr_gross + extra
        ecsw = S / W
        S += ecw * applied - ecsw * drain + 5.0 * W * fert * C.SALT_ECE_PER_KG_N * (0.6 / zr)
        S = max(S, ecw * W)
        ece = (S / W + ecw) / 5.0
        tmean = (day["tmax"] + day["tmin"]) / 2.0
        uptake = min(n_min + fert, n_dem * gh[i])
        tf = min(2.0, max(0.3, 1 + 0.04 * (tmean - 20)))
        mineral = ctx["om"] * C.OM_MINERAL_KG_PER_PCT / 365.0 * tf
        pool = n_min + mineral + fert * (1 - C.N_VOL_LOSS) - uptake
        leach = max(0.0, pool) * (1 - math.exp(-drain / C.N_LEACH_L0_MM))
        n_min = max(0.0, pool - leach)
        tot["fert"] += fert
        tot["leach"] += leach
        tot["uptake"] += uptake
        tot["drain"] += drain
        tot["applied"] += applied
        series.append({"date": day["date"].isoformat(), "n_min": round(n_min, 1), "ece": round(ece, 2), "drain": round(drain, 1),
                       "leach": round(leach, 2), "irr": round(applied, 1), "fert": round(fert, 1), "dr": round(dr, 1)})
    eces = [s["ece"] for s in series]
    mean_ece = sum(eces) / len(eces)
    nitrate = round(tot["leach"] * 100.0 / tot["drain"], 1) if tot["drain"] > 10 else None
    summary = {
        "n_applied": round(tot["fert"], 0), "n_leached": round(tot["leach"], 1), "n_uptake": round(tot["uptake"], 0),
        "drain_mm": round(tot["drain"], 0), "applied_mm": round(tot["applied"], 0), "nitrate_mg_l": nitrate,
        "ece_max": round(max(eces), 2), "ece_mean": round(mean_ece, 2), "ece_end": eces[-1],
        "yield_rel": round(yield_rel(mean_ece, crop["ece_thr"], crop["slope_b"]), 1),
        "n_surplus": round(tot["fert"] - tot["uptake"], 0),
    }
    return {"series": series, "summary": summary,
            "applications": [{"date": s["date"], "kg_n": s["fert"]} for s in series if s["fert"] > 0]}
