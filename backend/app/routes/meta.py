import datetime as dt

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import FieldMeasurement, Plot
from ..services import analysis, data, openmeteo
from .plots import num, parse_date

bp = Blueprint("meta", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify(status="ok", time=dt.datetime.utcnow().isoformat() + "Z")


@bp.get("/regions")
def regions():
    """Public: both region profiles for the split login screen."""
    return jsonify(regions={rid: data.region_public(rid) for rid in data.regions()})


@bp.get("/dashboard")
@login_required
def dashboard():
    plots = Plot.query.filter_by(user_id=g.user.id).order_by(Plot.id).all()
    items = [analysis.compact(p, g.user) for p in plots]
    reg = data.region(g.user.region)
    alerts = []
    for it in items:
        for adv in it["advice"]:
            if adv["urgency"] in ("high", "medium") and adv["code"] != "all_good":
                alerts.append(dict(adv, plot_id=it["plot"]["id"], plot_name=it["plot"]["name"]))
    alerts.sort(key=lambda a: a["score"], reverse=True)

    notifications = []
    for it in items:
        plot = it["plot"]
        if it["days_to_irrigation"] is not None and it["days_to_irrigation"] <= 1 and (it["today_need_mm"] or 0) > 0:
            notifications.append({"kind": "irrigation", "tone": "risk", "plot_id": plot["id"], "plot_name": plot["name"], "code": "notify_irrigation_today", "params": {"mm": round(it["today_need_mm"], 1)}})
        elif it["days_to_irrigation"] is not None and it["days_to_irrigation"] <= 3:
            notifications.append({"kind": "irrigation", "tone": "warn", "plot_id": plot["id"], "plot_name": plot["name"], "code": "notify_irrigation_soon", "params": {"days": int(it["days_to_irrigation"])}})

        test = it.get("latest_test")
        if not test:
            notifications.append({"kind": "soil", "tone": "info", "plot_id": plot["id"], "plot_name": plot["name"], "code": "notify_soil_test"})
        elif test.get("ec") is not None and test["ec"] > 4:
            notifications.append({"kind": "soil", "tone": "warn", "plot_id": plot["id"], "plot_name": plot["name"], "code": "notify_soil_salt", "params": {"ec": round(test["ec"], 1)}})

        if not plot.get("sowing_date"):
            notifications.append({"kind": "planting", "tone": "info", "plot_id": plot["id"], "plot_name": plot["name"], "code": "notify_planting"})

    notifications = notifications[:10]
    totals = {
        "plots": len(items), "area_ha": round(sum(i["plot"]["area_ha"] for i in items), 2),
        "annual_energy_cost": round(sum(i["annual_cost"] or 0 for i in items)), "annual_kwh": round(sum(i["annual_kwh"] or 0 for i in items)),
        "saving_n_cost": round(sum(i["saving_n_cost"] or 0 for i in items)), "saving_n_kg": round(sum(i["saving_n_kg"] or 0 for i in items)),
        "at_risk": sum(1 for i in items if i["verdict"] != "OK"), "currency": reg["currency"],
    }
    policy = reg.get("policy")
    if policy:   # progress against the national fertiliser-reduction target
        cur = sum(i["plot"]["fert_n_current"] * i["plot"]["area_ha"] for i in items)
        rec = cur - totals["saving_n_kg"]
        totals["fertilizer_reduction_pct"] = round(100 * (cur - rec) / cur, 1) if cur > 0 else 0
    return jsonify(items=items, alerts=alerts[:8], notifications=notifications, totals=totals)


# ---- map -------------------------------------------------------------------------------------------
MAP_BOUNDS = {
    "TN": (30.2, 37.5, 7.3, 11.7, 0.35, 0.42),
    "JP": (30.8, 45.7, 129.2, 145.9, 0.75, 1.05),
}
MAP_REFERENCES = {
    "TN": [
        {"lat": 36.806, "lon": 10.181, "water_ec": 1.2, "soil_texture": "clay_loam"},
        {"lat": 34.740, "lon": 10.760, "water_ec": 2.4, "soil_texture": "loam"},
        {"lat": 33.881, "lon": 10.098, "water_ec": 3.2, "soil_texture": "sandy_loam"},
        {"lat": 33.919, "lon": 8.134, "water_ec": 4.5, "soil_texture": "sandy_loam"},
        {"lat": 33.704, "lon": 8.969, "water_ec": 3.8, "soil_texture": "sandy_loam"},
    ],
    "JP": [
        {"lat": 34.740, "lon": 138.220, "water_ec": 0.3, "soil_texture": "silt_loam", "nitrate_mg_l": 8},
        {"lat": 32.790, "lon": 130.740, "water_ec": 0.5, "soil_texture": "loam", "nitrate_mg_l": 11},
        {"lat": 37.900, "lon": 139.030, "water_ec": 0.2, "soil_texture": "clay_loam", "nitrate_mg_l": 6},
    ],
}


def _regional_estimates(region_id):
    south, north, west, east, lat_step, lon_step = MAP_BOUNDS[region_id]
    reg = data.region(region_id)
    refs = MAP_REFERENCES[region_id]
    estimates = []
    today = dt.date.today()
    for lat in _range(south, north, lat_step):
        for lon in _range(west, east, lon_step):
            center_lat = lat + lat_step / 2
            center_lon = lon + lon_step / 2
            nearest = min(refs, key=lambda r: (center_lat-r["lat"])**2 + ((center_lon-r["lon"])*1.35)**2)
            days = [openmeteo.climatology(center_lat, center_lon, today + dt.timedelta(days=d)) for d in range(-14, 1)]
            rain = sum(max(0, float(d["rain"] or 0)) for d in days)
            et0 = sum(max(0, float(d["et0"] or 0)) for d in days)
            deficit = max(0, et0 - rain)
            moisture_remaining = max(5, min(95, round(100 - deficit / 80 * 100)))
            stress = max(0.55, min(1, round(1 - deficit / 180, 2)))
            water_ec = nearest["water_ec"]
            leaching = max(0, min(40, round((water_ec - 0.8) * 12, 1))) if region_id == "TN" else max(0, min(25, round((water_ec - 0.1) * 8, 1)))
            yield_rel = max(70, min(100, round(100 - max(0, water_ec - (1.2 if region_id == "TN" else 0.4)) * 8)))
            nitrate = nearest.get("nitrate_mg_l") if region_id == "JP" else None
            estimates.append({
                "lat": round(center_lat, 3), "lon": round(center_lon, 3),
                "bounds": [[round(lat, 3), round(lon, 3)], [round(lat+lat_step, 3), round(lon+lon_step, 3)]],
                "moisture_remaining": moisture_remaining, "ks_today": stress,
                "yield_rel": yield_rel, "lr": round(leaching/100, 3),
                "nitrate_mg_l": nitrate, "ghi": reg["pv"]["ghi_fallback_kwh_m2_year"],
                "source": "Open-Meteo climate climatology + nearest regional reference", "soil_texture": nearest["soil_texture"],
            })
    return estimates


def _range(start, stop, step):
    value = start
    while value < stop:
        yield value
        value += step


@bp.get("/map/overview")
@login_required
def map_overview():
    plots = Plot.query.filter_by(user_id=g.user.id).all()
    meas = FieldMeasurement.query.filter_by(user_id=g.user.id).order_by(FieldMeasurement.date.desc()).limit(200).all()
    return jsonify(plots=[analysis.compact(p, g.user) for p in plots], measurements=[m.to_dict() for m in meas], regional_estimates=_regional_estimates(g.user.region))


@bp.post("/map/measurements")
@login_required
def add_measurement():
    b = request.get_json(silent=True) or {}
    lat, lon, val = num(b.get("lat")), num(b.get("lon")), num(b.get("value"))
    if None in (lat, lon, val) or b.get("kind") not in ("ec", "moisture", "ph"):
        return jsonify(error="invalid_input"), 400
    m = FieldMeasurement(user_id=g.user.id, lat=lat, lon=lon, value=val, kind=b["kind"], date=parse_date(b.get("date"), dt.date.today()), note=(b.get("note") or "")[:200])
    db.session.add(m)
    db.session.commit()
    return jsonify(measurement=m.to_dict()), 201


@bp.delete("/map/measurements/<int:mid>")
@login_required
def delete_measurement(mid):
    m = db.session.get(FieldMeasurement, mid)
    if not m or m.user_id != g.user.id:
        return jsonify(error="not_found"), 404
    db.session.delete(m)
    db.session.commit()
    return jsonify(ok=True)
