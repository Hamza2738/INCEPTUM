"""Loads the JSON/CSV files of backend/data. Edit those files, not this code, to change parameters."""
import csv
import json

from flask import current_app

_cache = {}


def _load_json(name):
    path = current_app.config["DATA_DIR"] / name
    stamp = path.stat().st_mtime
    hit = _cache.get(str(path))
    if hit and hit[0] == stamp:
        return hit[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _cache[str(path)] = (stamp, data)
    return data


def regions():
    return _load_json("regions.json")


def region(rid):
    return regions()[rid]


def soils():
    return {k: v for k, v in _load_json("soils.json").items() if not k.startswith("_")}


def _agridata_overrides():
    path = current_app.config["DATA_DIR"] / "agridata" / "yields_prices.csv"
    if not path.exists():
        return {}
    out = {}
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            try:
                out[(row["region"].strip(), row["crop"].strip())] = {
                    "yield": float(row["yield_kg_ha"]), "price": float(row["price_per_kg"]),
                    "var_cost": float(row["var_cost_per_ha"]), "year": row.get("year"), "source": row.get("source")}
            except (KeyError, ValueError):
                continue
    return out


def crops():
    raw = _load_json("crops.json")
    return {k: dict(v, id=k) for k, v in raw.items() if not k.startswith("_")}


def crop(cid):
    return crops().get(cid)


def economics_defaults(cid, region_id):
    """Yield, price and variable cost for a crop in a region. A CSV in data/agridata overrides the assumptions."""
    c = crop(cid)
    ov = _agridata_overrides().get((region_id, cid))
    if ov and ov["yield"] > 0:
        return {"yield_kg_ha": ov["yield"], "price": ov["price"], "var_cost_ha": ov["var_cost"], "source": ov.get("source") or "agridata", "assumption": False}
    return {"yield_kg_ha": c["yield"].get(region_id), "price": c["price"].get(region_id), "var_cost_ha": c["var_cost"].get(region_id),
            "source": "ASSUMPTION (crops.json): replace with official statistics", "assumption": True}


def region_public(rid):
    """Region profile safe to send to the browser, with crop details."""
    r = dict(region(rid))
    all_c = crops()
    r["crop_list"] = [{"id": cid, "name": all_c[cid]["name"], "ece_thr": all_c[cid]["ece_thr"], "perennial": all_c[cid]["perennial"]} for cid in r["crops"]]
    r["soil_list"] = [{"id": k, "name": v["name"]} for k, v in soils().items()]
    return r
