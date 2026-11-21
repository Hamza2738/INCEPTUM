from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..engine import config as C
from ..engine import economics
from ..services import analysis, data
from .plots import num, own_plot

bp = Blueprint("economics", __name__, url_prefix="/api/economics")


@bp.get("/defaults")
@login_required
def defaults():
    cid = request.args.get("crop_id")
    reg = data.region(g.user.region)
    crop = data.crop(cid)
    if not crop or cid not in reg["crops"]:
        return jsonify(error="unknown_crop"), 400
    d = data.economics_defaults(cid, g.user.region)
    return jsonify(defaults=d, discount=C.DISCOUNT[g.user.region], perennial=crop["perennial"], ramp_years=crop["ramp_years"], currency=reg["currency"])


@bp.post("/simulate")
@login_required
def simulate():
    """Body: crop_id, area_ha, yield_kg_ha, price, var_cost_ha, fixed_cost, investment, years, discount, water_cost,
    plot_id (optional, with link=true to apply the plot's salinity and water-stress yield factor and water cost)."""
    b = request.get_json(silent=True) or {}
    reg = data.region(g.user.region)
    cid = b.get("crop_id")
    crop = data.crop(cid)
    if not crop or cid not in reg["crops"]:
        return jsonify(error="unknown_crop"), 400
    d = data.economics_defaults(cid, g.user.region)
    yield_factor, water_cost, linked, area = 1.0, num(b.get("water_cost"), 0.0), None, num(b.get("area_ha"), 1.0)
    if b.get("plot_id") and b.get("link", True):
        p = own_plot(int(b["plot_id"]))
        if p:
            c = analysis.compact(p, g.user)
            yield_factor, linked = c["yield_factor"], {"plot": p.name, "yield_factor": c["yield_factor"], "verdict": c["verdict"], "ks_today": c["ks_today"]}
            if b.get("water_cost") in (None, ""):
                water_cost = c["water_cost_season"] or 0.0
            area = p.area_ha if b.get("area_ha") in (None, "") else area
    inp = {
        "area_ha": max(area, 0.01), "yield_kg_ha": num(b.get("yield_kg_ha"), d["yield_kg_ha"]) or 0.0, "price": num(b.get("price"), d["price"]) or 0.0,
        "var_cost_ha": num(b.get("var_cost_ha"), d["var_cost_ha"]) or 0.0, "fixed_cost": num(b.get("fixed_cost"), 0.0), "investment": num(b.get("investment"), 0.0),
        "years": int(min(40, max(1, num(b.get("years"), 10)))), "discount": num(b.get("discount"), C.DISCOUNT[g.user.region]),
        "perennial": crop["perennial"], "ramp_years": crop["ramp_years"], "yield_factor": min(1.0, max(0.0, num(b.get("yield_factor"), yield_factor))), "water_cost": water_cost,
    }
    out = economics.simulate(inp)
    return jsonify(inputs=inp, result=out, linked=linked, source=d["source"], assumption=d["assumption"], currency=reg["currency"])
