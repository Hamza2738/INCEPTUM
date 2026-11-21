"""Energy per m3 of irrigation water: pumping, brackish-water RO with blending, and solar payback.
All functions accept numpy arrays so that the same code serves the Monte Carlo analysis."""
import numpy as np

from . import config as C

_RO_X = np.array([x for x, _ in C.RO_CURVE])
_RO_Y = np.array([y for _, y in C.RO_CURVE])


def pumping_kwh_m3(head_m, eff):
    return 0.00272 * np.asarray(head_m) / np.asarray(eff)


def ro_kwh_m3(ecw):
    return np.interp(ecw, _RO_X, _RO_Y)


def blend_fraction(ecw_raw, ecw_target):
    """Share x of the delivered water that must be RO permeate so that the blend reaches the target EC."""
    x = (np.asarray(ecw_raw) - ecw_target) / np.maximum(np.asarray(ecw_raw) - C.PERMEATE_EC, 1e-9)
    return np.clip(x, 0.0, 1.0)


def evaluate(head_m, pump_eff, ecw, ecw_target, annual_m3, peak_m3_day, tariff, capex_per_kw,
             ghi_kwh_m2_year, season_days):
    """Returns a dict of energy, cost and solar payback; every input may be a scalar or an array."""
    head = np.asarray(head_m) + C.PUMP_FRICTION_M
    x = blend_fraction(ecw, ecw_target)
    pump = pumping_kwh_m3(head, pump_eff)
    raw_factor = x / C.RO_RECOVERY + (1.0 - x)           # raw water pumped per m3 delivered
    pump_total = pump * raw_factor
    treat = ro_kwh_m3(ecw) * x
    kwh_m3 = pump_total + treat
    annual_kwh = kwh_m3 * annual_m3
    annual_cost = annual_kwh * tariff
    brine_m3 = annual_m3 * x * (1.0 / C.RO_RECOVERY - 1.0)
    peak_kw = kwh_m3 * peak_m3_day / C.IRRIGATION_HOURS
    pv_kw = C.PV_SIZING * peak_kw
    spec_yield = ghi_kwh_m2_year * C.PV_PR * C.PV_TILT_GAIN          # kWh per kWp per year
    gen_in_season = pv_kw * spec_yield * (season_days / 365.0)
    used = np.minimum(gen_in_season, annual_kwh)
    savings = used * tariff
    capex = pv_kw * capex_per_kw
    payback = np.where(savings > 0, capex / np.maximum(savings, 1e-9) * 12.0, np.inf)
    return {"pump_kwh_m3": pump_total, "treat_kwh_m3": treat, "total_kwh_m3": kwh_m3, "treated_fraction": x,
            "annual_kwh": annual_kwh, "annual_cost": annual_cost, "brine_m3": brine_m3, "pv_kw": pv_kw,
            "capex": capex, "pv_savings": savings, "payback_months": payback, "pv_share": np.where(annual_kwh > 0, used / np.maximum(annual_kwh, 1e-9), 0.0)}
