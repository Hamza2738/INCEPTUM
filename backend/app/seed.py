"""Creates two demo accounts (one per country) with demo plots. Disable with SEED_DEMO=0 in production."""
import datetime as dt

from .extensions import db
from .models import JournalEntry, Plot, User
from .routes.plots import create_demo_plots

DEMOS = [
    ("demo.tn@salinityshield.app", "Salah (demo)", "TN", "fr"),
    ("demo.jp@salinityshield.app", "田中 (demo)", "JP", "ja"),
]
PASSWORD = "demo1234"


def seed_demo():
    for email, name, region, lang in DEMOS:
        if User.query.filter_by(email=email).first():
            continue
        u = User(email=email, name=name, region=region, lang=lang)
        u.set_password(PASSWORD)
        db.session.add(u)
        db.session.commit()
        plots = create_demo_plots(u)
        first = Plot.query.get(plots[0].id)
        today = dt.date.today()
        db.session.add_all([
            JournalEntry(plot_id=first.id, date=today - dt.timedelta(days=4), kind="irrigation", quantity=round(first.area_ha * 25, 1), note="demo"),
            JournalEntry(plot_id=first.id, date=today - dt.timedelta(days=20), kind="fertilization", quantity=40, note="demo"),
        ])
        db.session.commit()
