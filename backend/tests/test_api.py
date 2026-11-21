"""End-to-end API tests (offline weather: climatology fallback, no AI key)."""
import io

import numpy as np
import pytest
from PIL import Image

from app import create_app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db = tmp_path_factory.mktemp("db") / "t.db"
    app = create_app({"SQLALCHEMY_DATABASE_URI": f"sqlite:///{db}", "OFFLINE_MODE": True, "TESTING": True, "ANTHROPIC_API_KEY": "", "SEED_DEMO": True})
    return app.test_client()


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200, r.json
    return {"Authorization": "Bearer " + r.json["token"]}


def test_health_and_regions(client):
    assert client.get("/api/health").json["status"] == "ok"
    regs = client.get("/api/regions").json["regions"]
    assert set(regs) == {"TN", "JP"} and regs["JP"]["area_unit"] == "10a" and regs["TN"]["currency"] == "TND"


def test_auth_rules(client):
    assert client.get("/api/plots").status_code == 401
    r = client.post("/api/auth/login", json={"email": "demo.tn@salinityshield.app", "password": "demo1234", "region": "JP"})
    assert r.status_code == 403 and r.json["error"] == "region_mismatch"
    assert client.post("/api/auth/register", json={"email": "bad", "password": "123456", "name": "x", "region": "TN"}).status_code == 400
    r = client.post("/api/auth/register", json={"email": "new@x.com", "password": "secret1", "name": "New", "region": "JP", "lang": "ar"})
    assert r.status_code == 201 and r.json["user"]["lang"] == "ja"       # Arabic is not offered for Japan


@pytest.mark.parametrize("email,expected_crop", [("demo.tn@salinityshield.app", "date_palm"), ("demo.jp@salinityshield.app", "tea")])
def test_analysis_for_each_region(client, email, expected_crop):
    h = login(client, email)
    plots = client.get("/api/plots", headers=h).json["plots"]
    assert len(plots) >= 3 and plots[0]["crop_id"] == expected_crop
    a = client.get(f"/api/plots/{plots[0]['id']}/analysis", headers=h)
    assert a.status_code == 200
    a = a.json
    assert a["water"]["summary"]["today_etc_mm"] > 0
    assert a["salinity"]["verdict"] in ("OK", "RISKY", "NOT_SUITABLE")
    assert a["fertilizer"]["dose"]["mid"] >= 0 and len(a["fertilizer"]["sim_current"]["series"]) == a["fertilizer"]["horizon_days"]
    assert a["energy"]["total_kwh_m3"] > 0 and a["energy"]["bands"]["annual_cost"]["p10"] <= a["energy"]["bands"]["annual_cost"]["p90"]
    assert a["optimizer"]["no_solar"]["feasible"] and a["optimizer"]["no_solar"]["saving_pct"] >= 0
    assert 1 <= len(a["advice"]) <= 3
    assert a["weather"]["source"] == "synthetic-climatology" and any(w["code"] == "weather_synthetic" for w in a["warnings"])


def test_japan_problem_is_nutrients_and_tunisia_problem_is_salt(client):
    jp = login(client, "demo.jp@salinityshield.app")
    tea = client.get("/api/plots", headers=jp).json["plots"][0]
    a = client.get(f"/api/plots/{tea['id']}/analysis", headers=jp).json
    assert a["fertilizer"]["dose"]["mid"] <= 500 and a["fertilizer"]["dose"]["over_pct"] > 50
    assert a["nitrate_limit"] == 10
    tn = login(client, "demo.tn@salinityshield.app")
    tomato = client.get("/api/plots", headers=tn).json["plots"][1]
    s = client.get(f"/api/plots/{tomato['id']}/analysis", headers=tn).json["salinity"]
    assert s["verdict"] != "OK" and s["lr"] is not None


def test_crud_validation_and_ownership(client):
    h = login(client, "demo.tn@salinityshield.app")
    r = client.post("/api/plots", headers=h, json={"name": "T", "lat": 35.0, "lon": 10.0, "area_ha": 2, "crop_id": "olive", "water_ec": 2.0})
    assert r.status_code == 201
    pid = r.json["plot"]["id"]
    assert client.post("/api/plots", headers=h, json={"name": "Out", "lat": 48.8, "lon": 2.3, "crop_id": "olive"}).json["fields"] == ["outside_region"]
    assert client.post("/api/plots", headers=h, json={"name": "Bad", "crop_id": "tea"}).status_code == 400    # tea is a Japanese crop
    t = client.post(f"/api/plots/{pid}/tests", headers=h, json={"ec": 3.1, "n_ppm": 20})
    assert t.status_code == 201
    j = client.post(f"/api/plots/{pid}/journal", headers=h, json={"kind": "irrigation", "quantity": 50})
    assert j.status_code == 201
    other = login(client, "demo.jp@salinityshield.app")
    assert client.get(f"/api/plots/{pid}", headers=other).status_code == 404
    a = client.get(f"/api/plots/{pid}/analysis", headers=h).json
    assert a["latest_test"]["ec"] == 3.1
    assert client.delete(f"/api/plots/{pid}", headers=h).status_code == 200


def test_whatif_delay_increases_stress(client):
    h = login(client, "demo.tn@salinityshield.app")
    pid = client.get("/api/plots", headers=h).json["plots"][1]["id"]
    r = client.post(f"/api/plots/{pid}/whatif", headers=h, json={"delay_days": 5, "rain_factor": 0.0}).json
    assert r["scenario"]["water"]["eta_etc_ratio"] <= r["base"]["water"]["eta_etc_ratio"] + 1e-9


def test_economics_and_link(client):
    h = login(client, "demo.tn@salinityshield.app")
    pid = client.get("/api/plots", headers=h).json["plots"][1]["id"]
    d = client.get("/api/economics/defaults?crop_id=tomato", headers=h).json
    assert d["defaults"]["assumption"] is True
    r = client.post("/api/economics/simulate", headers=h, json={"crop_id": "tomato", "plot_id": pid, "investment": 20000, "years": 8})
    assert r.status_code == 200 and r.json["linked"] and r.json["inputs"]["yield_factor"] < 1.0 + 1e-9
    assert len(r.json["result"]["monte_carlo"]["hist"]) == 20
    assert client.post("/api/economics/simulate", headers=h, json={"crop_id": "tea"}).status_code == 400


def test_dashboard_and_map(client):
    for email, key in (("demo.tn@salinityshield.app", None), ("demo.jp@salinityshield.app", "fertilizer_reduction_pct")):
        h = login(client, email)
        d = client.get("/api/dashboard", headers=h).json
        assert d["totals"]["plots"] >= 3 and (key is None or key in d["totals"])
        m = client.post("/api/map/measurements", headers=h, json={"lat": 33.7, "lon": 8.9, "kind": "ec", "value": 4.4})
        assert m.status_code == 201
        assert len(client.get("/api/map/overview", headers=h).json["measurements"]) >= 1


def test_ai_fallbacks_and_scanner_quality(client):
    h = login(client, "demo.tn@salinityshield.app")
    pid = client.get("/api/plots", headers=h).json["plots"][0]["id"]
    c = client.post("/api/ai/chat", headers=h, json={"plot_id": pid, "message": "Should I irrigate?"}).json
    assert c["llm"] is False and c["advice"]
    adv = client.post("/api/ai/advice", headers=h, json={"plot_id": pid}).json
    assert adv["llm"] is False and adv["advice"]
    def png(arr):
        b = io.BytesIO()
        Image.fromarray(arr.astype("uint8")).save(b, format="PNG")
        b.seek(0)
        return b
    black = png(np.zeros((300, 300, 3)))
    r = client.post("/api/ai/scan", headers=h, data={"file": (black, "x.png")}, content_type="multipart/form-data").json
    assert r["ok"] is False and "too_dark" in r["quality"]["reasons"]
    rng = np.random.default_rng(1)
    leaf = np.zeros((300, 300, 3))
    leaf[..., 1] = 120 + rng.integers(-60, 60, (300, 300))
    leaf[..., 0] = 60 + rng.integers(-20, 20, (300, 300))
    leaf[..., 2] = 40 + rng.integers(-20, 20, (300, 300))
    r = client.post("/api/ai/scan", headers=h, data={"file": (png(leaf), "leaf.png")}, content_type="multipart/form-data").json
    assert r["ok"] is True and r["mode"] == "unconfigured" and r["result"] is None
    assert client.post("/api/ai/extract-lab", headers=h, data={"file": (png(leaf), "lab.png")}, content_type="multipart/form-data").json["mode"] == "unconfigured"
