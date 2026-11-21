"""Profitability simulator: margins, break-even, NPV, scenarios, tornado and Monte Carlo (course module 4)."""
import numpy as np


def _ramp(perennial, ramp_years, t):
    if not perennial or ramp_years <= 0:
        return 1.0
    return float(min(1.0, max(0.0, (t - 1) / ramp_years)))


def _margin(i, price_m=1.0, yield_m=1.0, var_m=1.0, water_m=1.0, fixed_m=1.0):
    revenue = i["yield_kg_ha"] * i["area_ha"] * i["yield_factor"] * yield_m * i["price"] * price_m
    var = i["var_cost_ha"] * i["area_ha"] * var_m + i["water_cost"] * water_m
    return revenue, var, revenue - var - i["fixed_cost"] * fixed_m


def simulate(i, seed=42):
    """i: area_ha, yield_kg_ha, price, var_cost_ha, fixed_cost, investment, years, discount, perennial,
    ramp_years, yield_factor, water_cost."""
    revenue, var, margin = _margin(i)
    dep = i["investment"] / max(1, i["years"])
    net = margin - dep
    cost_total = var + i["fixed_cost"] + dep
    prod = i["yield_kg_ha"] * i["area_ha"] * i["yield_factor"]
    be_price = cost_total / prod if prod > 0 else None
    be_yield = cost_total / (i["price"] * i["area_ha"]) if i["price"] > 0 else None
    flows, cum, payback = [], -i["investment"], None
    for t in range(1, i["years"] + 1):
        r = _ramp(i["perennial"], i["ramp_years"], t)
        f = revenue * r - var - i["fixed_cost"]
        flows.append(f)
        cum += f
        if payback is None and cum >= 0:
            payback = t
    npv = sum(f / (1 + i["discount"]) ** (k + 1) for k, f in enumerate(flows)) - i["investment"]
    annual_gain = margin
    roi_years = i["investment"] / annual_gain if i["investment"] > 0 and annual_gain > 0 else None
    scenarios = {}
    for name, pm, ym in (("low", 0.8, 0.85), ("central", 1.0, 1.0), ("high", 1.2, 1.1)):
        rv, vr, mg = _margin(i, price_m=pm, yield_m=ym)
        scenarios[name] = {"revenue": round(rv), "variable_cost": round(vr), "margin": round(mg)}
    tornado = []
    for key, label in (("price_m", "price"), ("yield_m", "yield"), ("var_m", "var_cost"), ("water_m", "water_cost"), ("fixed_m", "fixed_cost")):
        lo = _margin(i, **{key: 0.8})[2]
        hi = _margin(i, **{key: 1.2})[2]
        tornado.append({"driver": label, "low": round(min(lo, hi)), "high": round(max(lo, hi)), "base": round(margin)})
    tornado.sort(key=lambda r: r["high"] - r["low"], reverse=True)
    rng = np.random.default_rng(seed)
    n = 2000
    pm = rng.triangular(0.7, 1.0, 1.3, n)
    ym = rng.triangular(0.75, 1.0, 1.15, n)
    wm = rng.triangular(0.8, 1.0, 1.3, n)
    vm = rng.triangular(0.9, 1.0, 1.15, n)
    rev = i["yield_kg_ha"] * i["area_ha"] * i["yield_factor"] * ym * i["price"] * pm
    mg = rev - (i["var_cost_ha"] * i["area_ha"] * vm + i["water_cost"] * wm) - i["fixed_cost"]
    hist, edges = np.histogram(mg, bins=20)
    return {
        "revenue": round(revenue), "variable_cost": round(var), "gross_margin": round(margin), "net_result": round(net),
        "breakeven_price": None if be_price is None else round(be_price, 3), "breakeven_yield_kg_ha": None if be_yield is None else round(be_yield, 0),
        "npv": round(npv), "payback_year": payback, "roi_years": None if roi_years is None else round(roi_years, 1),
        "flows": [round(f) for f in flows], "scenarios": scenarios, "tornado": tornado,
        "monte_carlo": {"p10": round(float(np.percentile(mg, 10))), "p50": round(float(np.percentile(mg, 50))), "p90": round(float(np.percentile(mg, 90))),
                        "prob_loss": round(float((mg < 0).mean()), 3), "runs": n,
                        "hist": [{"x": round(float((edges[k] + edges[k + 1]) / 2)), "n": int(hist[k])} for k in range(len(hist))]},
    }
