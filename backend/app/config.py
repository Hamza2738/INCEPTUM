import os
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'instance' / 'salinityshield.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DATA_DIR = Path(os.getenv("DATA_DIR", BASE / "data"))
    JWT_HOURS = int(os.getenv("JWT_HOURS", "72"))
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    OFFLINE_MODE = os.getenv("OFFLINE_MODE", "0") == "1"        # never call Open-Meteo, use cache or climatology
    SCANNER_DEMO = os.getenv("SCANNER_DEMO", "0") == "1"        # clearly labelled sample output when no API key
    SEED_DEMO = os.getenv("SEED_DEMO", "1") == "1"              # create two demo accounts with demo plots
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    MAX_CONTENT_LENGTH = 12 * 1024 * 1024
    WEATHER_TTL_S = int(os.getenv("WEATHER_TTL_S", "3600"))
