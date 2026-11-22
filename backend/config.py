import os
from pathlib import Path

BASE = Path(__file__).resolve().parent


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'instance' / 'salinityshield.db'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DATA_DIR = Path(os.getenv("DATA_DIR", BASE / "data"))
    JWT_HOURS = int(os.getenv("JWT_HOURS", "72"))
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    OFFLINE_MODE = os.getenv("OFFLINE_MODE", "0") == "1"        # never call Open-Meteo, use cache or climatology
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    MAX_CONTENT_LENGTH = 12 * 1024 * 1024
    WEATHER_TTL_S = int(os.getenv("WEATHER_TTL_S", "3600"))
