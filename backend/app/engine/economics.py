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
    weather_yield_m = max(0.5, min(1.0, i.get("weather_yield_m", 1.0)))
    if weather_yield_m < 1.0:
        ym = ym * rng.triangular(weather_yield_m, 1.0, 1.0, n)
    accident_prob = max(0.0, min(1.0, i.get("accident_prob", 0.02)))
    loss_reserve = max(0.0, i.get("loss_reserve", 0.10))
    rev = i["yield_kg_ha"] * i["area_ha"] * i["yield_factor"] * ym * i["price"] * pm
    mg = rev - (i["var_cost_ha"] * i["area_ha"] * vm + i["water_cost"] * wm) - i["fixed_cost"]
    accident_hits = rng.random(n) < accident_prob
    accident_cost = margin * loss_reserve
    mg = mg - accident_hits * accident_cost
    hist, edges = np.histogram(mg, bins=20)
    mean = float(np.mean(mg))
    std = float(np.std(mg))
    prob_profit = float((mg >= 0).mean())
    loss_values = mg[mg < 0]
    expected_shortfall = float(np.mean(loss_values)) if len(loss_values) else 0.0

    # A deterministic 9x9 price/yield sensitivity map uses the same margin formula.
    heatmap = []
    pm_values = [0.70, 0.775, 0.85, 0.925, 1.0, 1.075, 1.15, 1.225, 1.30]
    ym_values = [0.75, 0.800, 0.850, 0.900, 1.0, 1.050, 1.100, 1.125, 1.15]
    for ym_cell in ym_values:
        for pm_cell in pm_values:
            rv, vr, hm = _margin(i, price_m=pm_cell, yield_m=ym_cell)
            heatmap.append({"price_m": round(pm_cell, 3), "yield_m": round(ym_cell, 3), "margin": round(hm)})

    return {
        "revenue": round(revenue), "variable_cost": round(var), "gross_margin": round(margin), "net_result": round(net),
        "breakeven_price": None if be_price is None else round(be_price, 3), "breakeven_yield_kg_ha": None if be_yield is None else round(be_yield, 0),
        "npv": round(npv), "payback_year": payback, "roi_years": None if roi_years is None else round(roi_years, 1),
        "flows": [round(f) for f in flows], "scenarios": scenarios, "tornado": tornado,
        "monte_carlo": {
            "p05": round(float(np.percentile(mg, 5))), "p10": round(float(np.percentile(mg, 10))),
            "p25": round(float(np.percentile(mg, 25))), "p50": round(float(np.percentile(mg, 50))),
            "p75": round(float(np.percentile(mg, 75))), "p90": round(float(np.percentile(mg, 90))),
            "p95": round(float(np.percentile(mg, 95))), "mean": round(mean), "std": round(std),
            "prob_loss": round(float((mg < 0).mean()), 3), "prob_profit": round(prob_profit, 3),
            "loss_margin": round(-expected_shortfall), "accident_prob": round(accident_prob, 3),
            "loss_reserve": round(loss_reserve, 3), "weather_yield_m": round(weather_yield_m, 3), "runs": n,
            "hist": [{"x": round(float((edges[k] + edges[k + 1]) / 2)), "n": int(hist[k])} for k in range(len(hist))],
            "samples": [{"run": j + 1, "margin": round(float(v)), "price_m": round(float(pm[j]), 4), "yield_m": round(float(ym[j]), 4), "water_m": round(float(wm[j]), 4), "var_m": round(float(vm[j]), 4)} for j, v in enumerate(mg)],
            "heatmap": heatmap,
        },
    }
