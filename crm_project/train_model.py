"""Train the lead junk classifier from the CRM database.

Reads leads from ``crm.db``, derives the four features the model uses
(``source``, ``has_campaign``, ``has_quiz_answers``, ``matched_at_intake``),
trains a RandomForest, saves it to ``junk_classifier.joblib`` and prints
evaluation metrics.

Run from the crm_project/ directory:

    ../.venv/Scripts/python.exe train_model.py

NOTE ON FEATURE DERIVATION
--------------------------
The original training pipeline is not available in this repo, so the SQL below
is a best-effort reconstruction of the four features from the current schema.
Review these definitions against how the shipped model was trained before you
rely on a retrained model:

* source            -> sources.label joined via leads.primary_source_id
* has_campaign      -> the lead has a touchpoint carrying a campaign_id
* has_quiz_answers  -> a touchpoint raw_payload mentions quiz/question/answer data
* matched_at_intake -> the lead was linked to a known referrer at intake
* label (is_junk)   -> leads.junk_reason_id IS NOT NULL
"""

from pathlib import Path

import joblib
import pandas as pd
import sqlite3
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "crm.db"
MODEL_PATH = BASE_DIR / "junk_classifier.joblib"

FEATURE_QUERY = """
SELECT
    COALESCE(s.label, 'Unknown') AS source,
    CASE WHEN EXISTS (
        SELECT 1 FROM lead_touchpoints tp
        WHERE tp.lead_id = l.id AND tp.campaign_id IS NOT NULL
    ) THEN 1 ELSE 0 END AS has_campaign,
    CASE WHEN EXISTS (
        SELECT 1 FROM lead_touchpoints tp
        WHERE tp.lead_id = l.id
          AND tp.raw_payload IS NOT NULL
          AND (
              tp.raw_payload LIKE '%answer%'
              OR tp.raw_payload LIKE '%question%'
              OR tp.raw_payload LIKE '%quiz%'
          )
    ) THEN 1 ELSE 0 END AS has_quiz_answers,
    CASE WHEN (
        l.referrer_contact_id IS NOT NULL
        OR l.referrer_employee_id IS NOT NULL
    ) THEN 1 ELSE 0 END AS matched_at_intake,
    CASE WHEN l.junk_reason_id IS NOT NULL THEN 1 ELSE 0 END AS is_junk
FROM leads l
LEFT JOIN sources s ON s.id = l.primary_source_id
WHERE l.deleted_at IS NULL
"""

BOOLEAN_FEATURES = ["has_campaign", "has_quiz_answers", "matched_at_intake"]
CATEGORICAL_FEATURES = ["source"]
FEATURE_COLUMNS = CATEGORICAL_FEATURES + BOOLEAN_FEATURES


def load_dataset():
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")
    with sqlite3.connect(DB_PATH) as conn:
        frame = pd.read_sql_query(FEATURE_QUERY, conn)
    # Match the dtypes the served model expects: booleans, not 0/1 ints.
    for column in BOOLEAN_FEATURES:
        frame[column] = frame[column].astype(bool)
    return frame


def build_pipeline():
    preprocessor = ColumnTransformer(
        transformers=[
            ("source", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ],
        remainder="passthrough",
    )
    classifier = RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        random_state=42,
    )
    return Pipeline([("preprocess", preprocessor), ("model", classifier)])


def main():
    frame = load_dataset()
    print(f"Loaded {len(frame)} leads from {DB_PATH.name}")
    print("Label balance (is_junk):")
    print(frame["is_junk"].value_counts().rename({0: "clean", 1: "junk"}).to_string())
    print()

    features = frame[FEATURE_COLUMNS]
    target = frame["is_junk"]

    X_train, X_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, stratify=target, random_state=42
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    probabilities = pipeline.predict_proba(X_test)[:, 1]

    print(f"Accuracy : {accuracy_score(y_test, predictions):.4f}")
    print(f"ROC-AUC  : {roc_auc_score(y_test, probabilities):.4f}")
    print()
    print("Classification report:")
    print(classification_report(y_test, predictions, target_names=["clean", "junk"]))
    print("Confusion matrix (rows=actual, cols=predicted) [clean, junk]:")
    print(confusion_matrix(y_test, predictions))

    joblib.dump(pipeline, MODEL_PATH)
    print(f"\nSaved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
