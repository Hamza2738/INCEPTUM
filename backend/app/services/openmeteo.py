"""Open-Meteo connector with a file cache and an honest offline fallback.

Order: fresh cache -> live API -> stale cache -> synthetic climatology. The `source` and `stale`
fields are returned to the UI so a number is never shown without its origin.
"""
import datetime as dt
import json
import math
import random
import time

import requests
from flask import current_app

FORECAST = "https://api.open-meteo.com/v1/forecast"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
_mem = {}


def _path(kind, lat, lon):
    d = current_app.config["DATA_DIR"] / "weather_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{kind}_{lat:.2f}_{lon:.2f}.json"


# ---- synthetic climatology (fallback only, clearly labelled) -----------------------------------
def climate_class(lat, lon):
    if lon > 100:
        return "jp"
    return "tn_arid" if lat < 35.3 else "tn_north"


_CLIM = {  # ASSUMPTION: rough monthly-cycle parameters
    "tn_arid": dict(t=21.0, amp=11.0, dtr=14.0, et0=4.4, et0amp=3.0, p=0.05, mean_rain=7.0, rh=42, rhamp=-12, winter_rain=True),
    "tn_north": dict(t=18.0, amp=8.0, dtr=10.0, et0=3.3, et0amp=2.2, p=0.16, mean_rain=8.0, rh=64, rhamp=-10, winter_rain=True),
    "jp": dict(t=15.0, amp=11.0, dtr=8.0, et0=2.6, et0amp=1.9, p=0.32, mean_rain=13.0, rh=70, rhamp=8, winter_rain=False),
}


def climatology(lat, lon, date):
    k = _CLIM[climate_class(lat, lon)]
    doy = date.timetuple().tm_yday
    phase = math.sin(2 * math.pi * (doy - 80) / 365.0)
    rng = random.Random(f"{round(lat, 1)}{round(lon, 1)}{date.toordinal()}")
    tmean = k["t"] + k["amp"] * phase
    p = k["p"] * (1 - 0.6 * phase) if k["winter_rain"] else k["p"] * (1 + 0.3 * phase)
    rain = rng.expovariate(1.0 / k["mean_rain"]) if rng.random() < p else 0.0
    return {"date": date, "tmax": round(tmean + k["dtr"] / 2, 1), "tmin": round(tmean - k["dtr"] / 2, 1), "rain": round(rain, 1),
            "et0": round(max(0.4, k["et0"] + k["et0amp"] * phase), 2), "rh": round(k["rh"] + k["rhamp"] * phase, 0),
            "rad": round(max(4.0, 16 + 9 * phase), 1), "kind": "climatology"}


# ---- live API ---------------------------------------------------------------------------------
def _fetch(lat, lon, past_days, forecast_days):
    base = {"latitude": round(lat, 4), "longitude": round(lon, 4), "timezone": "auto", "past_days": past_days, "forecast_days": forecast_days}
    core = "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum"
    for extra in (",relative_humidity_2m_mean", ""):
        r = requests.get(FORECAST, params=dict(base, daily=core + extra), timeout=8)
        if r.status_code == 400 and extra:
            continue
        r.raise_for_status()
        return r.json()["daily"]
    raise RuntimeError("Open-Meteo unavailable")


def _parse(daily, lat, lon):
    out = []
    t = daily["time"]
    for i, ds in enumerate(t):
        date = dt.date.fromisoformat(ds)
        clim = climatology(lat, lon, date)

        def v(key, fallback):
            arr = daily.get(key)
            return fallback if not arr or arr[i] is None else arr[i]
        out.append({"date": date.isoformat(), "tmax": v("temperature_2m_max", clim["tmax"]), "tmin": v("temperature_2m_min", clim["tmin"]),
                    "rain": v("precipitation_sum", 0.0), "et0": v("et0_fao_evapotranspiration", clim["et0"]),
                    "rh": (daily.get("relative_humidity_2m_mean") or [None] * len(t))[i], "rad": v("shortwave_radiation_sum", clim["rad"]), "kind": "forecast"})
    return out


def _materialize(rows):
    return [dict(r, date=dt.date.fromisoformat(r["date"])) if isinstance(r["date"], str) else r for r in rows]


def get_weather(lat, lon, past_days=14, forecast_days=16):
    """Returns {source, fetched_at, stale, days:[{date,tmax,tmin,rain,et0,rh,rad,kind}]}."""
    key = (round(lat, 2), round(lon, 2))
    ttl = current_app.config["WEATHER_TTL_S"]
    now = time.time()
    hit = _mem.get(key)
    if hit and now - hit["ts"] < ttl:
        return dict(hit["data"], days=_materialize(hit["data"]["days"]))
    path = _path("w", *key)
    cached = None
    if path.exists():
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            cached = None
    if cached and now - cached["ts"] < ttl:
        _mem[key] = cached
        return dict(cached["data"], days=_materialize(cached["data"]["days"]))
    if not current_app.config["OFFLINE_MODE"]:
        try:
            rows = _parse(_fetch(lat, lon, past_days, forecast_days), lat, lon)
            data = {"source": "open-meteo", "fetched_at": dt.datetime.utcnow().isoformat() + "Z", "stale": False, "days": rows}
            blob = {"ts": now, "data": data}
            _mem[key] = blob
            path.write_text(json.dumps(blob), encoding="utf-8")
            return dict(data, days=_materialize(rows))
        except Exception as exc:  # network down, blocked, quota, parse error
            current_app.logger.warning("Open-Meteo failed: %s", exc)
    if cached:
        data = dict(cached["data"], stale=True)
        return dict(data, days=_materialize(data["days"]))
    today = dt.date.today()
    rows = [dict(climatology(lat, lon, today + dt.timedelta(days=d)), date=today + dt.timedelta(days=d)) for d in range(-past_days, forecast_days)]
    return {"source": "synthetic-climatology", "fetched_at": None, "stale": True, "days": rows}


def horizon_days(weather, today, n, lat, lon):
    """n days starting today: forecast first, then climatology. Each day carries `kind`."""
    by_date = {r["date"]: r for r in weather["days"]}
    out = []
    for k in range(n):
        d = today + dt.timedelta(days=k)
        out.append(by_date.get(d) or dict(climatology(lat, lon, d), date=d))
    return out


def annual_ghi(lat, lon, fallback):
    """Global horizontal irradiation, kWh/m2/year, from the Open-Meteo archive (cached 30 days)."""
    path = _path("ghi", round(lat, 2), round(lon, 2))
    if path.exists():
        try:
            blob = json.loads(path.read_text(encoding="utf-8"))
            if time.time() - blob["ts"] < 30 * 86400:
                return blob["data"]
        except ValueError:
            pass
    if not current_app.config["OFFLINE_MODE"]:
        try:
            end = dt.date.today() - dt.timedelta(days=7)
            r = requests.get(ARCHIVE, params={"latitude": round(lat, 3), "longitude": round(lon, 3), "start_date": (end - dt.timedelta(days=364)).isoformat(),
                                              "end_date": end.isoformat(), "daily": "shortwave_radiation_sum", "timezone": "auto"}, timeout=10)
            r.raise_for_status()
            vals = [v for v in r.json()["daily"]["shortwave_radiation_sum"] if v is not None]
            if len(vals) > 300:
                data = {"kwh_m2_year": round(sum(vals) / len(vals) * 365 / 3.6, 0), "source": "open-meteo-archive"}
                path.write_text(json.dumps({"ts": time.time(), "data": data}), encoding="utf-8")
                return data
        except Exception as exc:
            current_app.logger.warning("Open-Meteo archive failed: %s", exc)
    return {"kwh_m2_year": fallback, "source": "region-fallback (ASSUMPTION)"}
