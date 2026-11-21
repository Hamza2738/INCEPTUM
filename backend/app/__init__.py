import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .config import BASE, Config  # noqa: E402
from .extensions import db  # noqa: E402


def create_app(overrides=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    (BASE / "instance").mkdir(exist_ok=True)
    db.init_app(app)
    CORS(app, origins=[o.strip() for o in app.config["CORS_ORIGINS"].split(",")], supports_credentials=False)

    from . import auth
    from .routes import ai, analysis, economics, meta, plots
    for module in (auth, meta, plots, analysis, economics, ai):
        app.register_blueprint(module.bp)

    @app.errorhandler(404)
    def not_found(_):
        return jsonify(error="not_found"), 404

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error="file_too_large"), 413

    @app.errorhandler(500)
    def server_error(exc):
        app.logger.exception(exc)
        return jsonify(error="server_error"), 500

    with app.app_context():
        db.create_all()
        if app.config["SEED_DEMO"]:
            from .seed import seed_demo
            seed_demo()

    # Single-process deployment: serve the built React app if frontend/dist exists.
    dist = Path(os.getenv("FRONTEND_DIST", BASE.parent / "frontend" / "dist"))
    if dist.exists():
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path):
            if path.startswith("api/"):
                return jsonify(error="not_found"), 404
            target = dist / path
            return send_from_directory(dist, path if path and target.is_file() else "index.html")

    return app
