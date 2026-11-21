import datetime as dt

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import FieldMeasurement, Plot
from ..services import analysis, data
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
@bp.get("/map/overview")
@login_required
def map_overview():
    plots = Plot.query.filter_by(user_id=g.user.id).all()
    meas = FieldMeasurement.query.filter_by(user_id=g.user.id).order_by(FieldMeasurement.date.desc()).limit(200).all()
    return jsonify(plots=[analysis.compact(p, g.user) for p in plots], measurements=[m.to_dict() for m in meas])


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
