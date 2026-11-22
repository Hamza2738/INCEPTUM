"""Orchestrates the engine for one plot: weather -> water balance -> salinity -> nutrients -> energy -> optimiser -> advice.
Numbers are produced here by deterministic code. The LLM (services/llm.py) only explains them."""
import datetime as dt
import json

import numpy as np

from ..engine import advice, health, nutrients, optimizer, salinity, water
from ..engine import config as C
from ..engine import energy
from . import data, openmeteo

_cache = {}


def _finite(arr, cap=1e5):
    v = float(arr)
    return None if not np.isfinite(v) or v > cap else round(v, 1)


def _bands(arr, nd=0, cap=None):
    """P10/P50/P90 by nearest rank. Non-finite values (and values above `cap`) sort last and give None when a band lands on them."""
    a = np.asarray(arr, dtype=float).ravel()
    bad = ~np.isfinite(a) if cap is None else (~np.isfinite(a) | (a > cap))
    a = np.sort(np.where(bad, np.inf, a))
    out = {}
    for k, q in (("p10", 10), ("p50", 50), ("p90", 90)):
        v = a[int(round(q / 100.0 * (len(a) - 1)))] if len(a) else np.inf
        out[k] = None if not np.isfinite(v) else round(float(v), nd)
    return out


def _balance_days(wx, lat, lon, today, past=14, future=30):
    by = {r["date"]: r for r in wx["days"]}
    out = []
    for k in range(-past, future):
        d = today + dt.timedelta(days=k)
        r = by.get(d) or dict(openmeteo.climatology(lat, lon, d), date=d)
        out.append(r)
    return out


def analyze(plot, user, whatif=None, light=False):
    whatif = whatif or {}
    key = (plot.id, json.dumps(plot.to_dict(), sort_keys=True), plot.tests[0].id if plot.tests else 0, len(plot.journal),
           dt.date.today().isoformat(), json.dumps(whatif, sort_keys=True), user.region, light)
    if key in _cache:
        return _cache[key]
    res = _analyze(plot, user, whatif, light)
    if len(_cache) > 300:
        _cache.clear()
    _cache[key] = res
    return res


def _analyze(plot, user, whatif, light):
    reg, crop = data.region(user.region), data.crop(plot.crop_id)
    if crop is None:
        raise ValueError("unknown crop")
    soil = data.soils().get(plot.soil_texture) or data.soils()["loam"]
    eff = C.IRRIGATION_EFFICIENCY.get(plot.irrigation_type, 0.7)
    today = dt.date.today()
    area = plot.area_ha
    warnings = []

    wx = openmeteo.get_weather(plot.lat, plot.lon)
    if wx["source"] == "synthetic-climatology":
        warnings.append({"code": "weather_synthetic"})
    elif wx["stale"]:
        warnings.append({"code": "weather_stale", "fetched_at": wx["fetched_at"]})
    bal_days = _balance_days(wx, plot.lat, plot.lon, today)
    season_start = water.season_start_for(crop, plot.sowing_date, today)

    irrigations = {}
    for e in plot.journal:
        if e.kind == "irrigation" and e.quantity and today - dt.timedelta(days=14) <= e.date <= today:
            irrigations[e.date] = irrigations.get(e.date, 0.0) + e.quantity / (area * 10.0) * eff
    rain_factor = float(whatif.get("rain_factor", 1.0))
    bal = water.run_balance(crop, soil["fc"], soil["wp"], bal_days, season_start, today, eff, irrigations,
                            rain_factor=rain_factor, delay_days=int(whatif.get("delay_days", 0)), dose_factor=float(whatif.get("dose_factor", 1.0)))

    latest = plot.tests[0] if plot.tests else None
    test = latest.to_dict() if latest else None
    age = (today - latest.date).days if latest else None
    if latest is None:
        warnings.append({"code": "no_soil_test"})
    elif age > 365:
        warnings.append({"code": "old_soil_test", "days": age})

    candidates = {cid: data.crop(cid) for cid in reg["crops"]}
    sal = salinity.assess(crop, plot.water_ec, candidates, latest.ec if latest and latest.ec is not None else None)
    if sal["lr"] is None or not sal["lr_feasible"]:
        warnings.append({"code": "leaching_infeasible"})
    if plot.irrigation_type == "paddy":
        warnings.append({"code": "paddy_not_modeled"})

    # Decide whether to blend RO water: only when raw water is not OK for the crop. The recommended practice uses the blended water.
    thr = crop["ece_thr"]
    if sal["verdict"] == "OK":
        target, x_blend = plot.water_ec, 0.0
    else:
        target = salinity.target_ecw(thr)
        x_blend = float(energy.blend_fraction(plot.water_ec, target))
    ecw_eff = x_blend * C.PERMEATE_EC + (1.0 - x_blend) * plot.water_ec
    lr_eff = salinity.leaching_requirement(ecw_eff, thr)
    lf = min(lr_eff, C.LEACH_CAP) if lr_eff and lr_eff > 0.03 else 0.0

    # ---- nutrients and salt forecast ------------------------------------------------------------
    season_days = sum(crop["stages"])
    d_in = (today - season_start).days
    H = C.SIM_HORIZON_PERENNIAL if crop["perennial"] else int(min(C.SIM_HORIZON_PERENNIAL, max(C.SIM_HORIZON_MIN, season_days - d_in + 5)))
    sim_days = openmeteo.horizon_days(wx, today, H, plot.lat, plot.lon)
    if rain_factor != 1.0:
        sim_days = [dict(d, rain=d["rain"] * rain_factor) if k < 16 else d for k, d in enumerate(sim_days)]
    n0, om, known = nutrients.soil_n_pool(test, reg["defaults"])
    for e in plot.journal:
        if e.kind == "fertilization" and e.quantity and today - dt.timedelta(days=30) <= e.date <= today:
            n0 += e.quantity * (1 - C.N_VOL_LOSS)
    dose = nutrients.dose_range(crop, user.region, n0, om, plot.fert_n_current)
    ece0 = latest.ec if latest and latest.ec is not None else max(0.3, salinity.ece_from_ecw(plot.water_ec) * 0.8)
    ctx = {"crop": crop, "fc": soil["fc"], "wp": soil["wp"], "eff": eff, "ecw": plot.water_ec, "today": today, "season_start": season_start,
           "ece0": ece0, "dr0": bal["dr_before_today"], "n0": n0, "om": om}
    share = nutrients.horizon_share(crop, (today - season_start).days, H)
    n_factor = float(whatif.get("n_factor", 1.0))
    cur_total = plot.fert_n_current * share * n_factor
    sim_cur = nutrients.simulate(ctx, sim_days, {"events": {3: cur_total / 2, H // 2: cur_total / 2}, "lf": 0.0})
    sim_rec = nutrients.simulate(dict(ctx, ecw=ecw_eff), sim_days, {"auto_n": True, "lf": lf})
    nitrate_limit = reg["standards"].get("nitrate_limit_mg_l_n")

    rng = np.random.default_rng(11)
    n = C.MC_RUNS
    sp = C.MC_SPREAD

    def u():
        return rng.uniform(1 - sp, 1 + sp, n)
    mid_s = np.maximum(0.0, (crop["n_demand"] * u() - dose["supply_kg_ha"] * u()) / C.NUE)
    save_kg = np.maximum(0.0, plot.fert_n_current - mid_s) * area
    saved_kg_mid = max(0.0, plot.fert_n_current - dose["mid"]) * area
    fert_block = {
        "dose": dose, "known_soil_n": known, "om_pct": om, "horizon_days": H, "share_of_season": round(share, 3),
        "sim_current": sim_cur, "sim_recommended": sim_rec, "applications": sim_rec["applications"],
        "savings": {"kg_n": round(saved_kg_mid, 0), "cost": round(saved_kg_mid * reg["n_price_per_kg"], 0), "cost_bands": _bands(save_kg * reg["n_price_per_kg"]),
                    "embedded_kwh": round(saved_kg_mid * C.N_EMBEDDED_KWH_PER_KG, 0), "embedded_co2_kg": round(saved_kg_mid * C.N_EMBEDDED_CO2_KG_PER_KG, 0), "currency": reg["currency"]},
        "leaching_fraction": round(lf, 3), "ecw_effective": round(ecw_eff, 2), "blend_fraction": round(x_blend, 3),
    }

    # ---- risks ------------------------------------------------------------------------------------
    trisk = health.temperature_risks(crop, sim_days, plot.greenhouse)
    fungal = health.fungal_risk(sim_days)
    risks = {"frost": trisk["frost"], "heat": trisk["heat"], "tmin": trisk["tmin"], "tmax": trisk["tmax"], "fungal_level": fungal["level"], "fungal_days": fungal["favourable_days"]}

    # ---- energy and optimiser -----------------------------------------------------------------------
    en_out, opt_out = None, None
    if not light:
        annual_m3 = sim_rec["summary"]["applied_mm"] * area * 10.0 / H * season_days
        demands = water.daily_gross_demand_mm(bal["series"], today, eff)
        need_m3 = [mm * area * 10.0 / (1 - lf) for mm in demands]
        peak = max(max(need_m3 or [0.0]), annual_m3 / season_days)
        tariff24 = reg["tariff"]["hours"]
        tmean = float(np.mean(tariff24))
        ghi = openmeteo.annual_ghi(plot.lat, plot.lon, reg["pv"]["ghi_fallback_kwh_m2_year"])
        args = (plot.well_depth_m, plot.pump_eff, plot.water_ec, target, annual_m3, peak, tmean, reg["pv"]["capex_per_kw"], ghi["kwh_m2_year"], season_days)
        base = energy.evaluate(*args)
        mc = energy.evaluate(plot.well_depth_m * u(), np.minimum(plot.pump_eff * u(), 0.95), plot.water_ec * u(), target, annual_m3 * u(), peak,
                             tmean * u(), reg["pv"]["capex_per_kw"] * u(), ghi["kwh_m2_year"], season_days)
        co2 = C.ENERGY_CO2_KG_PER_KWH[user.region]
        en_out = {
            "pump_kwh_m3": round(float(base["pump_kwh_m3"]), 3), "treat_kwh_m3": round(float(base["treat_kwh_m3"]), 3),
            "total_kwh_m3": round(float(base["total_kwh_m3"]), 3), "treated_fraction": round(float(base["treated_fraction"]), 3),
            "target_ecw": round(target, 2), "annual_m3": round(annual_m3), "annual_kwh": round(float(base["annual_kwh"])),
            "annual_cost": round(float(base["annual_cost"])), "brine_m3": round(float(base["brine_m3"])), "pv_kw": round(float(base["pv_kw"]), 1),
            "capex": round(float(base["capex"])), "pv_savings": round(float(base["pv_savings"])), "pv_share": round(float(base["pv_share"]), 2),
            "payback_months": _finite(base["payback_months"]), "co2_t_year": round(float(base["annual_kwh"]) * co2 / 1000.0, 1),
            "co2_kg_per_kwh": co2, "pump_co2_kg_m3": round(float(base["pump_kwh_m3"]) * co2, 3), "treat_co2_kg_m3": round(float(base["treat_kwh_m3"]) * co2, 3),
            "total_co2_kg_m3": round(float(base["total_kwh_m3"]) * co2, 3), "annual_co2_t": round(float(base["annual_kwh"]) * co2 / 1000.0, 2),
            "pv_co2_avoided_t": round(float(base["annual_kwh"]) * float(base["pv_share"]) * co2 / 1000.0, 2),
            "bands": {"annual_kwh": _bands(mc["annual_kwh"]), "annual_co2_t": _bands(mc["annual_kwh"] * co2 / 1000.0, 2), "annual_cost": _bands(mc["annual_cost"]), "payback_months": _bands(mc["payback_months"], 0, cap=1e5)},
            "payback_months_p50": _bands(mc["payback_months"], 0, cap=1e5)["p50"], "ghi": ghi, "tariff_note": reg["tariff"]["note"], "pv_note": reg["pv"]["note"],
            "season_days": season_days, "currency": reg["currency"], "leaching_extra_pct": round(100 * (1 / (1 - lf) - 1), 1) if lf else 0,
        }
        forb = C.FORBIDDEN_HOURS_BY_TYPE.get(plot.irrigation_type, [])
        opt_out = {"no_solar": optimizer.optimize(need_m3, float(base["total_kwh_m3"]), tariff24, reg["tariff"]["peak_hours"], 0.0, forb),
                   "with_solar": optimizer.optimize(need_m3, float(base["total_kwh_m3"]), tariff24, reg["tariff"]["peak_hours"], float(base["pv_kw"]), forb),
                   "currency": reg["currency"], "co2_kg_per_kwh": co2, "tariff_hours": tariff24, "peak_hours": reg["tariff"]["peak_hours"], "forbidden_hours": forb}
        for res in (opt_out["no_solar"], opt_out["with_solar"]):
            for key in ("baseline", "optimized"):
                if key in res:
                    res[key]["co2_kg"] = round(res[key]["kwh_grid"] * co2, 1)

    # ---- indicators -> advice -----------------------------------------------------------------------
    nxt = next((a for a in sim_rec["applications"] if (dt.date.fromisoformat(a["date"]) - today).days <= 7), None)
    ind = {
        "risks": risks, "water": bal["summary"], "salinity": sal,
        "fert": {"over_pct": dose["over_pct"], "current": dose["current"], "mid": dose["mid"], "next_application": nxt},
        "nitrate": {"mg_l": sim_cur["summary"]["nitrate_mg_l"], "limit": nitrate_limit},
        "soil_test_age_days": age,
        "energy": {"payback_months_p50": en_out["payback_months_p50"] if en_out else None, "treated_fraction": en_out["treated_fraction"] if en_out else 0,
                   "brine_m3": en_out["brine_m3"] if en_out else 0},
    }
    adv = advice.build(ind)
    wy = bal["summary"]["rel_yield_water"]
    yr = sal.get("yield_rel_measured", sal["yield_rel"]) / 100.0
    return {
        "plot": plot.to_dict(), "today": today.isoformat(), "crop_id": crop["id"],
        "crop": {"id": crop["id"], "name": crop["name"], "ece_thr": crop["ece_thr"], "n_demand": crop["n_demand"], "zr": crop["zr"], "p": crop["p"], "ky": crop["ky"]},
        "weather": {"source": wx["source"], "fetched_at": wx["fetched_at"], "stale": wx["stale"]},
        "water": bal, "salinity": sal, "fertilizer": fert_block, "energy": en_out, "optimizer": opt_out, "risks": risks, "advice": adv,
        "indicators": ind, "warnings": warnings, "yield_factor": round(yr * wy, 3), "nitrate_limit": nitrate_limit,
        "latest_test": test, "whatif": whatif or None, "assumptions": C.ASSUMPTION_NOTES,
    }


def compact(plot, user):
    """Small summary for lists, dashboard and map (reuses the cached full analysis)."""
    a = analyze(plot, user)
    w = a["water"]["summary"]
    test = plot.tests[0].to_dict() if plot.tests else None
    return {
        "plot": a["plot"], "crop": a["crop"], "verdict": a["salinity"]["verdict"], "yield_rel": a["salinity"]["yield_rel"], "lr": a["salinity"]["lr"], "ecw": a["salinity"]["ecw"],
        "days_to_irrigation": w["days_to_irrigation"], "depletion_pct_raw": w["depletion_pct_raw"], "ks_today": w["ks_today"],
        "today_need_mm": w["today_need_mm"], "over_pct": a["fertilizer"]["dose"]["over_pct"], "nitrate_mg_l": a["fertilizer"]["sim_current"]["summary"]["nitrate_mg_l"],
        "annual_cost": a["energy"]["annual_cost"] if a["energy"] else None, "annual_kwh": a["energy"]["annual_kwh"] if a["energy"] else None,
        "payback_months": a["energy"]["payback_months_p50"] if a["energy"] else None, "ghi": a["energy"]["ghi"]["kwh_m2_year"] if a["energy"] else None,
        "saving_n_cost": a["fertilizer"]["savings"]["cost"], "saving_n_kg": a["fertilizer"]["savings"]["kg_n"],
        "advice": a["advice"], "risks": a["risks"], "warnings": a["warnings"], "weather": a["weather"], "yield_factor": a["yield_factor"],
        "water_cost_season": a["energy"]["annual_cost"] if a["energy"] else 0,
        "latest_test": test,
    }
