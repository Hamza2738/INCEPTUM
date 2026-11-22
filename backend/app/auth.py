import datetime as dt
import re
import uuid
from functools import wraps

import jwt
from flask import Blueprint, current_app, g, jsonify, request

from .extensions import db
from .models import User
from .services import data

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def make_token(user):
    now = dt.datetime.now(dt.timezone.utc)
    exp = now + dt.timedelta(hours=current_app.config["JWT_HOURS"])
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": exp,
        "jti": str(uuid.uuid4()),
        "role": getattr(user, "role", "user") or "user",
        "region": user.region,
        "iss": "salinityshield",
        "aud": "salinityshield-web",
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify(error="auth_required"), 401
        try:
            payload = jwt.decode(
                header[7:],
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"],
                issuer="salinityshield",
                audience="salinityshield-web",
            )
            user = db.session.get(User, int(payload["sub"]))
        except (jwt.PyJWTError, ValueError, KeyError):
            return jsonify(error="invalid_token"), 401
        if user is None:
            return jsonify(error="invalid_token"), 401
        g.user = user
        return fn(*args, **kwargs)
    return wrapper


@bp.post("/register")
def register():
    b = request.get_json(silent=True) or {}
    email = (b.get("email") or "").strip().lower()
    name = (b.get("name") or "").strip()
    password = b.get("password") or ""
    region = b.get("region")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify(error="invalid_email"), 400
    if len(password) < 6:
        return jsonify(error="weak_password"), 400
    if not name or region not in data.regions():
        return jsonify(error="invalid_input"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="email_taken"), 409
    reg = data.region(region)
    lang = b.get("lang") if b.get("lang") in reg["languages"] else reg["default_lang"]
    user = User(email=email, name=name, region=region, lang=lang)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(token=make_token(user), user=user.to_dict()), 201


@bp.post("/login")
def login():
    b = request.get_json(silent=True) or {}
    user = User.query.filter_by(email=(b.get("email") or "").strip().lower()).first()
    if not user or not user.check_password(b.get("password") or ""):
        return jsonify(error="bad_credentials"), 401
    if b.get("region") and b["region"] != user.region:
        return jsonify(error="region_mismatch", region=user.region), 403
    return jsonify(token=make_token(user), user=user.to_dict())


@bp.get("/me")
@login_required
def me():
    return jsonify(user=g.user.to_dict())


@bp.put("/me")
@login_required
def update_me():
    b = request.get_json(silent=True) or {}
    reg = data.region(g.user.region)
    if b.get("lang") in reg["languages"]:
        g.user.lang = b["lang"]
    if b.get("name"):
        g.user.name = b["name"].strip()[:120]
    db.session.commit()
    return jsonify(user=g.user.to_dict())
