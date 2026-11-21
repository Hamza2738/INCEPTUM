"""Salinity assessment: FAO Paper 29 leaching requirement and Maas-Hoffman yield response."""
from . import config as C


def ece_from_ecw(ecw):
    return C.ECE_PER_ECW * ecw


def yield_rel(ece, thr, slope_b):
    """Relative yield (%) at a root-zone salinity ECe (dS/m)."""
    return max(0.0, min(100.0, 100.0 - slope_b * max(0.0, ece - thr)))


def leaching_requirement(ecw, thr):
    """LR = ECw / (5 ECe_thr - ECw). Returns None if 5*thr <= ECw (no solution)."""
    denom = 5.0 * thr - ecw
    if denom <= 0:
        return None
    return ecw / denom


def verdict_from_yield(yr):
    if yr >= C.YIELD_OK:
        return "OK"
    if yr >= C.YIELD_RISKY:
        return "RISKY"
    return "NOT_SUITABLE"


def assess(crop, ecw, candidates=None, ece_measured=None):
    thr, b = crop["ece_thr"], crop["slope_b"]
    ece_est = ece_from_ecw(ecw)
    yr = yield_rel(ece_est, thr, b)
    lr = leaching_requirement(ecw, thr)
    feasible = lr is not None and lr <= C.LEACH_CAP
    verdict = verdict_from_yield(yr)
    if lr is None:
        verdict = "NOT_SUITABLE"
    res = {
        "ecw": round(ecw, 2), "ece_est": round(ece_est, 2), "threshold_ece": thr, "yield_rel": round(yr, 1),
        "verdict": verdict, "lr": None if lr is None else round(lr, 3), "lr_feasible": feasible,
        "extra_water_factor": None if lr is None else round(1 / (1 - lr), 3),
    }
    if ece_measured is not None:
        res["ece_measured"] = ece_measured
        res["yield_rel_measured"] = round(yield_rel(ece_measured, thr, b), 1)
    alts = []
    for cid, c in (candidates or {}).items():
        if cid == crop.get("id"):
            continue
        y = yield_rel(ece_from_ecw(ecw), c["ece_thr"], c["slope_b"])
        alts.append((y, c["ece_thr"], cid))
    alts.sort(reverse=True)
    res["alternatives"] = [{"crop_id": cid, "yield_rel": round(y, 1)} for y, _, cid in alts if y >= C.YIELD_OK][:3]
    return res


def target_ecw(thr, lr=None):
    """Irrigation water EC that keeps LR at the target value (blending target)."""
    lr = C.TARGET_LR if lr is None else lr
    return 5.0 * thr * lr / (1.0 + lr)
