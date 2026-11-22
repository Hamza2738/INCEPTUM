import datetime as dt

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


def _iso(v):
    return v.isoformat() if v else None


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(300), nullable=False)
    region = db.Column(db.String(2), nullable=False)       # TN or JP
    lang = db.Column(db.String(5), nullable=False, default="en")
    role = db.Column(db.String(20), nullable=False, default="user")
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow)

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

    def to_dict(self):
        return {"id": self.id, "email": self.email, "name": self.name, "region": self.region, "lang": self.lang, "role": self.role, "is_admin": self.role == "admin"}


class Plot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    area_ha = db.Column(db.Float, nullable=False, default=1.0)
    crop_id = db.Column(db.String(40), nullable=False)
    soil_texture = db.Column(db.String(30), nullable=False, default="loam")
    sowing_date = db.Column(db.Date)
    irrigation_type = db.Column(db.String(20), nullable=False, default="drip")
    well_depth_m = db.Column(db.Float, default=50.0)
    pump_eff = db.Column(db.Float, default=0.55)
    water_ec = db.Column(db.Float, default=1.0)          # dS/m
    fert_n_current = db.Column(db.Float, default=0.0)    # kg N/ha per season, farmer's current practice
    greenhouse = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow)
    tests = db.relationship("SoilTest", backref="plot", cascade="all, delete-orphan", order_by="SoilTest.date.desc()")
    journal = db.relationship("JournalEntry", backref="plot", cascade="all, delete-orphan", order_by="JournalEntry.date.desc()")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "lat": self.lat, "lon": self.lon, "area_ha": self.area_ha, "crop_id": self.crop_id,
                "soil_texture": self.soil_texture, "sowing_date": _iso(self.sowing_date), "irrigation_type": self.irrigation_type,
                "well_depth_m": self.well_depth_m, "pump_eff": self.pump_eff, "water_ec": self.water_ec,
                "fert_n_current": self.fert_n_current, "greenhouse": bool(self.greenhouse)}


class SoilTest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plot_id = db.Column(db.Integer, db.ForeignKey("plot.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False)
    ph = db.Column(db.Float)
    ec = db.Column(db.Float)        # ECe, dS/m
    n_ppm = db.Column(db.Float)
    p_ppm = db.Column(db.Float)
    k_ppm = db.Column(db.Float)
    om = db.Column(db.Float)        # organic matter, %
    source = db.Column(db.String(20), default="manual")   # manual | extracted

    def to_dict(self):
        return {"id": self.id, "plot_id": self.plot_id, "date": _iso(self.date), "ph": self.ph, "ec": self.ec, "n_ppm": self.n_ppm,
                "p_ppm": self.p_ppm, "k_ppm": self.k_ppm, "om": self.om, "source": self.source}


class JournalEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plot_id = db.Column(db.Integer, db.ForeignKey("plot.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False)
    kind = db.Column(db.String(20), nullable=False)      # irrigation | fertilization | treatment | observation | harvest | expense
    quantity = db.Column(db.Float)                       # irrigation: m3, fertilization: kg N/ha, harvest: kg
    cost = db.Column(db.Float)
    note = db.Column(db.String(500))

    def to_dict(self):
        return {"id": self.id, "plot_id": self.plot_id, "date": _iso(self.date), "kind": self.kind, "quantity": self.quantity,
                "cost": self.cost, "note": self.note}


class FieldMeasurement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    kind = db.Column(db.String(20), nullable=False)      # ec | moisture | ph
    value = db.Column(db.Float, nullable=False)
    note = db.Column(db.String(200))

    def to_dict(self):
        return {"id": self.id, "lat": self.lat, "lon": self.lon, "date": _iso(self.date), "kind": self.kind, "value": self.value, "note": self.note}


class Scan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    plot_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow)
    crop = db.Column(db.String(60))
    result_json = db.Column(db.Text)
    confirmed = db.Column(db.String(60))

    def to_dict(self):
        import json
        return {"id": self.id, "plot_id": self.plot_id, "created_at": _iso(self.created_at), "crop": self.crop,
                "result": json.loads(self.result_json or "{}"), "confirmed": self.confirmed}
