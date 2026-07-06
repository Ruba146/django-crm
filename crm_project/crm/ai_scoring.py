from datetime import date, datetime


class AIScoringService:
    POSITIVE_KEYWORDS = (
        "reply",
        "replied",
        "pricing",
        "quote",
        "quotation",
        "meeting",
        "demo",
        "interested",
        "follow up",
        "follow-up",
        "followup",
        "proposal",
        "confirmed",
        "schedule",
        "scheduled",
        "positive",
        "ready",
        "yes",
        "buy",
        "purchase",
        "qualified",
        "engaged",
        "call back",
        "call-back",
        "callback",
        "discuss",
        "requested",
        "available",
        "attended",
    )

    NEGATIVE_KEYWORDS = (
        "no response",
        "no reply",
        "missed",
        "missed call",
        "not interested",
        "unreachable",
        "busy",
        "cancelled",
        "negative",
        "declined",
        "postponed",
        "not now",
        "ignore",
        "ignored",
        "stopped",
        "drop",
        "dropped",
        "unable",
        "late",
        "didn't answer",
        "did not answer",
        "no engagement",
    )

    @classmethod
    def build_payload(cls, cursor, entity_type, entity_id, stage_history=None):
        payload = {
            "activities": [],
            "notes": [],
            "tasks": [],
            "emails": [],
            "messages": [],
            "meetings": [],
            "last_activity_date": None,
            "stage_history": list(stage_history or []),
        }
        entity_type = (entity_type or "").strip().lower()
        entity_id = str(entity_id or "")
        if not cursor or not entity_type or not entity_id:
            return payload

        targets = [(entity_type, entity_id)]
        if entity_type == "deal":
            try:
                cursor.execute("SELECT lead_id, contact_id FROM deals WHERE CAST(id AS TEXT) = ? AND deleted_at IS NULL", (entity_id,))
                related_row = cursor.fetchone()
                if related_row:
                    related_row = dict(related_row)
                    for related_entity_type, related_entity_value in (("lead", related_row.get("lead_id")), ("contact", related_row.get("contact_id"))):
                        related_id = str(related_entity_value or "")
                        if related_id and (related_entity_type, related_id) not in targets:
                            targets.append((related_entity_type, related_id))
            except Exception:
                pass

        seen_targets = set()
        for target_entity_type, target_entity_id in targets:
            target_key = (target_entity_type, str(target_entity_id or ""))
            if not target_entity_id or target_key in seen_targets:
                continue
            seen_targets.add(target_key)
            for table_name in ("activities", "notes", "tasks"):
                try:
                    cursor.execute(
                        f"SELECT * FROM {table_name} WHERE LOWER(entity_type) = LOWER(?) AND CAST(entity_id AS TEXT) = ? ORDER BY rowid DESC",
                        (target_entity_type, target_entity_id),
                    )
                except Exception:
                    continue
                for row in cursor.fetchall():
                    row_dict = dict(row)
                    if table_name == "activities":
                        payload["activities"].append(row_dict)
                    elif table_name == "notes":
                        payload["notes"].append(row_dict)
                    else:
                        payload["tasks"].append(row_dict)

        for section_name in ("activities", "notes", "tasks"):
            for item in payload.get(section_name, []):
                for field_name in ("occurred_at", "created_at", "updated_at", "due_at"):
                    value = item.get(field_name)
                    if not value:
                        continue
                    try:
                        if isinstance(value, datetime):
                            candidate_date = value.date()
                        else:
                            candidate_date = datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
                        if payload["last_activity_date"] is None or candidate_date > payload["last_activity_date"]:
                            payload["last_activity_date"] = candidate_date
                    except Exception:
                        continue

        if not payload["last_activity_date"]:
            payload["last_activity_date"] = date.today()
        return payload

    @classmethod
    def score(cls, payload):
        payload = payload or {}
        text_parts = []
        reasons = []

        for section_name in ("activities", "notes", "tasks", "emails", "messages", "meetings"):
            items = payload.get(section_name) or []
            for item in items:
                if not isinstance(item, dict):
                    continue
                text_value = " ".join(
                    str(item.get(field) or "")
                    for field in ("body", "description", "title", "text", "outcome", "note", "subject", "content")
                )
                if text_value:
                    text_parts.append(text_value)

        normalized_text = " ".join(text_parts).lower()
        score = 50

        positive_hits = []
        negative_hits = []

        for keyword in cls.POSITIVE_KEYWORDS:
            if keyword in normalized_text:
                positive_hits.append(keyword)
                score += 8

        for keyword in cls.NEGATIVE_KEYWORDS:
            if keyword in normalized_text:
                negative_hits.append(keyword)
                score -= 10

        activity_count = len(payload.get("activities") or [])
        note_count = len(payload.get("notes") or [])
        task_count = len(payload.get("tasks") or [])
        if activity_count > 0:
            score += min(10, activity_count * 2)
            positive_hits.append("activity history")
        if note_count > 0:
            score += min(6, note_count)
            positive_hits.append("notes")
        if task_count > 0:
            score += min(6, task_count)
            positive_hits.append("tasks")

        last_activity_date = payload.get("last_activity_date")
        if last_activity_date:
            try:
                if isinstance(last_activity_date, datetime):
                    last_date = last_activity_date.date()
                else:
                    last_date = datetime.fromisoformat(str(last_activity_date).replace("Z", "+00:00")).date()
                days_since = (date.today() - last_date).days
                if days_since <= 3:
                    score += 12
                    positive_hits.append("recent engagement")
                elif days_since <= 7:
                    score += 5
                    positive_hits.append("recent follow-up")
                elif days_since <= 14:
                    score -= 3
                    negative_hits.append("stale engagement")
                else:
                    score -= 8
                    negative_hits.append("long inactivity")
            except Exception:
                pass

        stage_history = payload.get("stage_history") or []
        normalized_stages = [str(stage).strip().lower() for stage in stage_history if str(stage or "").strip()]
        if any(stage in normalized_stages for stage in ("qualified", "proposal", "demo", "meeting", "negotiation", "won", "closed")):
            score += 8
            positive_hits.append("stage progression")
        if any(stage in normalized_stages for stage in ("new", "lead", "prospect")):
            score += 0

        if positive_hits and not negative_hits and score < 80:
            score += 4
        if negative_hits and not positive_hits:
            score = max(10, score - 8)

        score = max(0, min(100, score))

        if score >= 80:
            confidence = "High"
        elif score >= 60:
            confidence = "Medium"
        else:
            confidence = "Low"

        if positive_hits:
            if any(keyword in {"reply", "replied", "pricing", "quote", "quotation", "meeting", "demo", "proposal", "requested", "interested", "ready", "buy", "purchase"} for keyword in positive_hits):
                reasons.append("Customer showed clear buying intent through recent engagement.")
            if any(keyword in {"pricing", "quote", "quotation", "proposal"} for keyword in positive_hits):
                reasons.append("Asked about pricing or a proposal.")
            if any(keyword in {"meeting", "demo", "attended"} for keyword in positive_hits):
                reasons.append("Completed a meeting or demo.")
            if len(positive_hits) >= 3:
                reasons.append("Multiple positive interactions were recorded.")
            if any(keyword == "recent engagement" for keyword in positive_hits):
                reasons.append("Recent activity indicates active conversation.")
        if negative_hits:
            if any(keyword in {"long inactivity", "stale engagement"} for keyword in negative_hits):
                reasons.append("No response or long inactivity was detected.")
            if any(keyword in {"missed", "missed call"} for keyword in negative_hits):
                reasons.append("Missed follow-up or missed contact activity was recorded.")
            if any(keyword in {"negative", "declined", "not interested", "unable"} for keyword in negative_hits):
                reasons.append("Negative interaction was recorded.")

        if not reasons:
            if score >= 75:
                reasons.append("The customer has strong recent engagement.")
            elif score >= 50:
                reasons.append("The customer shows moderate engagement.")
            else:
                reasons.append("The customer has limited recent engagement.")

        return {
            "score": score,
            "confidence": confidence,
            "reasons": reasons[:4],
        }
