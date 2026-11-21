"""FAO-56 single crop coefficient water balance."""
import datetime as dt

from . import config as C


def kc_at(crop, idx):
    ini, mid, end = crop["kc"]
    l1, l2, l3, l4 = crop["stages"]
    total = l1 + l2 + l3 + l4
    idx = idx % total if crop["perennial"] else min(max(idx, 0), total - 1)
    if idx < l1:
        return ini
    if idx < l1 + l2:
        return ini + (mid - ini) * (idx - l1) / l2
    if idx < l1 + l2 + l3:
        return mid
    return mid + (end - mid) * (idx - l1 - l2 - l3) / l4


def eff_rain(rain_mm):
    return C.EFF_RAIN_FACTOR * rain_mm if rain_mm > C.EFF_RAIN_MIN_MM else 0.0


def taw_raw(crop, fc, wp):
    taw = 1000.0 * (fc - wp) * crop["zr"]
    return taw, crop["p"] * taw


def season_start_for(crop, sowing, today):
    if sowing:
        return sowing
    if crop["perennial"]:
        return dt.date(today.year, 1, 1)
    return today - dt.timedelta(days=20)


def run_balance(crop, fc, wp, days, season_start, today, efficiency, irrigations=None,
                rain_factor=1.0, delay_days=0, dose_factor=1.0, auto_future=True, start_dr=None):
    """days: list of {date, et0, rain}. irrigations: {date: net mm applied (journal)}.
    Returns {series, taw, raw, summary}."""
    irrigations = irrigations or {}
    taw, raw = taw_raw(crop, fc, wp)
    dr = C.INITIAL_DEPLETION_OF_RAW * raw if start_dr is None else start_dr
    out, dr_before_today = [], dr
    for d in days:
        date = d["date"]
        future = date >= today
        if date == today:
            dr_before_today = dr
        rain = d["rain"] * (rain_factor if future else 1.0)
        pu = eff_rain(rain)
        kc = kc_at(crop, (date - season_start).days)
        ks = 1.0 if dr <= raw else max(0.0, (taw - dr) / ((1 - crop["p"]) * taw))
        etc = kc * d["et0"]
        eta = ks * etc
        irr = irrigations.get(date, 0.0)
        dr = dr - pu - irr + eta
        drain = 0.0
        if dr < 0:
            drain, dr = -dr, 0.0
        dr = min(dr, taw)
        planned = 0.0
        if future and auto_future and (date - today).days >= delay_days and dr >= C.TRIGGER_FRACTION * raw:
            planned = dr * dose_factor
            dr -= planned
        out.append({
            "date": date.isoformat(), "et0": round(d["et0"], 2), "kc": round(kc, 3), "etc": round(etc, 2),
            "eta": round(eta, 2), "ks": round(ks, 3), "rain": round(rain, 1), "pu": round(pu, 2),
            "irr_net": round(irr, 1), "planned_net": round(planned, 1), "planned_gross": round(planned / efficiency, 1),
            "dr": round(dr, 1), "drain": round(drain, 1), "future": future,
        })
    return {"series": out, "taw": round(taw, 1), "raw": round(raw, 1), "dr_before_today": dr_before_today,
            "summary": summarize(out, crop, taw, raw, today, efficiency)}


def summarize(series, crop, taw, raw, today, efficiency):
    iso = today.isoformat()
    today_row = next((r for r in series if r["date"] == iso), series[0])
    nxt = next((r for r in series if r["future"] and r["planned_net"] > 0), None)
    window = [r for r in series if abs((dt.date.fromisoformat(r["date"]) - today).days) <= 7]
    etc_sum = sum(r["etc"] for r in window) or 1.0
    ratio = min(1.0, sum(r["eta"] for r in window) / etc_sum)
    return {
        "today_etc_mm": today_row["etc"],
        "today_need_mm": round(max(0.0, today_row["etc"] - today_row["pu"]), 2),
        "depletion_mm": today_row["dr"],
        "depletion_pct_raw": round(100 * today_row["dr"] / raw, 0) if raw else 0,
        "ks_today": today_row["ks"],
        "next_irrigation_date": nxt["date"] if nxt else None,
        "next_irrigation_gross_mm": nxt["planned_gross"] if nxt else None,
        "days_to_irrigation": (dt.date.fromisoformat(nxt["date"]) - today).days if nxt else None,
        "rain_next3_mm": round(sum(r["rain"] for r in series if r["future"] and 0 <= (dt.date.fromisoformat(r["date"]) - today).days <= 2), 1),
        "eta_etc_ratio": round(ratio, 3),
        "rel_yield_water": round(max(0.0, 1 - crop["ky"] * (1 - ratio)), 3),
    }


def daily_gross_demand_mm(series, today, efficiency, horizon=7):
    """Average-day gross demand for continuous irrigation over the next days (ETc minus effective rain)."""
    fut = [r for r in series if r["future"]][:horizon]
    return [max(0.0, r["etc"] - r["pu"]) / efficiency for r in fut]
