"""Unit tests of the formulas against hand calculations and published examples (course section 10.1)."""
import datetime as dt
import json
from pathlib import Path

import numpy as np
import pytest

from app.engine import economics, energy, nutrients, optimizer, salinity, water

DATA = Path(__file__).resolve().parent.parent / "data"
CROPS = json.load(open(DATA / "crops.json", encoding="utf-8"))
SOILS = json.load(open(DATA / "soils.json", encoding="utf-8"))


def crop(cid):
    return dict(CROPS[cid], id=cid)


def test_leaching_requirement_course_example():
    # Course 6.3: water at 3 dS/m, crop threshold 2 dS/m -> LR = 3 / (10 - 3) = 0.43
    assert salinity.leaching_requirement(3.0, 2.0) == pytest.approx(3 / 7, rel=1e-6)
    assert salinity.leaching_requirement(10.0, 2.0) is None      # 5*2 - 10 = 0: no solution


def test_maas_hoffman_yield():
    assert salinity.yield_rel(2.0, 2.5, 9.9) == 100
    assert salinity.yield_rel(4.5, 2.5, 9.9) == pytest.approx(100 - 9.9 * 2.0)
    assert salinity.yield_rel(50, 2.5, 9.9) == 0


def test_salinity_assess_verdicts():
    date = crop("date_palm")
    assert salinity.assess(date, 1.0)["verdict"] == "OK"
    s = salinity.assess(crop("tomato"), 4.5)
    assert s["verdict"] in ("RISKY", "NOT_SUITABLE") and s["lr"] is not None
    assert salinity.assess(crop("strawberry"), 6.0)["verdict"] == "NOT_SUITABLE"


def test_taw_raw_fao56():
    taw, raw = water.taw_raw(crop("tomato"), 0.25, 0.12)
    assert taw == pytest.approx(1000 * 0.13 * 0.9)
    assert raw == pytest.approx(0.4 * taw)


def test_kc_curve_annual():
    t = crop("tomato")
    assert water.kc_at(t, 0) == 0.6
    assert water.kc_at(t, 30 + 40) == pytest.approx(1.15)          # start of mid stage
    assert water.kc_at(t, 10_000) == pytest.approx(0.8, abs=0.02)  # clamped to the end of the late stage


def test_water_balance_dry_spell_triggers_irrigation_and_conserves_mass():
    c = crop("tomato")
    today = dt.date(2026, 7, 10)
    days = [{"date": today + dt.timedelta(days=k), "et0": 7.0, "rain": 0.0} for k in range(-14, 16)]
    start = today - dt.timedelta(days=60)
    res = water.run_balance(c, 0.25, 0.12, days, start, today, 0.9)
    s = res["summary"]
    assert s["next_irrigation_date"] is not None
    assert all(0 <= r["dr"] <= res["taw"] for r in res["series"])
    assert 0 <= s["ks_today"] <= 1


def test_water_balance_rain_fills_profile_and_drains():
    c = crop("tomato")
    today = dt.date(2026, 3, 1)
    days = [{"date": today + dt.timedelta(days=k), "et0": 1.0, "rain": 90.0 if k == 2 else 0.0} for k in range(-14, 16)]
    res = water.run_balance(c, 0.25, 0.12, days, today - dt.timedelta(days=30), today, 0.9)
    assert max(r["drain"] for r in res["series"]) > 0


def test_pumping_energy_formula():
    assert float(energy.pumping_kwh_m3(100, 0.5)) == pytest.approx(0.544)


def test_blend_fraction_limits():
    assert float(energy.blend_fraction(1.0, 2.0)) == 0.0          # water already good enough
    assert 0 < float(energy.blend_fraction(4.0, 1.0)) < 1
    assert float(energy.blend_fraction(4.0, 0.0)) == pytest.approx(1.0, abs=0.06)


def test_energy_vectorised_matches_scalar():
    s = energy.evaluate(100, 0.55, 4.0, 1.0, 50_000, 400, 0.3, 2500, 1950, 365)
    v = energy.evaluate(np.array([100.0, 100.0]), 0.55, 4.0, 1.0, 50_000, 400, 0.3, 2500, 1950, 365)
    assert float(v["annual_kwh"][0]) == pytest.approx(float(s["annual_kwh"]))
    assert float(s["total_kwh_m3"]) > float(energy.pumping_kwh_m3(110, 0.55))


def test_fertiliser_dose_and_guideline_cap():
    tea = crop("tea")
    d = nutrients.dose_range(tea, "JP", 55 * 3.9, 5.0, 600)
    assert d["mid"] <= 500 and d["over_pct"] > 0
    olive = nutrients.dose_range(crop("olive"), "TN", 30, 1.5, 90)
    assert olive["mid"] > 0


def test_growth_curve_sums_to_one():
    assert sum(nutrients.growth_curve(365)) == pytest.approx(1.0)


def _sim_ctx(ecw):
    c = crop("tomato")
    return {"crop": c, "fc": 0.25, "wp": 0.12, "eff": 0.9, "ecw": ecw, "today": dt.date(2026, 6, 1), "season_start": dt.date(2026, 5, 15),
            "ece0": 1.0, "dr0": 10.0, "n0": 40.0, "om": 1.5}


def _sim_days(n=120):
    d0 = dt.date(2026, 6, 1)
    return [{"date": d0 + dt.timedelta(days=k), "et0": 6.0, "rain": 0.0, "tmax": 34, "tmin": 20} for k in range(n)]


def test_salt_builds_up_without_leaching_and_drops_with_it():
    no_leach = nutrients.simulate(_sim_ctx(3.5), _sim_days(), {"events": {}, "lf": 0.0})["summary"]
    leach = nutrients.simulate(_sim_ctx(3.5), _sim_days(), {"events": {}, "lf": 0.3})["summary"]
    assert no_leach["ece_end"] > leach["ece_end"]
    assert leach["drain_mm"] > no_leach["drain_mm"]


def test_heavy_fertilisation_leaches_more_nitrate():
    days = _sim_days()
    ctx = _sim_ctx(0.5)
    for d in days[40:44]:
        d["rain"] = 40.0   # a wet spell
    heavy = nutrients.simulate(ctx, days, {"events": {3: 150, 60: 150}, "lf": 0})["summary"]
    smart = nutrients.simulate(ctx, days, {"auto_n": True, "lf": 0})["summary"]
    assert heavy["n_leached"] >= smart["n_leached"]
    assert smart["n_applied"] <= heavy["n_applied"]


def test_economics_hand_calculation_and_npv():
    inp = {"area_ha": 2, "yield_kg_ha": 1000, "price": 3.0, "var_cost_ha": 1000, "fixed_cost": 500, "investment": 4000, "years": 5, "discount": 0.1,
           "perennial": False, "ramp_years": 0, "yield_factor": 1.0, "water_cost": 100}
    r = economics.simulate(inp)
    assert r["revenue"] == 6000 and r["variable_cost"] == 2100 and r["gross_margin"] == 3400
    expected_npv = sum(3400 / 1.1 ** t for t in range(1, 6)) - 4000
    assert r["npv"] == pytest.approx(expected_npv, abs=2)
    assert r["breakeven_price"] == pytest.approx((2100 + 500 + 800) / 2000)
    assert 0 <= r["monte_carlo"]["prob_loss"] <= 1


def test_optimizer_shifts_load_out_of_peak_and_meets_demand():
    tariff = [0.2] * 6 + [0.28] * 12 + [0.4] * 4 + [0.2] * 2
    forbidden = [11, 12, 13, 14, 15]
    for fb in ([], forbidden):
        res = optimizer.optimize([300.0] * 7, 0.8, tariff, [18, 19, 20, 21], 40.0, fb)
        assert res["feasible"]
        assert res["optimized"]["cost"] <= res["baseline"]["cost"] + 1e-6
        x = np.array(res["series"]["x_opt"])
        for d in range(7):
            assert x[24 * d: 24 * d + 24].sum() >= 300 - 1e-3
            assert x[24 * d + 11: 24 * d + 16].sum() < 1e-6 or not fb   # nothing in the forbidden window
