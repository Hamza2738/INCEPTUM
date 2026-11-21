from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..services import analysis
from .plots import num, own_plot

bp = Blueprint("analysis", __name__, url_prefix="/api")


@bp.get("/plots/<int:pid>/analysis")
@login_required
def get_analysis(pid):
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    return jsonify(analysis.analyze(p, g.user))


@bp.post("/plots/<int:pid>/whatif")
@login_required
def whatif(pid):
    """Course section 4.6: rerun the water balance with a modified scenario.
    Body: delay_days (0-5), rain_factor (0-1.5), dose_factor (0.5-1.2), n_factor (0.5-1.5)."""
    p = own_plot(pid)
    if not p:
        return jsonify(error="not_found"), 404
    b = request.get_json(silent=True) or {}
    w = {"delay_days": int(min(5, max(0, num(b.get("delay_days"), 0)))), "rain_factor": min(1.5, max(0.0, num(b.get("rain_factor"), 1.0))),
         "dose_factor": min(1.2, max(0.5, num(b.get("dose_factor"), 1.0))), "n_factor": min(1.5, max(0.5, num(b.get("n_factor"), 1.0)))}
    base = analysis.analyze(p, g.user, light=True)
    alt = analysis.analyze(p, g.user, whatif=w, light=True)
    pick = lambda a: {"water": a["water"]["summary"], "series": a["water"]["series"], "yield_factor": a["yield_factor"],
                      "n": a["fertilizer"]["sim_current"]["summary"]}
    return jsonify(params=w, base=pick(base), scenario=pick(alt))
