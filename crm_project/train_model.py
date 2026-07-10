# -*- coding: utf-8 -*-
"""Train the lead junk classifier from the CRM database.

Reproduces the model author's methodology:

* Features (exactly four):
    - source            : sources.label via leads.primary_source_id, else "none"
    - has_campaign      : touchpoint raw_payload has a campaign_id that is
                          non-empty and not "--"
    - has_quiz_answers  : touchpoint raw_payload contains either exact intake
                          quiz question key
    - matched_at_intake : the system-ingested create audit event
                          (actor_id IS NULL) linked a non-null establishmentId
* Label: is_junk = leads.junk_reason_id IS NOT NULL
* Exclusions (rows dropped before training):
    - leads in a stage with terminal_type = 'bot'
    - leads in the 'Junk' stage with junk_reason_id IS NULL
* Model: RandomForestClassifier(n_estimators=300, class_weight='balanced',
  random_state=42) with OneHotEncoder on source, passthrough on the booleans.

Run from the crm_project/ directory:

    ../.venv/Scripts/python.exe train_model.py
"""

import json
import sqlite3
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "crm.db"
MODEL_PATH = BASE_DIR / "junk_classifier.joblib"

QUIZ_KEYS = (
    "هل_عندك_فواتير_ضريبية؟",
    "هل_تعاني_من_الإجراء_المحاسبي_والضريبي_في_منشأتك؟",
)
BOOLEAN_FEATURES = ["has_campaign", "has_quiz_answers", "matched_at_intake"]
CATEGORICAL_FEATURES = ["source"]
FEATURE_COLUMNS = BOOLEAN_FEATURES + CATEGORICAL_FEATURES


def load_dataset():
    """Return (features_frame, labels, exclusion_counts) from crm.db."""
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    source_label = dict(conn.execute("SELECT id, label FROM sources"))
    bot_stages = {r[0] for r in conn.execute(
        "SELECT id FROM pipeline_stages WHERE terminal_type = 'bot'")}
    junk_stages = {r[0] for r in conn.execute(
        "SELECT id FROM pipeline_stages WHERE label = 'Junk'")}

    has_campaign, has_quiz = {}, {}
    for lead_id, payload in conn.execute(
        "SELECT lead_id, raw_payload FROM lead_touchpoints WHERE raw_payload IS NOT NULL"
    ):
        try:
            data = json.loads(payload)
        except (TypeError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        cid = data.get("campaign_id") or ""
        if cid and cid not in ("--", ""):
            has_campaign[lead_id] = True
        if any(key in data for key in QUIZ_KEYS):
            has_quiz[lead_id] = True

    matched = set()
    for entity_id, after in conn.execute(
        "SELECT entity_id, after FROM audit_log "
        "WHERE entity_type = 'lead' AND action = 'create' "
        "AND actor_id IS NULL AND after IS NOT NULL"
    ):
        try:
            if json.loads(after).get("establishmentId") is not None:
                matched.add(entity_id)
        except (TypeError, ValueError):
            continue

    rows, labels = [], []
    excluded = {"bot": 0, "junk_no_reason": 0}
    for lead_id, source_id, stage_id, junk_reason in conn.execute(
        "SELECT id, primary_source_id, stage_id, junk_reason_id "
        "FROM leads WHERE deleted_at IS NULL"
    ):
        if stage_id in bot_stages:
            excluded["bot"] += 1
            continue
        if stage_id in junk_stages and junk_reason is None:
            excluded["junk_no_reason"] += 1
            continue
        rows.append({
            "has_campaign": bool(has_campaign.get(lead_id)),
            "has_quiz_answers": bool(has_quiz.get(lead_id)),
            "matched_at_intake": lead_id in matched,
            "source": source_label.get(source_id) or "none",
        })
        labels.append(1 if junk_reason is not None else 0)

    conn.close()
    return pd.DataFrame(rows, columns=FEATURE_COLUMNS), pd.Series(labels, name="is_junk"), excluded


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
    features, target, excluded = load_dataset()
    print(f"Excluded — terminal_type=bot: {excluded['bot']}, "
          f"Junk stage & no reason: {excluded['junk_no_reason']}")
    print(f"Training rows: {len(features)} "
          f"(junk={int(target.sum())}, clean={int((target == 0).sum())})")

    X_train, X_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, stratify=target, random_state=42
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    print(f"\nTrain accuracy: {accuracy_score(y_train, pipeline.predict(X_train)):.4f}")
    print(f"Test  accuracy: {accuracy_score(y_test, predictions):.4f}")
    print(f"Precision: {precision_score(y_test, predictions):.4f}")
    print(f"Recall   : {recall_score(y_test, predictions):.4f}")
    print(f"F1       : {f1_score(y_test, predictions):.4f}")
    print("\nClassification report:")
    print(classification_report(y_test, predictions, target_names=["clean", "junk"]))
    print("Confusion matrix (rows=actual, cols=predicted) [clean, junk]:")
    print(confusion_matrix(y_test, predictions))

    joblib.dump(pipeline, MODEL_PATH)
    print(f"\nSaved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
