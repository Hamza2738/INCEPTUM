import datetime as dt

from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import JournalEntry, Plot, SoilTest
from ..services import data

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


def create_demo_plots(user):
    """Create the demo plots of the user's region (with a soil test where the profile has one)."""
    reg = data.region(user.region)
    created = []
    for spec in reg["demo_plots"]:
        s = dict(spec)
        test = s.pop("test", None)
        p = Plot(user_id=user.id, **s)
        db.session.add(p)
        db.session.flush()
        if test:
            db.session.add(SoilTest(plot_id=p.id, date=dt.date.today() - dt.timedelta(days=test["days_ago"]), ph=test["ph"], ec=test["ec"],
                                    n_ppm=test["n_ppm"], om=test["om"], source="demo"))
        created.append(p)
    db.session.commit()
    return created


@bp.post("/plots/demo")
@login_required
def demo_plots():
    return jsonify(plots=[p.to_dict() for p in create_demo_plots(g.user)]), 201


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
