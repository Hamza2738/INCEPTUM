"""Measure how well the lab-report extractor reads real reports.

Usage (from the backend folder, with ANTHROPIC_API_KEY set in .env):
    python scripts/eval_extraction.py

Put report photos or PDFs in data/lab_samples/ and describe the true values in
data/lab_samples/expected.json, for example:
    {"report_01.jpg": {"ph": 7.9, "ec": 4.2, "n_ppm": 18, "om": 1.0}}
Only the fields you list are scored. EC in dS/m, N in mg/kg, organic matter in %.

The script prints per-field accuracy and an overall "X/N values correct" line. Quote that number
honestly in your pitch, with the number of reports it was measured on.
"""
import json
import mimetypes
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from app import create_app  # noqa: E402
from app.services import llm, scanner  # noqa: E402

SAMPLES = ROOT / "data" / "lab_samples"
# A value counts as correct when it is within max(abs_tol, rel_tol * truth)
TOL = {"ph": (0.15, 0.0), "ec": (0.1, 0.05), "n_ppm": (1.0, 0.05), "p_ppm": (1.0, 0.05), "k_ppm": (2.0, 0.05), "om": (0.1, 0.05)}


def close(field, got, truth):
    if got is None:
        return False
    abs_tol, rel_tol = TOL.get(field, (0.0, 0.05))
    return abs(float(got) - float(truth)) <= max(abs_tol, rel_tol * abs(float(truth)))


def main():
    app = create_app({"SEED_DEMO": False})
    exp_file = SAMPLES / "expected.json"
    if not exp_file.exists():
        print(f"Missing {exp_file}. See the docstring of this script for the format.")
        return 1
    expected = json.loads(exp_file.read_text(encoding="utf-8"))
    with app.app_context():
        if not llm.available():
            print("No ANTHROPIC_API_KEY configured: cannot run the extractor.")
            return 1
        total = correct = unreadable_ok = 0
        per_field = {}
        for name, truth in expected.items():
            path = SAMPLES / name
            if not path.exists():
                print(f"  skip {name}: file not found")
                continue
            mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
            raw = path.read_bytes()
            try:
                if mime != "application/pdf":
                    raw, mime = scanner.prepare(raw, max_side=1800)[0], "image/jpeg"
                result = llm.extract_lab(raw, mime)
            except Exception as exc:  # noqa: BLE001
                print(f"  {name}: extraction failed ({exc})")
                total += len(truth)
                for f in truth:
                    per_field.setdefault(f, [0, 0])[1] += 1
                continue
            vals = result.get("values", {})
            line = []
            for field, true_v in truth.items():
                got = (vals.get(field) or {}).get("v")
                ok = close(field, got, true_v)
                total += 1
                correct += int(ok)
                per_field.setdefault(field, [0, 0])
                per_field[field][0] += int(ok)
                per_field[field][1] += 1
                line.append(f"{field}={got} ({'ok' if ok else 'WRONG, truth ' + str(true_v)})")
            print(f"  {name}: " + ", ".join(line))
        print()
        for field, (ok, n) in sorted(per_field.items()):
            print(f"  {field:6s} {ok}/{n}")
        print(f"\nExtraction accuracy: {correct}/{total} values correct on {len(expected)} reports")
        print("Tolerances: " + ", ".join(f"{k} ±{max(a, 0)}/{int(r * 100)}%" for k, (a, r) in TOL.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
