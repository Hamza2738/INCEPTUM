import datetime as dt

from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import JournalEntry, Plot, SoilTest
from ..services import data, openmeteo

bp = Blueprint("plots", __name__, url_prefix="/api")

BOUNDS = {"TN": (29.5, 38.0, 7.0, 12.0), "JP": (24.0, 46.0, 122.0, 146.5)}   # lat min/max, lon min/max


def parse_date(v, default=None):
    try:
        return dt.date.fromisoformat(v) if v else default
    except (TypeError, ValueError):
        return default


def num(v, default=None):
    try:
        return float(v) if v not in (None, "") else default
    except (TypeError, ValueError):
        return default


def own_plot(pid):
    p = db.session.get(Plot, pid)
    return p if p and p.user_id == g.user.id else None


def apply_plot(p, b):
    reg = data.region(g.user.region)
    errors = []
    if b.get("name") is not None:
        p.name = str(b["name"]).strip()[:150] or p.name or "Plot"
    for field, lo, hi in (("lat", -90, 90), ("lon", -180, 180), ("area_ha", 0.01, 100000), ("well_depth_m", 0, 1500), ("pump_eff", 0.2, 0.95),
                          ("water_ec", 0, 40), ("fert_n_current", 0, 2000)):
        if field in b:
            v = num(b[field])
            if v is None or not lo <= v <= hi:
                errors.append(field)
            else:
                setattr(p, field, v)
    if "crop_id" in b:
        if b["crop_id"] in reg["crops"]:
            p.crop_id = b["crop_id"]
        else:
            errors.append("crop_id")
    if "soil_texture" in b:
        if b["soil_texture"] in data.soils():
            p.soil_texture = b["soil_texture"]
        else:
            errors.append("soil_texture")
    if "irrigation_type" in b:
        if b["irrigation_type"] in ("drip", "sprinkler", "pivot", "surface", "paddy"):
            p.irrigation_type = b["irrigation_type"]
        else:
            errors.append("irrigation_type")
    if "sowing_date" in b:
        p.sowing_date = parse_date(b["sowing_date"])
    if "greenhouse" in b:
        p.greenhouse = bool(b["greenhouse"])
    if not errors and "lat" in b and "lon" in b and not b.get("confirm_outside"):
        lat0, lat1, lon0, lon1 = BOUNDS[g.user.region]
        if not (lat0 <= p.lat <= lat1 and lon0 <= p.lon <= lon1):
            return ["outside_region"]
    return errors


@bp.get("/plots")
@login_required
def list_plots():
    plots = Plot.query.filter_by(user_id=g.user.id).order_by(Plot.id).all()
    return jsonify(plots=[p.to_dict() for p in plots])


@bp.post("/plots/location-suggestions")
@login_required
def location_suggestions():
    b = request.get_json(silent=True) or {}
    lat, lon = num(b.get("lat")), num(b.get("lon"))
    if lat is None or lon is None:
        return jsonify(error="invalid_input"), 400
    lat0, lat1, lon0, lon1 = BOUNDS[g.user.region]
    if not (lat0 <= lat <= lat1 and lon0 <= lon <= lon1):
        return jsonify(error="outside_region"), 400

    suggestions = {"soil_texture": "loam", "source": "region_default"}
    try:
        weather = openmeteo.get_weather(lat, lon)
        today = dt.date.today()
        future = [row for row in weather.get("days", []) if str(row.get("date")) == today.isoformat()]
        if not future:
            future = weather.get("days", [])[:1]
        row = future[0] if future else {}
        rain = max(0.0, float(row.get("rain", 0) or 0))
        tmin, tmax = row.get("tmin"), row.get("tmax")
        temp = round((float(tmin) + float(tmax)) / 2, 1) if tmin is not None and tmax is not None else None
        suggestions.update({
            "weather_source": weather.get("source"),
            "rain_mm_today": rain,
            "temperature_c": temp,
            "forecast_available": True,
        })
    except Exception:
        suggestions["forecast_available"] = False

    if g.user.region == "TN":
        reference_points = [
            {"name": "Tunis", "lat": 36.806, "lon": 10.181, "soil_texture": "clay_loam", "water_ec": 1.2, "irrigation_type": "drip", "well_depth_m": 60, "pump_eff": 0.55, "fert_n": 100},
            {"name": "Sfax", "lat": 34.740, "lon": 10.760, "soil_texture": "loam", "water_ec": 2.4, "irrigation_type": "drip", "well_depth_m": 60, "pump_eff": 0.55, "fert_n": 90},
            {"name": "Tozeur", "lat": 33.919, "lon": 8.134, "soil_texture": "sandy_loam", "water_ec": 4.5, "irrigation_type": "drip", "well_depth_m": 90, "pump_eff": 0.55, "fert_n": 320},
            {"name": "Kébili", "lat": 33.704, "lon": 8.969, "soil_texture": "sandy_loam", "water_ec": 3.8, "irrigation_type": "surface", "well_depth_m": 120, "pump_eff": 0.55, "fert_n": 160},
            {"name": "Gabès", "lat": 33.881, "lon": 10.098, "soil_texture": "sandy_loam", "water_ec": 3.2, "irrigation_type": "drip", "well_depth_m": 75, "pump_eff": 0.55, "fert_n": 140},
        ]
    else:
        reference_points = [
            {"name": "Shizuoka", "lat": 34.740, "lon": 138.220, "soil_texture": "silt_loam", "water_ec": 0.3, "irrigation_type": "sprinkler", "well_depth_m": 30, "pump_eff": 0.60, "fert_n": 600},
            {"name": "Kumamoto", "lat": 32.790, "lon": 130.740, "soil_texture": "loam", "water_ec": 0.5, "irrigation_type": "drip", "well_depth_m": 40, "pump_eff": 0.60, "fert_n": 400},
            {"name": "Niigata", "lat": 37.900, "lon": 139.030, "soil_texture": "clay_loam", "water_ec": 0.2, "irrigation_type": "paddy", "well_depth_m": 10, "pump_eff": 0.60, "fert_n": 75},
        ]

    nearest = min(reference_points, key=lambda r: (lat-r["lat"])**2 + ((lon-r["lon"])*1.35)**2)
    suggestions.update({k: nearest[k] for k in ("soil_texture", "water_ec", "irrigation_type", "well_depth_m", "pump_eff", "fert_n")})
    suggestions.update({"source": "regional_reference", "reference_name": nearest["name"]})
    return jsonify(suggestions=suggestions)


@bp.post("/plots")
@login_required
def create_plot():
    b = request.get_json(silent=True) or {}
    reg = data.region(g.user.region)
    p = Plot(user_id=g.user.id, name="Plot", lat=reg["map"]["center"][0], lon=reg["map"]["center"][1], crop_id=reg["default_crop"])
    errors = apply_plot(p, b)
    if errors:
        return jsonify(error="invalid_input", fields=errors), 400
    db.session.add(p)
    db.session.commit()
    return jsonify(plot=p.to_dict()), 201


@bp.get("/plots/<int:pid>")
@login_required
def get_plot(pid):
    p = own_plot(pid)
    return (jsonify(plot=p.to_dict()), 200) if p else (jsonify(error="not_found"), 404)


@bp.put("/plots/<int:pid>")
@login_required
def update_plot(pid):
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    errors = apply_plot(p, request.get_json(silent=True) or {})
    if errors:
        db.session.rollback()
        return jsonify(error="invalid_input", fields=errors), 400
    db.session.commit()
    return jsonify(plot=p.to_dict())


@bp.delete("/plots/<int:pid>")
@login_required
def delete_plot(pid):
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify(ok=True)


# ---- soil tests -------------------------------------------------------------------------------------
@bp.get("/plots/<int:pid>/tests")
@login_required
def list_tests(pid):
    p = own_plot(pid)
    return (jsonify(tests=[t.to_dict() for t in p.tests]), 200) if p else (jsonify(error="not_found"), 404)


@bp.post("/plots/<int:pid>/tests")
@login_required
def add_test(pid):
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    b = request.get_json(silent=True) or {}
    t = SoilTest(plot_id=p.id, date=parse_date(b.get("date"), dt.date.today()), ph=num(b.get("ph")), ec=num(b.get("ec")), n_ppm=num(b.get("n_ppm")),
                 p_ppm=num(b.get("p_ppm")), k_ppm=num(b.get("k_ppm")), om=num(b.get("om")), source=b.get("source") if b.get("source") in ("manual", "extracted") else "manual")
    if all(getattr(t, k) is None for k in ("ph", "ec", "n_ppm", "p_ppm", "k_ppm", "om")):
        return jsonify(error="empty_test"), 400
    db.session.add(t)
    db.session.commit()
    return jsonify(test=t.to_dict()), 201


@bp.delete("/tests/<int:tid>")
@login_required
def delete_test(tid):
    t = db.session.get(SoilTest, tid)
    if not t or not own_plot(t.plot_id):
        return jsonify(error="not_found"), 404
    db.session.delete(t)
    db.session.commit()
    return jsonify(ok=True)


# ---- journal ----------------------------------------------------------------------------------------
KINDS = ("irrigation", "fertilization", "treatment", "observation", "harvest", "expense")


@bp.get("/plots/<int:pid>/journal")
@login_required
def list_journal(pid):
    p = own_plot(pid)
    return (jsonify(entries=[e.to_dict() for e in p.journal]), 200) if p else (jsonify(error="not_found"), 404)


@bp.post("/plots/<int:pid>/journal")
@login_required
def add_journal(pid):
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    b = request.get_json(silent=True) or {}
    if b.get("kind") not in KINDS:
        return jsonify(error="invalid_kind"), 400
    e = JournalEntry(plot_id=p.id, date=parse_date(b.get("date"), dt.date.today()), kind=b["kind"], quantity=num(b.get("quantity")),
                     cost=num(b.get("cost")), note=(b.get("note") or "")[:500])
    db.session.add(e)
    db.session.commit()
    return jsonify(entry=e.to_dict()), 201


@bp.delete("/journal/<int:eid>")
@login_required
def delete_journal(eid):
    e = db.session.get(JournalEntry, eid)
    if not e or not own_plot(e.plot_id):
        return jsonify(error="not_found"), 404
    db.session.delete(e)
    db.session.commit()
    return jsonify(ok=True)
