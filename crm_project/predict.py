"""Command-line interface for the lead junk classifier.

Loads ``junk_classifier.joblib`` from this directory and predicts whether a lead
is junk from its four features.

Example:
    python predict.py --source Instagram --has_campaign False \\
        --has_quiz_answers False --matched_at_intake False
"""

import argparse
from pathlib import Path

import joblib
import pandas as pd

MODEL_PATH = Path(__file__).resolve().parent / "junk_classifier.joblib"

FEATURES = ["source", "has_campaign", "has_quiz_answers", "matched_at_intake"]


def _str2bool(value):
    """Parse a CLI string like 'False'/'true'/'1' into a bool."""
    return str(value).strip().lower() in {"1", "true", "yes", "y", "t"}


def predict(model, source, has_campaign, has_quiz_answers, matched_at_intake):
    row = pd.DataFrame([{
        "source": source,
        "has_campaign": bool(has_campaign),
        "has_quiz_answers": bool(has_quiz_answers),
        "matched_at_intake": bool(matched_at_intake),
    }])
    proba = model.predict_proba(row)[0]  # class 0 = clean, class 1 = junk
    return {
        "p_junk": round(float(proba[1]), 4),
        "p_clean": round(float(proba[0]), 4),
        "is_junk": bool(model.predict(row)[0]),
    }


def main():
    parser = argparse.ArgumentParser(description="Predict whether a lead is junk.")
    parser.add_argument("--source", default="Instagram")
    parser.add_argument("--has_campaign", type=_str2bool, default=False)
    parser.add_argument("--has_quiz_answers", type=_str2bool, default=False)
    parser.add_argument("--matched_at_intake", type=_str2bool, default=False)
    args = parser.parse_args()

    if not MODEL_PATH.exists():
        raise SystemExit(f"Model not found: {MODEL_PATH}")

    model = joblib.load(MODEL_PATH)
    result = predict(
        model,
        args.source,
        args.has_campaign,
        args.has_quiz_answers,
        args.matched_at_intake,
    )

    print(f"p_junk : {result['p_junk']}")
    print(f"p_clean: {result['p_clean']}")
    print(f"is_junk: {result['is_junk']}")


if __name__ == "__main__":
    main()
