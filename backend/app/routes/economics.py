import datetime as dt

from flask import Blueprint, Response, g, jsonify, request

from ..auth import login_required
from ..engine import config as C
from ..engine import economics
from ..services import analysis, data, workbook
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
    e = reg.get("economics_defaults") or {}
    per = crop["perennial"]
    farm = {"area_ha": e.get("area_ha", 1), "water_cost_ha": e.get("water_cost_ha", 0), "fixed_cost_ha": e.get("fixed_cost_ha", 0),
            "investment_ha": e.get("investment_ha_perennial" if per else "investment_ha_annual", 0),
            "years": e.get("years_perennial" if per else "years_annual", 10), "note": e.get("note", "")}
    return jsonify(defaults=d, farm=farm, discount=C.DISCOUNT[g.user.region], perennial=per, ramp_years=crop["ramp_years"], currency=reg["currency"])


def _inputs(b):
    """Validated simulator inputs from a request body. Returns (inputs, linked, defaults, crop) or None for an unknown crop.
    Body: crop_id, area_ha, yield_kg_ha, price, var_cost_ha, fixed_cost, investment, years, discount, water_cost,
    plot_id (optional, with link=true to apply the plot's salinity and water-stress yield factor and water cost)."""
    reg = data.region(g.user.region)
    cid = b.get("crop_id")
    crop = data.crop(cid)
    if not crop or cid not in reg["crops"]:
        return None
    d = data.economics_defaults(cid, g.user.region)
    yield_factor, water_cost, linked, area = 1.0, num(b.get("water_cost"), 0.0), None, num(b.get("area_ha"), 1.0)
    weather_yield_m = 1.0
    if b.get("plot_id") and b.get("link", True):
        p = own_plot(int(b["plot_id"]))
        if p:
            c = analysis.compact(p, g.user)
            full = analysis.analyze(p, g.user, light=True)
            yield_factor, linked = c["yield_factor"], {"plot": p.name, "yield_factor": c["yield_factor"], "verdict": c["verdict"], "ks_today": c["ks_today"]}
            risks = full.get("risks") or {}
            rain_next3 = (full.get("water") or {}).get("summary", {}).get("rain_next3_mm", 0)
            weather_yield_m = 1.0
            if risks.get("frost") or risks.get("heat"):
                weather_yield_m -= 0.05
            fungal_level = risks.get("fungal_level")
            if fungal_level in ("medium", "high"):
                weather_yield_m -= 0.03 if fungal_level == "medium" else 0.05
            if rain_next3 is not None and rain_next3 >= 8:
                weather_yield_m -= 0.02
            weather_yield_m = max(0.75, weather_yield_m)
            if b.get("water_cost") in (None, ""):
                water_cost = c["water_cost_season"] or 0.0
            area = p.area_ha if b.get("area_ha") in (None, "") else area
    inp = {
        "area_ha": max(area, 0.01), "yield_kg_ha": num(b.get("yield_kg_ha"), d["yield_kg_ha"]) or 0.0, "price": num(b.get("price"), d["price"]) or 0.0,
        "var_cost_ha": num(b.get("var_cost_ha"), d["var_cost_ha"]) or 0.0, "fixed_cost": num(b.get("fixed_cost"), 0.0), "investment": num(b.get("investment"), 0.0),
        "years": int(min(40, max(1, num(b.get("years"), 10)))), "discount": num(b.get("discount"), C.DISCOUNT[g.user.region]),
        "perennial": crop["perennial"], "ramp_years": crop["ramp_years"], "yield_factor": min(1.0, max(0.0, num(b.get("yield_factor"), yield_factor))), "water_cost": water_cost,
        "weather_yield_m": weather_yield_m,
        "accident_prob": max(0.0, min(1.0, num(b.get("accident_prob"), 0.02))),
        "loss_reserve": max(0.0, min(1.0, num(b.get("loss_reserve"), 0.10))),
    }
    return inp, linked, d, crop


@bp.post("/simulate")
@login_required
def simulate():
    parsed = _inputs(request.get_json(silent=True) or {})
    if not parsed:
        return jsonify(error="unknown_crop"), 400
    inp, linked, d, _ = parsed
    out = economics.simulate(inp)
    return jsonify(inputs=inp, result=out, linked=linked, source=d["source"], assumption=d["assumption"], currency=data.region(g.user.region)["currency"])


@bp.post("/workbook")
@login_required
def workbook_xlsx():
    """Same body as /simulate, plus lang. Returns a simple .xlsx profitability workbook with live formulas."""
    b = request.get_json(silent=True) or {}
    parsed = _inputs(b)
    if not parsed:
        return jsonify(error="unknown_crop"), 400
    inp, linked, _, crop = parsed
    reg = data.region(g.user.region)
    lang = b.get("lang") if b.get("lang") in workbook.T else g.user.lang
    crop_name = crop["name"].get(lang) or crop["name"].get("en") if isinstance(crop["name"], dict) else crop["name"]
    xlsx = workbook.build(lang, g.user.name, crop_name, (linked or {}).get("plot"), reg["currency"], inp, economics.simulate(inp))
    fname = f"bilan-{crop['id']}-{dt.date.today().isoformat()}.xlsx"
    return Response(xlsx, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})
