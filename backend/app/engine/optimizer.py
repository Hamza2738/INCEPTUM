"""Cheapest pumping schedule over a week: linear programme (HiGHS) over tariff hours and a PV profile."""
import numpy as np
from scipy.optimize import linprog

from . import config as C


def _grid_cost(x, kwh_m3, tariff24, pv_kw_hourly):
    energy = kwh_m3 * x
    grid = np.maximum(0.0, energy - pv_kw_hourly)
    price = np.tile(np.asarray(tariff24, dtype=float), len(x) // 24)
    return grid, float((grid * price).sum())


def optimize(need_m3_by_day, kwh_m3, tariff24, peak_hours, pv_kw, forbidden=()):
    n_days = len(need_m3_by_day)
    T = 24 * n_days
    need = np.asarray(need_m3_by_day, dtype=float)
    pv = np.tile(np.array(C.PV_HOURLY_CF) * pv_kw, n_days)
    forbidden = set(forbidden)
    allowed = [h for h in range(24) if h not in forbidden]
    price = np.tile(np.asarray(tariff24, dtype=float), n_days)
    # baseline: need spread evenly over BASELINE_HOURS
    base_x = np.zeros(T)
    base_hours = [h for h in C.BASELINE_HOURS if h not in forbidden]
    cap = max(1.5 * need.max() / len(base_hours), 1e-6) if need.max() > 0 else 1.0   # pump rate = 1.5 x what the current habit needs
    for d in range(n_days):
        for h in base_hours:
            base_x[24 * d + h] = need[d] / len(base_hours)
    base_grid, base_cost = _grid_cost(base_x, kwh_m3, tariff24, pv)
    if need.sum() <= 0:
        return {"feasible": True, "empty": True}
    # variables: x[0..T-1] m3 per hour, g[0..T-1] grid kWh per hour
    c = np.concatenate([np.zeros(T), price])
    A = np.zeros((T + n_days, 2 * T))
    b = np.zeros(T + n_days)
    for t in range(T):                       # kwh*x - g <= pv
        A[t, t], A[t, T + t], b[t] = kwh_m3, -1.0, pv[t]
    for d in range(n_days):                  # sum x >= need
        A[T + d, 24 * d: 24 * d + 24] = -1.0
        b[T + d] = -need[d]
    bounds = [(0, 0 if (t % 24) in forbidden else cap) for t in range(T)] + [(0, None)] * T
    res = linprog(c, A_ub=A, b_ub=b, bounds=bounds, method="highs")
    if not res.success:
        return {"feasible": False, "message": res.message}
    x = res.x[:T]
    grid, cost = _grid_cost(x, kwh_m3, tariff24, pv)
    peak = set(peak_hours)
    peak_mask = np.array([(t % 24) in peak for t in range(T)])
    out = {
        "feasible": True, "empty": False, "cap_m3h": round(cap, 2),
        "baseline": {"cost": round(base_cost, 2), "kwh_grid": round(float(base_grid.sum()), 1),
                     "kwh_peak": round(float(base_grid[peak_mask].sum()), 1), "peak_kw": round(float(base_grid.max()), 1)},
        "optimized": {"cost": round(cost, 2), "kwh_grid": round(float(grid.sum()), 1),
                      "kwh_peak": round(float(grid[peak_mask].sum()), 1), "peak_kw": round(float(grid.max()), 1)},
        "series": {"hour": list(range(T)), "x_base": [round(float(v), 2) for v in base_x], "x_opt": [round(float(v), 2) for v in x],
                   "grid_base": [round(float(v), 2) for v in base_grid], "grid_opt": [round(float(v), 2) for v in grid],
                   "pv": [round(float(v), 2) for v in pv], "price": [float(v) for v in price]},
    }
    out["saving_pct"] = round(100.0 * (base_cost - cost) / base_cost, 1) if base_cost > 0 else 0.0
    return out
