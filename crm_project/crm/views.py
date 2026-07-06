import calendar
import json
import re
import sqlite3
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import Group, Permission, User
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.password_validation import validate_password
from django import forms
from django.core.exceptions import ValidationError
from django.db import models, transaction, IntegrityError
from django.http import JsonResponse, HttpResponseForbidden
from django.core.paginator import Paginator
from django.shortcuts import redirect, render
from django.urls import reverse

from .access import (
    ALL_PERMISSION_NAMES,
    RESOURCE_ACTION_PERMS,
    SECTION_PERM_MAP,
    SYSTEM_ADMIN_ROLE,
    can_do,
    has_permission,
)
from .ai_scoring import AIScoringService
from .models import Task

DB_PATH = Path(__file__).resolve().parent.parent / "crm.db"

TABLE_RESOURCE_MAP = {
    "contacts": "contacts",
    "leads": "leads",
    "deals": "deals",
    "activities": "activities",
    "tasks": "tasks",
    "tickets": "tickets",
}


class CRMUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta(UserCreationForm.Meta):
        fields = ("username", "email")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        if commit:
            user.save()
        return user


def _now_iso():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _clean_value(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if value in {"", "-", "None", "none"}:
            return None
    return value


def _persist_record(table_name, action, record_id=None, fields=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = _now_iso()

    if action == "delete":
        cursor.execute(f"UPDATE {table_name} SET deleted_at=? WHERE id=?", (now, record_id))
        conn.commit()
        conn.close()
        return True

    if action == "create":
        record_id = record_id or uuid.uuid4().hex
        columns = ["id", "created_at", "updated_at"] + list((fields or {}).keys())
        values = [record_id, now, now] + [_clean_value((fields or {}).get(column)) for column in (fields or {}).keys()]
        cursor.execute(
            f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
            values,
        )
    elif action == "edit":
        updates = [(key, _clean_value((fields or {}).get(key))) for key in (fields or {}).keys()]
        if not updates:
            conn.close()
            return False
        assignments = ", ".join(f"{key}=?" for key, _ in updates)
        values = [value for _, value in updates] + [now, record_id]
        cursor.execute(f"UPDATE {table_name} SET {assignments}, updated_at=? WHERE id=?", values)

    conn.commit()
    conn.close()
    return True


def _handle_form_submission(request, table_name, list_name, allowed_fields):
    if request.method != "POST":
        return None

    action = (request.POST.get("action") or "").strip()
    record_id = (request.POST.get("id") or request.POST.get("record_id") or "").strip()
    if action not in {"create", "edit", "delete"}:
        return None

    resource = TABLE_RESOURCE_MAP.get(table_name)
    if resource and not can_do(request.user, resource, action):
        return HttpResponseForbidden("403 Forbidden")

    fields = {field: request.POST.get(field) for field in allowed_fields if field in request.POST}
    if action == "delete" and record_id:
        _persist_record(table_name, "delete", record_id=record_id)
    elif action in {"create", "edit"}:
        _persist_record(table_name, action, record_id=record_id or None, fields=fields)

    return redirect(reverse(list_name))


def fetch_latest_rows(table_name, limit=5):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name} ORDER BY rowid DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return rows


def _normalize_phone(value):
    return re.sub(r"\D", "", value or "")


def _normalize_email(value):
    return (value or "").strip().lower()


def _humanize_label(name):
    return name.replace("_", " ").title()


def _format_value(value):
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return value


def _build_field_rows(record):
    if hasattr(record, "keys"):
        record = dict(record)
    return [
        {"label": _humanize_label(key), "value": _format_value(record.get(key))}
        for key in record.keys()
    ]


def _build_display_field_rows(record, hidden_keys=None):
    if hasattr(record, "keys"):
        record = dict(record)

    hidden_keys = set(hidden_keys or [])
    blocked_keys = {
        "id",
        "rowid",
        "deleted_at",
        "updated_at",
        "entity_id",
        "entity_type",
        "activity_type_id",
        "task_type_id",
        "user_id",
        "lead_id",
        "establishment_id",
        "contact_id",
        "stage_id",
        "owner_id",
        "normalized_phone",
        "normalized_email",
        "created_by",
        "updated_by",
    }

    return [
        {"label": _humanize_label(key), "value": _format_value(record.get(key))}
        for key in record.keys()
        if key not in hidden_keys and key not in blocked_keys and not (key.endswith("_id") and key != "id") and record.get(key) is not None
    ]


def _build_technical_field_rows(record):
    if hasattr(record, "keys"):
        record = dict(record)

    blocked_keys = {
        "id",
        "rowid",
        "deleted_at",
        "updated_at",
        "entity_id",
        "entity_type",
        "activity_type_id",
        "task_type_id",
        "user_id",
        "lead_id",
        "establishment_id",
        "contact_id",
        "stage_id",
        "owner_id",
        "normalized_phone",
        "normalized_email",
        "created_by",
        "updated_by",
    }

    return [
        {"label": _humanize_label(key), "value": _format_value(record.get(key))}
        for key in record.keys()
        if key not in blocked_keys and not (key.endswith("_id") and key != "id") and record.get(key) is not None
    ]


def _get_reference_lookup(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]

    id_column = "id" if "id" in columns else None
    label_column = next((column for column in ["name", "label"] if column in columns), None)

    if not id_column or not label_column:
        return {}

    cursor.execute(f"SELECT {id_column}, {label_column} FROM {table_name}")
    rows = cursor.fetchall()
    return {row[0]: row[1] for row in rows if row[0]}


def _fetch_contact_details(contact):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    contact_id = contact["id"]
    contact_name = contact["full_name"] or ""
    contact_phone = _normalize_phone(contact["phone"])
    contact_email = _normalize_email(contact["email"])
    establishment_id = contact["establishment_id"]

    lead_conditions = []
    lead_params = []

    if establishment_id:
        lead_conditions.append("establishment_id = ?")
        lead_params.append(establishment_id)

    if contact_phone:
        lead_conditions.append("normalized_phone = ?")
        lead_params.append(contact_phone)

    if contact_email:
        lead_conditions.append("normalized_email = ?")
        lead_params.append(contact_email)

    if contact_name:
        lead_conditions.append("full_name LIKE ?")
        lead_params.append(f"%{contact_name}%")

    leads = []
    if lead_conditions:
        cursor.execute(
            f"SELECT * FROM leads WHERE {' OR '.join(lead_conditions)} ORDER BY rowid DESC LIMIT 20",
            lead_params,
        )
        leads = [dict(row) for row in cursor.fetchall()]

    lead_ids = [lead["id"] for lead in leads if lead["id"]]

    deals = []
    if lead_ids:
        placeholders = ", ".join("?" for _ in lead_ids)
        cursor.execute(
            f"SELECT * FROM deals WHERE lead_id IN ({placeholders}) ORDER BY rowid DESC LIMIT 20",
            lead_ids,
        )
        deals = [dict(row) for row in cursor.fetchall()]
    elif establishment_id:
        cursor.execute(
            "SELECT * FROM deals WHERE establishment_id = ? ORDER BY rowid DESC LIMIT 20",
            (establishment_id,),
        )
        deals = [dict(row) for row in cursor.fetchall()]

    activities = []
    if contact_id:
        cursor.execute(
            "SELECT * FROM activities WHERE entity_type = 'contact' AND entity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
            (contact_id,),
        )
        activities = [dict(row) for row in cursor.fetchall()]

    if not activities and lead_ids:
        placeholders = ", ".join("?" for _ in lead_ids)
        cursor.execute(
            f"SELECT * FROM activities WHERE entity_type = 'lead' AND entity_id IN ({placeholders}) ORDER BY created_at DESC, rowid DESC LIMIT 20",
            lead_ids,
        )
        activities = [dict(row) for row in cursor.fetchall()]

    if not activities and deals:
        deal_ids = [deal["id"] for deal in deals if deal["id"]]
        if deal_ids:
            placeholders = ", ".join("?" for _ in deal_ids)
            cursor.execute(
                f"SELECT * FROM activities WHERE entity_type = 'deal' AND entity_id IN ({placeholders}) ORDER BY created_at DESC, rowid DESC LIMIT 20",
                deal_ids,
            )
            activities = [dict(row) for row in cursor.fetchall()]

    tasks = []
    if contact_id:
        cursor.execute(
            "SELECT * FROM tasks WHERE entity_type = 'contact' AND entity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
            (contact_id,),
        )
        tasks = [dict(row) for row in cursor.fetchall()]

    if not tasks and deals:
        deal_ids = [deal["id"] for deal in deals if deal["id"]]
        if deal_ids:
            placeholders = ", ".join("?" for _ in deal_ids)
            cursor.execute(
                f"SELECT * FROM tasks WHERE entity_type = 'deal' AND entity_id IN ({placeholders}) ORDER BY created_at DESC, rowid DESC LIMIT 20",
                deal_ids,
            )
            tasks = [dict(row) for row in cursor.fetchall()]

    notes = []
    if contact_id:
        cursor.execute(
            "SELECT * FROM notes WHERE entity_type = 'contact' AND entity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
            (contact_id,),
        )
        notes = [dict(row) for row in cursor.fetchall()]

    if not notes and lead_ids:
        placeholders = ", ".join("?" for _ in lead_ids)
        cursor.execute(
            f"SELECT * FROM notes WHERE entity_type = 'lead' AND entity_id IN ({placeholders}) ORDER BY created_at DESC, rowid DESC LIMIT 20",
            lead_ids,
        )
        notes = [dict(row) for row in cursor.fetchall()]

    if not notes and deals:
        deal_ids = [deal["id"] for deal in deals if deal["id"]]
        if deal_ids:
            placeholders = ", ".join("?" for _ in deal_ids)
            cursor.execute(
                f"SELECT * FROM notes WHERE entity_type = 'deal' AND entity_id IN ({placeholders}) ORDER BY created_at DESC, rowid DESC LIMIT 20",
                deal_ids,
            )
            notes = [dict(row) for row in cursor.fetchall()]

    activity_types = _get_reference_lookup(cursor, "activity_types")
    task_types = _get_reference_lookup(cursor, "task_types")
    pipeline_stages = _get_reference_lookup(cursor, "pipeline_stages")
    establishments = _get_reference_lookup(cursor, "establishments")

    contact_row = dict(contact)
    company_name = establishments.get(establishment_id, establishment_id or "-")
    contact_row["company"] = company_name

    conn.close()

    return {
        "status": "Active" if contact["phone"] or contact["email"] else "Pending",
        "company_name": company_name,
        "contact_fields": _build_display_field_rows(contact_row),
        "technical_fields": _build_technical_field_rows(contact_row),
        "activities": [
            {
                "activity_type": activity_types.get(activity.get("activity_type_id"), activity.get("activity_type_id") or "-"),
                "date": activity.get("created_at") or activity.get("occurred_at") or "-",
                "description": activity.get("body") or activity.get("outcome") or "-",
                "outcome": activity.get("outcome") or "-",
                "direction": activity.get("direction") or "-",
                "technical_fields": _build_technical_field_rows(activity),
            }
            for activity in activities
        ],
        "deals": [
            {
                "name": deal.get("name") or "Deal",
                "amount": deal.get("expected_value_minor") or deal.get("won_value_minor") or "-",
                "stage": pipeline_stages.get(deal.get("stage_id"), deal.get("stage_id") or "-"),
                "probability": deal.get("probability") or "-",
                "close_date": deal.get("actual_close_date") or deal.get("target_close_date") or deal.get("contract_end_date") or "-",
                "technical_fields": _build_technical_field_rows(deal),
            }
            for deal in deals
        ],
        "tasks": [
            {
                "title": task.get("title") or task.get("description") or "-",
                "status": task.get("outcome") or ("Completed" if task.get("completed_at") else "Pending"),
                "due_date": task.get("due_at") or "-",
                "description": task.get("description") or task.get("body") or "-",
                "technical_fields": _build_technical_field_rows(task),
            }
            for task in tasks
        ],
        "notes": [
            {
                "body": note.get("body") or "-",
                "date": note.get("created_at") or "-",
                "technical_fields": _build_technical_field_rows(note),
            }
            for note in notes
        ],
    }


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _display(value):
    if value is None:
        return "-"
    if isinstance(value, str):
        value = value.strip()
        if not value or value in {"-", "None", "none"}:
            return "-"
    return str(value)


def _coerce_due_at_from_mapping(mapping):
    try:
        due_at = str(mapping.get("due_at") or "").strip()
    except Exception:
        due_at = ""
    try:
        due_date = str(mapping.get("due_date") or "").strip()
    except Exception:
        due_date = ""
    try:
        due_time = str(mapping.get("due_time") or "").strip()
    except Exception:
        due_time = ""
    if due_date or due_time:
        return f"{due_date}T{due_time}" if due_date and due_time else (due_date or "")
    return due_at or ""
def _safe_lookup(cursor, table_name, label_columns=("name", "label", "title", "display_name", "full_name", "username", "email")):
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cursor.fetchone():
            return {}
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [row[1] for row in cursor.fetchall()]
        if not columns:
            return {}
        id_column = "id" if "id" in columns else None
        label_column = next((column for column in label_columns if column in columns), None)
        if not id_column or not label_column:
            return {}
        cursor.execute(f"SELECT {id_column}, {label_column} FROM {table_name}")
        rows = cursor.fetchall()
        return {str(row[0]): _display(row[1]) for row in rows if row[0]}
    except Exception:
        return {}


def _resolve_owner(cursor, owner_id):
    if not owner_id:
        return "-"
    for table_name in ("auth_user", "users", "employees", "contacts"):
        lookup = _safe_lookup(cursor, table_name)
        if str(owner_id) in lookup:
            return lookup[str(owner_id)]
    return _display(owner_id)


def _split_note_body(body):
    text = body or ""
    if "\n\n" in text:
        title, note_text = text.split("\n\n", 1)
        return title.strip(), note_text.strip()
    return "", text.strip()


def _deal_related_json_response(kind, item):
    return JsonResponse({"kind": kind, "item": item})


def _extract_custom_value(custom_fields):
    if not custom_fields:
        return None
    if isinstance(custom_fields, dict):
        data = custom_fields
    else:
        try:
            data = json.loads(custom_fields)
        except Exception:
            return None
    if isinstance(data, dict):
        for key in ("planPrice", "amount", "value", "expected_value_minor", "won_value_minor"):
            if key in data:
                return data[key]
        for nested in data.values():
            if isinstance(nested, dict):
                for key in ("planPrice", "amount", "value", "expected_value_minor", "won_value_minor"):
                    if key in nested:
                        return nested[key]
    return None


def _format_amount(value, currency_code=None):
    if value in (None, "", "-", "None", "none"):
        return "-"
    try:
        amount = float(value)
        if currency_code:
            return f"{currency_code} {amount:,.0f}"
        return f"{amount:,.0f}"
    except Exception:
        if currency_code:
            return f"{currency_code} {value}"
        return str(value)


def _format_probability(value):
    if value in (None, "", "-", "None", "none"):
        return "-"
    try:
        return f"{float(value):.0f}%"
    except Exception:
        return str(value)


def _format_date(value):
    if value in (None, "", "-", "None", "none"):
        return "-"
    return str(value).split("T")[0] if "T" in str(value) else str(value)


def _activity_icon(activity_type):
    value = (activity_type or "").strip().lower()
    if "whatsapp" in value or "wa" == value:
        return "bi-whatsapp"
    if "call" in value or "phone" in value:
        return "bi-telephone"
    if "email" in value or "mail" in value:
        return "bi-envelope"
    if "meeting" in value or "meet" in value:
        return "bi-calendar-event"
    if "note" in value:
        return "bi-journal-text"
    return "bi-activity"


def _activity_timestamp(activity_row):
    return activity_row.get("occurred_at") or activity_row.get("created_at") or ""


def _query_without(request, *keys):
    params = request.GET.copy()
    for key in keys:
        params.pop(key, None)
    return params.urlencode()


def _handle_deal_workspace_submission(request):
    if request.method != "POST":
        return None

    deal_related_action = (request.POST.get("deal_related_action") or "").strip().lower()
    deal_id = (request.POST.get("deal_id") or "").strip()
    if deal_related_action not in {"activity", "task", "note"} or not deal_id:
        return None

    if deal_related_action == "activity" and not can_do(request.user, "activities", "create"):
        return HttpResponseForbidden("403 Forbidden")
    if deal_related_action == "task" and not can_do(request.user, "tasks", "create"):
        return HttpResponseForbidden("403 Forbidden")
    if deal_related_action == "note" and not can_do(request.user, "deals", "edit"):
        return HttpResponseForbidden("403 Forbidden")

    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM deals WHERE id = ? AND deleted_at IS NULL", (deal_id,))
    deal_row = cursor.fetchone()
    if not deal_row:
        conn.close()
        return HttpResponseForbidden("Invalid deal")

    deal_dict = dict(deal_row)
    now = _now_iso()
    current_user_id = str(getattr(request.user, "id", "") or "")

    if deal_related_action == "activity":
        activity_type_id = (request.POST.get("activity_type_id") or "").strip()
        direction = (request.POST.get("direction") or "").strip()
        status = (request.POST.get("status") or "").strip()
        assigned_user = (request.POST.get("assigned_user") or current_user_id).strip()
        description = (request.POST.get("description") or "").strip()
        outcome = (request.POST.get("outcome") or "").strip()
        occurred_at = (request.POST.get("occurred_at") or now).strip()
        record_id = uuid.uuid4().hex
        body = description
        if status or outcome:
            body = f"{description}\n\nStatus: {status}\nOutcome: {outcome}".strip()
        cursor.execute(
            "INSERT INTO activities (id, entity_type, entity_id, activity_type_id, direction, outcome, body, user_id, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (record_id, "deal", deal_id, activity_type_id or None, direction or None, status or outcome or None, body or None, assigned_user or None, occurred_at or now, now, now),
        )
        assigned_user_label = _resolve_owner(cursor, assigned_user)
        conn.commit()
        conn.close()
        return _deal_related_json_response("activity", {
            "id": record_id,
            "activity_type": activity_type_id or "Activity",
            "direction": direction or "-",
            "status": status or "Pending",
            "assigned_user": assigned_user_label,
            "date": _format_date(occurred_at),
            "description": description or "-",
            "outcome": outcome or "-",
        })

    if deal_related_action == "task":
        title = (request.POST.get("title") or "").strip()
        description = (request.POST.get("description") or "").strip()
        due_at = (request.POST.get("due_at") or "").strip()
        priority = (request.POST.get("priority") or "").strip()
        status = (request.POST.get("status") or "").strip()
        assigned_user = (request.POST.get("assigned_user") or current_user_id).strip()
        cursor.execute(
            "INSERT INTO tasks (entity_type, entity_id, title, description, mode, assignee_id, due_at, outcome, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("deal", deal_id, title or None, description or None, priority or None, assigned_user or None, due_at or None, status or None, now, now),
        )
        record_id = cursor.lastrowid
        assigned_user_label = _resolve_owner(cursor, assigned_user)
        conn.commit()
        conn.close()
        return _deal_related_json_response("task", {
            "id": record_id,
            "title": title or "Task",
            "description": description or "-",
            "due_date": _format_date(due_at),
            "priority": priority or "-",
            "status": status or "Pending",
            "assigned_user": assigned_user_label,
        })

    title = (request.POST.get("title") or "").strip()
    note_text = (request.POST.get("note") or request.POST.get("body") or "").strip()
    created_by = (request.POST.get("created_by") or current_user_id).strip()
    body = f"{title}\n\n{note_text}".strip() if title else note_text
    record_id = uuid.uuid4().hex
    cursor.execute(
        "INSERT INTO notes (id, entity_type, entity_id, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (record_id, "deal", deal_id, body or None, created_by or None, now, now),
    )
    created_by_label = _resolve_owner(cursor, created_by)
    conn.commit()
    conn.close()
    return _deal_related_json_response("note", {
        "id": record_id,
        "title": title or "",
        "body": note_text or body or "-",
        "date": _format_date(now),
        "created_by": created_by_label,
    })


def leads(request):
    redirect_response = _handle_form_submission(request, "leads", "leads", ["full_name", "normalized_phone", "normalized_email", "stage_id", "notes", "establishment_id", "owner_id"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    sort_field = (request.GET.get("sort") or "created_at").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM leads WHERE deleted_at IS NULL"
    params = []
    if query:
        search_term = f"%{query}%"
        sql += " AND (full_name LIKE ? OR notes LIKE ? OR custom_fields LIKE ?)"
        params.extend([search_term, search_term, search_term])

    allowed_sort_fields = {"created_at": "created_at", "full_name": "full_name", "stage_id": "stage_id", "updated_at": "updated_at"}
    sort_column = allowed_sort_fields.get(sort_field, "created_at")
    sql += f" ORDER BY {sort_column} {'ASC' if sort_order == 'asc' else 'DESC'}, rowid DESC"
    cursor.execute(sql, params)
    lead_rows = cursor.fetchall()

    stage_lookup = _safe_lookup(cursor, "pipeline_stages")
    company_lookup = _safe_lookup(cursor, "establishments")
    owner_lookup = _safe_lookup(cursor, "users")
    if not owner_lookup:
        owner_lookup = _safe_lookup(cursor, "employees")

    lead_list = []
    for lead in lead_rows:
        lead_dict = dict(lead)
        stage_name = _display(stage_lookup.get(str(lead_dict.get("stage_id"))))
        ai_payload = AIScoringService.build_payload(cursor, "lead", lead_dict.get("id"), stage_history=[stage_name] if stage_name and stage_name != "-" else None)
        ai_score = AIScoringService.score(ai_payload)
        lead_list.append({
            "row": lead_dict,
            "details": {
                "name": _display(lead_dict.get("full_name")),
                "company": _display(company_lookup.get(str(lead_dict.get("establishment_id"))) or lead_dict.get("company_name")),
                "stage": stage_name,
                "status": "Active" if (lead_dict.get("notes") or lead_dict.get("normalized_phone") or lead_dict.get("normalized_email")) else "Pending",
                "phone": _display(lead_dict.get("normalized_phone")),
                "email": _display(lead_dict.get("normalized_email")),
                "value": _display(_extract_custom_value(lead_dict.get("custom_fields")) or lead_dict.get("value")),
                "owner": _display(owner_lookup.get(str(lead_dict.get("owner_id"))) or lead_dict.get("owner_id")),
                "notes": _display(lead_dict.get("notes")),
                "ai_score": f"{ai_score['score']}%",
                "ai_confidence": ai_score["confidence"],
                "ai_reasons": ai_score["reasons"],
            },
        })

    paginator = Paginator(lead_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "leads.html", {
        "lead_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "page_query_params": [(key, value) for key, value in request.GET.items() if key != "page"],
        "query": query,
        "sort": sort_field,
        "order": sort_order,
        "stage_lookup": stage_lookup,
    })


def deals(request):
    deal_workspace_response = _handle_deal_workspace_submission(request)
    if deal_workspace_response:
        return deal_workspace_response

    redirect_response = _handle_form_submission(request, "deals", "deals", ["name", "notes", "expected_value_minor", "currency_code", "stage_id", "probability_pct", "target_close_date"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    stage_filter = (request.GET.get("stage") or "").strip()
    page_number = request.GET.get("page", 1)
    search_mode = bool(query)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM deals WHERE deleted_at IS NULL"
    params = []

    sql += " ORDER BY created_at DESC, rowid DESC"
    cursor.execute(sql, params)
    deal_rows = cursor.fetchall()

    stage_lookup = _safe_lookup(cursor, "pipeline_stages")
    company_lookup = _safe_lookup(cursor, "establishments")
    contact_lookup = _safe_lookup(cursor, "contacts", label_columns=("full_name", "name", "label"))
    lead_lookup = _safe_lookup(cursor, "leads", label_columns=("full_name", "name", "label"))

    stage_columns = []
    try:
        cursor.execute("PRAGMA table_info(pipeline_stages)")
        stage_table_columns = [row[1] for row in cursor.fetchall()]
        stage_label_column = next(
            (column for column in ("name", "label", "title", "display_name") if column in stage_table_columns),
            None,
        )
        if stage_label_column:
            cursor.execute(f"SELECT id, {stage_label_column} FROM pipeline_stages ORDER BY rowid ASC")
            stage_columns = [
                {"id": str(row[0]), "name": _display(row[1])}
                for row in cursor.fetchall()
                if row[0] is not None
            ]
    except Exception:
        stage_columns = []

    if not stage_columns:
        stage_columns = [{"id": "unassigned", "name": "Unassigned"}]

    activity_type_lookup = _safe_lookup(cursor, "activity_types")
    activity_type_options = sorted(
        [{"id": key, "name": value} for key, value in activity_type_lookup.items()],
        key=lambda option: option["name"],
    )

    def _stage_name_from_id(stage_id):
        if stage_id is None:
            return "Unassigned"
        stage_name = stage_lookup.get(str(stage_id))
        return _display(stage_name if stage_name and stage_name != "-" else "Unassigned")

    def _resolve_deal_customer(deal_dict):
        contact_id = deal_dict.get("contact_id")
        lead_id = deal_dict.get("lead_id")
        establishment_id = deal_dict.get("establishment_id")

        if contact_id and contact_lookup.get(str(contact_id)):
            return _display(contact_lookup.get(str(contact_id)))
        if lead_id and lead_lookup.get(str(lead_id)):
            return _display(lead_lookup.get(str(lead_id)))
        if establishment_id and company_lookup.get(str(establishment_id)):
            return _display(company_lookup.get(str(establishment_id)))
        return "-"

    def _resolve_deal_owner(deal_dict):
        owner_id = deal_dict.get("owner_id") or deal_dict.get("assignee_id") or deal_dict.get("created_by")
        return _resolve_owner(cursor, owner_id)

    deal_list = []
    for deal in deal_rows:
        deal_dict = dict(deal)
        amount = deal_dict.get("won_value_minor") or deal_dict.get("expected_value_minor")
        close_date = deal_dict.get("actual_close_date") or deal_dict.get("target_close_date") or deal_dict.get("contract_end_date")
        stage_name = _stage_name_from_id(deal_dict.get("stage_id"))

        ai_payload = AIScoringService.build_payload(cursor, "deal", deal_dict.get("id"), stage_history=[stage_name] if stage_name and stage_name != "Unassigned" else None)
        ai_score = AIScoringService.score(ai_payload)
        details = {
            "name": _display(deal_dict.get("name")),
            "customer": _resolve_deal_customer(deal_dict),
            "amount": _format_amount(amount, deal_dict.get("currency_code")),
            "stage": stage_name,
            "close_date": _format_date(close_date),
            "probability": _format_probability(deal_dict.get("probability_pct")),
            "currency": _display(deal_dict.get("currency_code")),
            "assigned_user": _resolve_deal_owner(deal_dict),
            "notes": _display(deal_dict.get("notes")),
            "ai_score": f"{ai_score['score']}%",
            "ai_confidence": ai_score["confidence"],
            "ai_reasons": ai_score["reasons"],
        }

        item = {
            "row": deal_dict,
            "details": details,
        }

        deal_list.append(item)

    query_lower = query.lower()
    query_filtered_deal_list = []
    for item in deal_list:
        details = item["details"]
        if query_lower:
            searchable = " ".join([
                _display(details.get("name")).lower(),
                _display(details.get("customer")).lower(),
                _display(details.get("stage")).lower(),
                _display(details.get("amount")).lower(),
                _display(details.get("probability")).lower(),
                _display(details.get("close_date")).lower(),
                _display(details.get("assigned_user")).lower(),
                _display(details.get("currency")).lower(),
                _display(details.get("notes")).lower(),
                _display(item["row"].get("currency_code")).lower(),
            ])
            if query_lower not in searchable:
                continue

        query_filtered_deal_list.append(item)

    filtered_deal_list = []
    normalized_stage_filter = stage_filter.lower()
    for item in query_filtered_deal_list:
        details = item["details"]
        if stage_filter and normalized_stage_filter not in {"all stages", ""}:
            if (details.get("stage") or "").lower() != normalized_stage_filter:
                continue
        filtered_deal_list.append(item)

    paginator = Paginator(filtered_deal_list, 10)
    page_obj = paginator.get_page(page_number)
    paged_deals = list(page_obj.object_list)

    stage_items_map = {}
    for item in paged_deals:
        stage_name = item["details"].get("stage") or "Unassigned"
        if stage_name not in stage_items_map:
            stage_items_map[stage_name] = []
        stage_items_map[stage_name].append(item)

    display_stage_columns = []
    if not search_mode:
        for column in stage_columns:
            stage_items = stage_items_map.get(column["name"], [])
            if not stage_items:
                continue
            display_stage_columns.append({
                "id": column["id"],
                "name": column["name"],
                "items": stage_items,
            })

    render_items = paged_deals

    page_contact_ids = set()
    page_lead_ids = set()
    for item in render_items:
        deal_row = item["row"]
        if deal_row.get("contact_id"):
            page_contact_ids.add(str(deal_row.get("contact_id")))
        if deal_row.get("lead_id"):
            page_lead_ids.add(str(deal_row.get("lead_id")))

    contact_rows = {}
    if page_contact_ids:
        placeholders = ", ".join("?" for _ in page_contact_ids)
        cursor.execute(f"SELECT * FROM contacts WHERE CAST(id AS TEXT) IN ({placeholders})", list(page_contact_ids))
        contact_rows = {str(row["id"]): dict(row) for row in cursor.fetchall() if row["id"]}

    lead_rows = {}
    if page_lead_ids:
        placeholders = ", ".join("?" for _ in page_lead_ids)
        cursor.execute(f"SELECT * FROM leads WHERE CAST(id AS TEXT) IN ({placeholders})", list(page_lead_ids))
        lead_rows = {str(row["id"]): dict(row) for row in cursor.fetchall() if row["id"]}

    for item in render_items:
        deal_row = item["row"]
        details = item["details"]
        deal_id = deal_row.get("id")
        if not deal_id:
            continue

        contact_row = contact_rows.get(str(deal_row.get("contact_id")), {})
        lead_row = lead_rows.get(str(deal_row.get("lead_id")), {})

        contact_name = _display(
            contact_row.get("full_name")
            or lead_row.get("full_name")
            or details.get("customer")
        )
        contact_email = _display(contact_row.get("email") or lead_row.get("normalized_email"))
        contact_phone = _display(contact_row.get("phone") or lead_row.get("normalized_phone"))
        company_value = _display(
            company_lookup.get(str(deal_row.get("establishment_id")))
            or contact_row.get("company")
            or lead_row.get("company_name")
        )

        timeline_rows = []
        entity_targets = [("deal", str(deal_id))]
        if deal_row.get("contact_id"):
            entity_targets.append(("contact", str(deal_row.get("contact_id"))))
        if deal_row.get("lead_id"):
            entity_targets.append(("lead", str(deal_row.get("lead_id"))))

        deal_activities = []
        for entity_type, entity_id in entity_targets:
            cursor.execute(
                "SELECT * FROM activities WHERE LOWER(entity_type) = LOWER(?) AND CAST(entity_id AS TEXT) = ? ORDER BY rowid DESC LIMIT 80",
                (entity_type, entity_id),
            )
            for row in cursor.fetchall():
                row_dict = dict(row)
                row_key = (row_dict.get("id"), row_dict.get("rowid"), entity_type)
                timeline_rows.append(("activity", row_key, row_dict))

        deal_notes = []
        for entity_type, entity_id in entity_targets:
            cursor.execute(
                "SELECT * FROM notes WHERE LOWER(entity_type) = LOWER(?) AND CAST(entity_id AS TEXT) = ? ORDER BY rowid DESC LIMIT 80",
                (entity_type, entity_id),
            )
            for row in cursor.fetchall():
                row_dict = dict(row)
                row_key = (row_dict.get("id"), row_dict.get("rowid"), entity_type)
                timeline_rows.append(("note", row_key, row_dict))
                note_title, note_body = _split_note_body(row_dict.get("body"))
                deal_notes.append({
                    "date": _format_date(row_dict.get("created_at")),
                    "title": _display(note_title),
                    "body": _display(note_body),
                })

        deal_tasks = []
        for entity_type, entity_id in entity_targets:
            cursor.execute(
                "SELECT * FROM tasks WHERE LOWER(entity_type) = LOWER(?) AND CAST(entity_id AS TEXT) = ? ORDER BY rowid DESC LIMIT 80",
                (entity_type, entity_id),
            )
            for row in cursor.fetchall():
                row_dict = dict(row)
                row_key = (row_dict.get("id"), row_dict.get("rowid"), entity_type)
                timeline_rows.append(("task", row_key, row_dict))
                deal_tasks.append({
                    "title": _display(row_dict.get("title") or row_dict.get("description")),
                    "due_date": _format_date(row_dict.get("due_at")),
                    "status": "Completed" if row_dict.get("completed_at") else "Pending",
                    "assigned_user": _resolve_owner(cursor, row_dict.get("assignee_id")),
                    "description": _display(row_dict.get("description")),
                })

        unique_activity_keys = set()
        for kind, row_key, row_dict in sorted(
            timeline_rows,
            key=lambda row: _activity_timestamp(row[2]) if row[0] == "activity" else (row[2].get("created_at") or ""),
            reverse=True,
        ):
            if kind != "activity":
                continue
            if row_key in unique_activity_keys:
                continue
            unique_activity_keys.add(row_key)
            activity_type = _display(activity_type_lookup.get(str(row_dict.get("activity_type_id"))))
            status = "Completed" if row_dict.get("outcome") else "Pending"
            deal_activities.append({
                "icon": _activity_icon(activity_type),
                "activity_type": activity_type,
                "date": _format_date(_activity_timestamp(row_dict)),
                "assigned_user": _resolve_owner(cursor, row_dict.get("user_id") or row_dict.get("owner_id") or row_dict.get("created_by")),
                "status": status,
                "direction": _display(row_dict.get("direction")),
                "description": _display(row_dict.get("body")),
                "outcome": _display(row_dict.get("outcome")),
            })

        item["detail"] = {
            "general": [
                {"label": "Deal Name", "value": details.get("name")},
                {"label": "Stage", "value": details.get("stage")},
                {"label": "Value", "value": details.get("amount")},
                {"label": "Probability", "value": details.get("probability")},
                {"label": "Close Date", "value": details.get("close_date")},
                {"label": "Assigned User", "value": details.get("assigned_user")},
                {"label": "Currency", "value": details.get("currency")},
                {"label": "Notes", "value": details.get("notes")},
            ],
            "contact": {
                "name": contact_name,
                "company": company_value,
                "phone": contact_phone,
                "email": contact_email,
            },
            "activities": deal_activities,
            "notes": sorted(deal_notes, key=lambda row: row.get("date") or "", reverse=True),
            "tasks": sorted(deal_tasks, key=lambda row: row.get("due_date") or "", reverse=True),
        }

    available_stage_names = []
    for column in stage_columns:
        column_name = column["name"]
        has_items = any((item["details"].get("stage") or "Unassigned") == column_name for item in query_filtered_deal_list)
        if has_items and column_name not in available_stage_names:
            available_stage_names.append(column_name)

    stage_filter_options = ["All Stages"] + available_stage_names

    conn.close()
    return render(request, "deals.html", {
        "deal_list": paged_deals,
        "stage_columns": display_stage_columns,
        "stage_filter": stage_filter,
        "stage_filter_options": stage_filter_options,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "page_query_params": [(key, value) for key, value in request.GET.items() if key != "page"],
        "query": query,
        "search_mode": search_mode,
        "sort": "created_at",
        "order": "desc",
        "stage_lookup": stage_lookup,
        "activity_type_options": activity_type_options,
    })


def activities(request):
    redirect_response = _handle_form_submission(request, "activities", "activities", ["body", "outcome", "direction", "activity_type_id", "occurred_at"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    activity_type_filter = (request.GET.get("activity_type_id") or "").strip()
    direction_filter = (request.GET.get("direction") or "").strip()
    status_filter = (request.GET.get("status") or "").strip().lower()
    date_filter = (request.GET.get("date") or "").strip()
    assigned_user_filter = (request.GET.get("assigned_user") or "").strip()
    sort_field = (request.GET.get("sort") or "created_at").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM activities WHERE 1=1"
    params = []

    if activity_type_filter:
        sql += " AND CAST(activity_type_id AS TEXT) = ?"
        params.append(activity_type_filter)

    if direction_filter:
        sql += " AND LOWER(direction) = LOWER(?)"
        params.append(direction_filter)

    if date_filter:
        sql += " AND (DATE(occurred_at) = DATE(?) OR DATE(created_at) = DATE(?))"
        params.extend([date_filter, date_filter])

    if assigned_user_filter:
        sql += " AND (CAST(user_id AS TEXT) = ? OR CAST(owner_id AS TEXT) = ? OR CAST(created_by AS TEXT) = ?)"
        params.extend([assigned_user_filter, assigned_user_filter, assigned_user_filter])

    allowed_sort_fields = {"created_at": "created_at", "occurred_at": "occurred_at", "outcome": "outcome", "direction": "direction"}
    sort_column = allowed_sort_fields.get(sort_field, "created_at")
    sql += f" ORDER BY {sort_column} {'ASC' if sort_order == 'asc' else 'DESC'}, rowid DESC"
    cursor.execute(sql, params)
    activity_rows = cursor.fetchall()

    activity_type_lookup = _safe_lookup(cursor, "activity_types")
    user_lookup = _safe_lookup(cursor, "users")
    if not user_lookup:
        user_lookup = _safe_lookup(cursor, "employees")
    lead_rows_by_id = {}
    phone_to_lead = {}
    deal_rows_by_id = {}
    try:
        cursor.execute("SELECT * FROM leads")
        for row in cursor.fetchall():
            row_dict = dict(row)
            lead_id = str(row_dict.get("id") or "")
            if lead_id:
                lead_rows_by_id[lead_id] = row_dict
            normalized_candidates = [
                _normalize_phone(row_dict.get("normalized_phone")),
                _normalize_phone(row_dict.get("phone")),
            ]
            for phone in normalized_candidates:
                if phone:
                    phone_to_lead[phone] = row_dict
    except Exception:
        lead_rows_by_id = {}
        phone_to_lead = {}

    try:
        cursor.execute("SELECT * FROM deals WHERE deleted_at IS NULL")
        for row in cursor.fetchall():
            row_dict = dict(row)
            deal_id = str(row_dict.get("id") or "")
            if deal_id:
                deal_rows_by_id[deal_id] = row_dict
    except Exception:
        deal_rows_by_id = {}

    direction_options = set()
    assigned_user_options = {}
    grouped_leads = {}

    def _extract_activity_phone(activity_dict):
        for field in ("phone", "phone_number", "normalized_phone", "from_phone", "to_phone", "contact_phone"):
            normalized = _normalize_phone(activity_dict.get(field))
            if normalized:
                return normalized
        return ""

    def _resolve_lead(activity_dict):
        entity_type = (activity_dict.get("entity_type") or "").strip().lower()
        entity_id = str(activity_dict.get("entity_id") or "").strip()

        if entity_type == "lead" and entity_id:
            lead_row = lead_rows_by_id.get(entity_id, {})
            lead_name = _display(lead_row.get("full_name"))
            lead_phone = _display(lead_row.get("normalized_phone") or lead_row.get("phone"))
            if lead_row:
                return f"lead:{entity_id}", lead_name, lead_phone
            return f"lead:{entity_id}", f"Lead {entity_id[:8]}", "-"

        if entity_type == "deal" and entity_id:
            deal_row = deal_rows_by_id.get(entity_id, {})
            if deal_row:
                linked_lead_id = str(deal_row.get("lead_id") or "")
                if linked_lead_id and linked_lead_id in lead_rows_by_id:
                    lead_row = lead_rows_by_id[linked_lead_id]
                    return f"lead:{linked_lead_id}", _display(lead_row.get("full_name")), _display(lead_row.get("normalized_phone") or lead_row.get("phone"))
                return f"deal:{entity_id}", _display(deal_row.get("name") or f"Deal {entity_id[:8]}"), "-"
            return f"deal:{entity_id}", f"Deal {entity_id[:8]}", "-"

        phone_key = _extract_activity_phone(activity_dict)
        if phone_key and phone_to_lead.get(phone_key):
            lead_row = phone_to_lead.get(phone_key)
            lead_id = str(lead_row.get("id"))
            lead_name = _display(lead_row.get("full_name"))
            lead_phone = _display(lead_row.get("normalized_phone") or phone_key)
            return f"lead:{lead_id}", lead_name, lead_phone

        # Keep unresolved records isolated without exposing UUID as the visible customer title.
        fallback_id = activity_dict.get("id") or activity_dict.get("rowid") or uuid.uuid4().hex
        return f"unresolved:{fallback_id}", "Unknown Customer", "-"

    def _build_activity_item(activity_dict):
        activity_type = _display(activity_type_lookup.get(str(activity_dict.get("activity_type_id"))))
        status = "Completed" if activity_dict.get("outcome") else "Pending"
        assigned_user_id = activity_dict.get("user_id") or activity_dict.get("owner_id") or activity_dict.get("created_by")
        assigned_user = _display(user_lookup.get(str(assigned_user_id)) if assigned_user_id else None)
        return {
            "id": _display(activity_dict.get("id")),
            "icon": _activity_icon(activity_type),
            "activity_type": activity_type,
            "date": _format_date(_activity_timestamp(activity_dict)),
            "date_raw": _activity_timestamp(activity_dict),
            "direction": _display(activity_dict.get("direction")),
            "status": status,
            "assigned_user": assigned_user,
            "description": _display(activity_dict.get("body")),
            "outcome": _display(activity_dict.get("outcome")),
        }

    for activity in activity_rows:
        activity_dict = dict(activity)
        activity_item = _build_activity_item(activity_dict)
        status = activity_item["status"]

        if status_filter and status.lower() != status_filter:
            continue

        if activity_dict.get("direction"):
            direction_options.add(_display(activity_dict.get("direction")))

        assigned_user_id = activity_dict.get("user_id") or activity_dict.get("owner_id") or activity_dict.get("created_by")
        assigned_user = activity_item["assigned_user"]
        if assigned_user_id and assigned_user and assigned_user != "-":
            assigned_user_options[str(assigned_user_id)] = assigned_user

        lead_key, lead_name, lead_phone = _resolve_lead(activity_dict)
        if lead_key not in grouped_leads:
            grouped_leads[lead_key] = {
                "lead_key": lead_key,
                "customer_name": lead_name,
                "phone": lead_phone,
                "assigned_user": assigned_user,
                "items": [],
                "type_options": set(),
                "latest_date": "",
            }

        group = grouped_leads[lead_key]
        if lead_phone and lead_phone != "-":
            group["phone"] = lead_phone

        group["items"].append(activity_item)
        if activity_item["activity_type"] and activity_item["activity_type"] != "-":
            group["type_options"].add(activity_item["activity_type"])
        if not group["latest_date"] or activity_item["date_raw"] > group["latest_date"]:
            group["latest_date"] = activity_item["date_raw"]
            group["assigned_user"] = activity_item["assigned_user"]

    customer_groups = []
    for group in grouped_leads.values():
        sorted_items = sorted(group["items"], key=lambda row: row.get("date_raw") or "", reverse=True)
        latest = sorted_items[0] if sorted_items else None
        group_record = {
            "customer_key": group["lead_key"],
            "customer_name": group["customer_name"],
            "phone": group["phone"],
            "assigned_user": group["assigned_user"],
            "last_activity_type": latest.get("activity_type") if latest else "-",
            "last_activity_date": latest.get("date") if latest else "-",
            "activity_count": len(sorted_items),
            "type_options": sorted(group["type_options"]),
            "timeline": sorted_items,
        }
        if query:
            query_lower = query.lower()
            searchable = " ".join([
                str(group_record.get("customer_name") or "").lower(),
                str(group_record.get("phone") or "").lower(),
            ])
            if query_lower not in searchable:
                continue
        customer_groups.append(group_record)

    customer_groups = sorted(
        customer_groups,
        key=lambda group: group["timeline"][0].get("date_raw") if group["timeline"] else "",
        reverse=True,
    )

    paginator = Paginator(customer_groups, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "activities.html", {
        "activity_groups": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "page_query_params": [(key, value) for key, value in request.GET.items() if key != "page"],
        "query": query,
        "activity_type_filter": activity_type_filter,
        "direction_filter": direction_filter,
        "status_filter": status_filter,
        "date_filter": date_filter,
        "assigned_user_filter": assigned_user_filter,
        "direction_options": sorted(direction_options),
        "assigned_user_options": assigned_user_options,
        "sort": sort_field,
        "order": sort_order,
        "activity_type_lookup": activity_type_lookup,
    })


def _is_task_admin(user):
    return bool(getattr(user, "is_superuser", False) or (getattr(user, "is_authenticated", False) and user.groups.filter(name=SYSTEM_ADMIN_ROLE).exists()))


def _task_assignable_users(user):
    if not getattr(user, "is_authenticated", False):
        return []
    if _is_task_admin(user):
        return list(User.objects.filter(is_active=True).order_by("username"))

    candidates = [user]
    manager_group_names = {SYSTEM_ADMIN_ROLE, "Sales Manager"}
    for other_user in User.objects.filter(is_active=True).exclude(id=user.id).order_by("username"):
        if other_user.groups.filter(name__in=manager_group_names).exists():
            candidates.append(other_user)
    return candidates


def _task_visible_to_user(user, task_row):
    if _is_task_admin(user):
        return True
    if not getattr(user, "is_authenticated", False):
        return False
    return str(task_row.get("assignee_id") or "") == str(getattr(user, "id", ""))


def _task_user_label(user):
    if not user:
        return "-"
    return user.get_full_name() or user.username or str(user.id)


def _coerce_task_id(value, cursor=None):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return int(value)
        except ValueError:
            pass
    else:
        try:
            return int(value)
        except (TypeError, ValueError):
            pass

    if cursor is not None:
        try:
            cursor.execute("SELECT rowid, id FROM tasks WHERE id = ? LIMIT 1", (str(value),))
            row = cursor.fetchone()
            if row is not None:
                rowid = row[0]
                existing_id = row[1]
                if existing_id is None or str(existing_id) != str(rowid):
                    cursor.execute("UPDATE tasks SET id=? WHERE rowid=?", (rowid, rowid))
                return rowid
        except Exception:
            pass

    return None


def _normalize_task_ids(cursor):
    cursor.execute("SELECT rowid, id FROM tasks ORDER BY rowid")
    rows = cursor.fetchall()
    for rowid, existing_id in rows:
        try:
            normalized_id = int(existing_id)
        except (TypeError, ValueError):
            normalized_id = rowid
        if normalized_id != existing_id:
            cursor.execute("UPDATE tasks SET id=? WHERE rowid=?", (normalized_id, rowid))


def _task_due_bucket(task_row):
    completed = bool(task_row.get("completed_at")) or str(task_row.get("outcome") or "").strip().lower() == "completed"
    if completed:
        return "completed"
    due_at = (task_row.get("due_at") or "").strip()
    if not due_at:
        return "upcoming"
    try:
        due_date = datetime.fromisoformat(due_at.replace("Z", "+00:00")).date()
    except Exception:
        try:
            due_date = datetime.strptime(due_at, "%Y-%m-%d").date()
        except Exception:
            return "upcoming"
    today = datetime.now().date()
    if due_date < today:
        return "overdue"
    if due_date == today:
        return "today"
    return "upcoming"


def _task_is_completed(task_row):
    return bool(task_row.get("completed_at")) or str(task_row.get("outcome") or "").strip().lower() == "completed"


def _parse_task_due(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        if len(raw) == 10:
            return parsed.replace(hour=23, minute=59, second=0, microsecond=0)
        return parsed.replace(microsecond=0)
    except (TypeError, ValueError):
        return None


def _task_due_from_request(post_data):
    due_date = str(post_data.get("due_date") or post_data.get("due_at") or "").strip()
    due_time = str(post_data.get("due_time") or "").strip()
    return f"{due_date}T{due_time}" if due_date and due_time else due_date


def _task_row_from_model(task):
    return {
        field.name: getattr(task, field.name)
        for field in Task._meta.fields
    }


def _visible_task_queryset(user):
    queryset = Task.objects.all()
    if not _is_task_admin(user):
        queryset = queryset.filter(assignee_id=str(getattr(user, "id", "")))
    return queryset.annotate(
        due_missing=models.Case(
            models.When(due_at__isnull=True, then=models.Value(1)),
            models.When(due_at="", then=models.Value(1)),
            default=models.Value(0),
            output_field=models.IntegerField(),
        )
    ).order_by("due_missing", "due_at", "-created_at", "-id")


def _task_api_item(task_row, now=None):
    now = now or datetime.now().replace(microsecond=0)
    due = _parse_task_due(task_row.get("due_at"))
    completed = _task_is_completed(task_row)
    delta_seconds = int((due - now).total_seconds()) if due else None
    priority = str(task_row.get("mode") or "Medium").strip().title()
    return {
        "id": str(task_row.get("id")),
        "title": str(task_row.get("title") or "Untitled task"),
        "description": str(task_row.get("description") or ""),
        "due_at": due.isoformat(timespec="minutes") if due else "",
        "due_date": due.strftime("%Y-%m-%d") if due else "",
        "due_time": due.strftime("%H:%M") if due else "",
        "delta_seconds": delta_seconds,
        "priority": priority if priority in {"High", "Medium", "Low"} else "Medium",
        "status": "Completed" if completed else "Pending",
        "is_completed": completed,
        "assignee_id": str(task_row.get("assignee_id") or ""),
        "url": reverse("task_detail", args=[task_row.get("id")]),
    }


def _visible_task_rows(user):
    return [_task_row_from_model(task) for task in _visible_task_queryset(user)]


def _task_state_data(user):
    now = datetime.now().replace(microsecond=0)
    today = now.date()
    rows = _visible_task_rows(user)
    items = [_task_api_item(row, now) for row in rows]
    pending = [item for item in items if not item["is_completed"] and item["due_at"]]
    overdue = [item for item in pending if item["delta_seconds"] < 0]
    today_pending = [
        item for item in pending
        if item["due_date"] == today.isoformat() and item["delta_seconds"] >= 0
    ]
    upcoming = [item for item in pending if item["due_date"] > today.isoformat()]
    today_tasks = [item for item in items if item["due_date"] == today.isoformat()]
    completed_today = 0
    for row in rows:
        completed_at = _parse_task_due(row.get("completed_at"))
        if _task_is_completed(row) and completed_at and completed_at.date() == today:
            completed_today += 1

    today_pending_all = [item for item in pending if item["due_date"] == today.isoformat()]
    recent_overdue = [
        item for item in overdue
        if item["delta_seconds"] >= -7 * 24 * 60 * 60
    ]
    reminder_items = sorted(recent_overdue, key=lambda item: item["delta_seconds"], reverse=True) + sorted(
        [
            item for item in today_pending_all
            if 0 <= item["delta_seconds"] <= 3 * 60 * 60
        ],
        key=lambda item: item["delta_seconds"],
    )

    return {
        "now": now.isoformat(timespec="seconds"),
        "notification_count": len(overdue) + len(today_pending),
        "notifications": {
            "overdue": overdue[:10],
            "today": today_pending[:10],
            "upcoming": upcoming[:10],
        },
        "reminders": reminder_items,
        "dashboard": {
            "date": today.strftime("%A, %d %B %Y"),
            "today_count": len(today_tasks),
            "overdue_count": len(overdue),
            "due_today_count": len(today_pending_all),
            "completed_today_count": completed_today,
            "today_tasks": today_tasks,
        },
        "statuses": [
            {
                "id": item["id"],
                "status": item["status"],
                "due_date": item["due_date"],
                "delta_seconds": item["delta_seconds"],
            }
            for item in items
        ],
    }


def task_state(request):
    if not can_do(request.user, "tasks", "view"):
        return JsonResponse({"detail": "Forbidden"}, status=403)
    return JsonResponse(_task_state_data(request.user))


def task_action(request, record_id):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not can_do(request.user, "tasks", "edit"):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except (TypeError, ValueError, UnicodeDecodeError):
        payload = request.POST.dict()

    conn = _connect()
    cursor = conn.cursor()
    normalized_id = _coerce_task_id(record_id, cursor)
    conn.commit()
    conn.close()
    task = Task.objects.filter(id=str(normalized_id)).first()
    if not task:
        return JsonResponse({"detail": "Task not found"}, status=404)
    task_row = _task_row_from_model(task)
    if not _task_visible_to_user(request.user, task_row):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    action = str(payload.get("action") or "status").strip().lower()
    now = _now_iso()
    if action == "status":
        status = str(payload.get("status") or "").strip().lower()
        if status not in {"pending", "completed"}:
            return JsonResponse({"detail": "Invalid status"}, status=400)
        if status == "completed":
            task.completed_at = now
            task.outcome = "Completed"
        else:
            task.completed_at = None
            task.outcome = "Pending"
        task.updated_at = now
        task.save(update_fields=["completed_at", "outcome", "updated_at"])
    elif action == "edit":
        title = str(payload.get("title") or "").strip()
        if not title:
            return JsonResponse({"detail": "Title is required"}, status=400)
        due_at = _task_due_from_request(payload)
        priority = str(payload.get("priority") or "Medium").strip().title()
        status = str(payload.get("status") or "Pending").strip().title()
        assignee_id = str(payload.get("assignee_id") or task_row.get("assignee_id") or "").strip()
        if priority not in {"High", "Medium", "Low"} or status not in {"Pending", "Completed"}:
            return JsonResponse({"detail": "Invalid task values"}, status=400)
        allowed_users = {str(user.id) for user in _task_assignable_users(request.user)}
        if not _is_task_admin(request.user) and assignee_id not in allowed_users:
            return JsonResponse({"detail": "Invalid assignee"}, status=403)
        completed_at = (task_row.get("completed_at") or now) if status == "Completed" else None
        task.title = title
        task.description = str(payload.get("description") or "").strip() or None
        task.due_at = due_at or None
        task.mode = priority
        task.assignee_id = assignee_id or None
        task.outcome = status
        task.completed_at = completed_at
        task.updated_at = now
        task.save(update_fields=["title", "description", "due_at", "mode", "assignee_id", "outcome", "completed_at", "updated_at"])
    else:
        return JsonResponse({"detail": "Invalid action"}, status=400)

    task.refresh_from_db()
    updated = _task_api_item(_task_row_from_model(task))
    return JsonResponse({"task": updated, "state": _task_state_data(request.user)})


def tasks(request):
    if request.method == "POST":
        action = (request.POST.get("action") or "").strip()
        if action == "create":
            if not can_do(request.user, "tasks", "create"):
                return HttpResponseForbidden("403 Forbidden")
            title = (request.POST.get("title") or "").strip()
            description = (request.POST.get("description") or "").strip()
            due_at = _task_due_from_request(request.POST)
            priority = (request.POST.get("priority") or "").strip() or "Medium"
            status = (request.POST.get("status") or "").strip() or "Pending"
            assignee_id = (request.POST.get("assignee_id") or str(getattr(request.user, "id", ""))).strip()
            entity_type = (request.POST.get("entity_type") or "").strip()
            entity_id = (request.POST.get("entity_id") or "").strip()
            allowed_users = {str(user.id) for user in _task_assignable_users(request.user)}
            if not _is_task_admin(request.user) and assignee_id not in allowed_users:
                return HttpResponseForbidden("403 Forbidden")
            if not title:
                messages.error(request, "Title is required.")
                return redirect("tasks")
            now = _now_iso()
            conn = _connect()
            cursor = conn.cursor()
            _normalize_task_ids(cursor)
            next_task_id = int(cursor.execute("SELECT COALESCE(MAX(rowid), 0) FROM tasks").fetchone()[0] or 0) + 1
            conn.commit()
            conn.close()
            Task.objects.create(
                id=str(next_task_id),
                title=title,
                description=description or None,
                assignee_id=assignee_id or None,
                due_at=due_at or None,
                mode=priority or None,
                outcome=status or None,
                completed_at=now if status.lower() == "completed" else None,
                entity_type=entity_type or None,
                entity_id=entity_id or None,
                created_at=now,
                updated_at=now,
            )
            messages.success(request, "Task created successfully.")
            return redirect("tasks")

        if action == "edit":
            if not can_do(request.user, "tasks", "edit"):
                return HttpResponseForbidden("403 Forbidden")
            conn = _connect()
            cursor = conn.cursor()
            _normalize_task_ids(cursor)
            record_id = _coerce_task_id(request.POST.get("id") or request.POST.get("record_id") or "", cursor)
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (record_id,))
            task_row = cursor.fetchone()
            if not task_row:
                conn.close()
                messages.error(request, "Task not found.")
                return redirect("tasks")
            task_dict = dict(task_row)
            if not _is_task_admin(request.user):
                if not _task_visible_to_user(request.user, task_dict):
                    conn.close()
                    return HttpResponseForbidden("403 Forbidden")
                if bool(task_dict.get("completed_at")) or str(task_dict.get("outcome") or "").strip().lower() == "completed":
                    conn.close()
                    return HttpResponseForbidden("403 Forbidden")
            title = (request.POST.get("title") or "").strip()
            description = (request.POST.get("description") or "").strip()
            due_date = (request.POST.get("due_date") or "").strip()
            due_time = (request.POST.get("due_time") or "").strip()
            due_at = f"{due_date}T{due_time}" if due_date and due_time else due_date
            priority = (request.POST.get("priority") or "").strip() or "Medium"
            status = (request.POST.get("status") or "").strip() or "Pending"
            assignee_id = (request.POST.get("assignee_id") or str(task_dict.get("assignee_id") or request.user.id)).strip()
            if not _is_task_admin(request.user):
                allowed_users = {str(user.id) for user in _task_assignable_users(request.user)}
                if assignee_id not in allowed_users:
                    conn.close()
                    return HttpResponseForbidden("403 Forbidden")
            entity_type = (request.POST.get("entity_type") or "").strip()
            entity_id = (request.POST.get("entity_id") or "").strip()
            completed_at = (task_dict.get("completed_at") or _now_iso()) if status.lower() == "completed" else None
            cursor.execute(
                "UPDATE tasks SET title=?, description=?, assignee_id=?, due_at=?, mode=?, outcome=?, completed_at=?, entity_type=?, entity_id=?, updated_at=? WHERE id=?",
                (title or None, description or None, assignee_id or None, due_at or None, priority or None, status or None, completed_at, entity_type or None, entity_id or None, _now_iso(), record_id),
            )
            conn.commit()
            conn.close()
            messages.success(request, "Task updated successfully.")
            return redirect("tasks")

        if action == "delete":
            if not can_do(request.user, "tasks", "delete"):
                return HttpResponseForbidden("403 Forbidden")
            conn = _connect()
            cursor = conn.cursor()
            _normalize_task_ids(cursor)
            record_id = _coerce_task_id(request.POST.get("id") or request.POST.get("record_id") or "", cursor)
            cursor.execute("DELETE FROM tasks WHERE id = ?", (record_id,))
            conn.commit()
            conn.close()
            messages.success(request, "Task deleted successfully.")
            return redirect("tasks")

        if action == "complete":
            if not can_do(request.user, "tasks", "edit"):
                return HttpResponseForbidden("403 Forbidden")
            record_id = _coerce_task_id(request.POST.get("id") or request.POST.get("record_id") or "")
            conn = _connect()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (record_id,))
            task_row = cursor.fetchone()
            if not task_row:
                conn.close()
                messages.error(request, "Task not found.")
                return redirect("tasks")
            task_dict = dict(task_row)
            if not _is_task_admin(request.user) and not _task_visible_to_user(request.user, task_dict):
                conn.close()
                return HttpResponseForbidden("403 Forbidden")
            cursor.execute("UPDATE tasks SET completed_at=?, outcome='Completed', updated_at=? WHERE id=?", (_now_iso(), _now_iso(), record_id))
            conn.commit()
            conn.close()
            messages.success(request, "Task completed.")
            return redirect("tasks")

    query = (request.GET.get("q") or "").strip()
    status_filter = (request.GET.get("status") or "").strip().lower()
    priority_filter = (request.GET.get("priority") or "").strip()
    due_filter = (request.GET.get("due") or "").strip().lower()
    assignee_filter = (request.GET.get("assignee") or "").strip()
    selected_task_id = (request.GET.get("task") or "").strip()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()
    _normalize_task_ids(cursor)
    conn.commit()

    task_rows = _visible_task_rows(request.user)
    if selected_task_id:
        selected_normalized_id = _coerce_task_id(selected_task_id, cursor)
        task_rows = [
            row for row in task_rows
            if str(row.get("id")) == str(selected_normalized_id)
        ]
    if query:
        search_term = query.lower()
        task_rows = [
            row for row in task_rows
            if any(search_term in str(row.get(field) or "").lower() for field in ("title", "description", "outcome", "mode"))
        ]
    if status_filter == "completed":
        task_rows = [row for row in task_rows if _task_is_completed(row)]
    elif status_filter == "pending":
        task_rows = [row for row in task_rows if not _task_is_completed(row)]
    if priority_filter:
        task_rows = [row for row in task_rows if str(row.get("mode") or "") == priority_filter]
    if due_filter == "today":
        today = datetime.now().date().isoformat()
        task_rows = [row for row in task_rows if str(row.get("due_at") or "").startswith(today)]
    elif due_filter == "this_week":
        start_date = datetime.now().date() - timedelta(days=datetime.now().weekday())
        end_date = start_date + timedelta(days=6)
        task_rows = [
            row for row in task_rows
            if (parsed_due := _parse_task_due(row.get("due_at"))) and start_date <= parsed_due.date() <= end_date
        ]
    elif due_filter == "overdue":
        now = datetime.now()
        task_rows = [
            row for row in task_rows
            if not _task_is_completed(row) and (parsed_due := _parse_task_due(row.get("due_at"))) and parsed_due < now
        ]
    elif due_filter == "completed_today":
        today = datetime.now().date().isoformat()
        task_rows = [
            row for row in task_rows
            if _task_is_completed(row) and str(row.get("completed_at") or "").startswith(today)
        ]
    if _is_task_admin(request.user) and assignee_filter:
        task_rows = [row for row in task_rows if str(row.get("assignee_id") or "") == assignee_filter]

    task_list = []
    for task in task_rows:
        task_dict = dict(task)
        task_id = _coerce_task_id(task_dict.get("id"), cursor)
        if task_id is not None:
            task_dict["id"] = task_id
        raw_due = str(task_dict.get("due_at") or "").strip()
        due_time = ""
        if raw_due and "T" in raw_due:
            try:
                due_time = datetime.fromisoformat(raw_due.replace("Z", "+00:00")).strftime("%H:%M")
            except Exception:
                due_time = ""
        task_list.append({
            "row": task_dict,
            "details": {
                "title": _display(task_dict.get("title")),
                "description": _display(task_dict.get("description")),
                "due_date": _format_date(task_dict.get("due_at")),
                "due_time": due_time,
                "priority": _display(task_dict.get("mode") or "Medium"),
                "status": "Completed" if bool(task_dict.get("completed_at")) or str(task_dict.get("outcome") or "").strip().lower() == "completed" else _display(task_dict.get("outcome") or "Pending"),
                "assigned_user": _resolve_owner(cursor, task_dict.get("assignee_id")),
                "created_by": "-",
                "bucket": _task_due_bucket(task_dict),
                "is_completed": bool(task_dict.get("completed_at")) or str(task_dict.get("outcome") or "").strip().lower() == "completed",
            },
        })

    paginator = Paginator(task_list, 20)
    page_obj = paginator.get_page(page_number)
    conn.close()

    visible_user_ids = [str(user.id) for user in _task_assignable_users(request.user)]
    assignee_user_lookup = {str(user.id): _task_user_label(user) for user in User.objects.filter(is_active=True, id__in=[int(uid) for uid in visible_user_ids if str(uid).isdigit()])}
    calendar_days = defaultdict(list)
    for task_item in task_list:
        task_row = task_item["row"]
        due_at = (task_row.get("due_at") or "").strip()
        if not due_at:
            continue
        try:
            due_date = datetime.fromisoformat(due_at.replace("Z", "+00:00")).date().isoformat()
        except Exception:
            try:
                due_date = datetime.strptime(due_at, "%Y-%m-%d").date().isoformat()
            except Exception:
                continue
        calendar_days[due_date].append(task_item)

    today = datetime.now().date()

    try:
        calendar_year = int(request.GET.get("cal_year") or today.year)
    except (TypeError, ValueError):
        calendar_year = today.year
    try:
        calendar_month = int(request.GET.get("cal_month") or today.month)
    except (TypeError, ValueError):
        calendar_month = today.month

    if calendar_month < 1:
        calendar_month = 12
        calendar_year -= 1
    elif calendar_month > 12:
        calendar_month = 1
        calendar_year += 1
    calendar_year = max(1, min(calendar_year, 9999))

    calendar_month_matrix = calendar.Calendar(firstweekday=0).monthdayscalendar(calendar_year, calendar_month)
    calendar_payload = []
    for week in calendar_month_matrix:
        row_days = []
        for day in week:
            if day == 0:
                row_days.append({"day": None, "date_key": None, "tasks": []})
                continue
            date_obj = datetime(calendar_year, calendar_month, day).date()
            date_key = date_obj.isoformat()
            row_days.append({"day": day, "date_key": date_key, "tasks": calendar_days.get(date_key, []), "is_today": date_obj == today})
        calendar_payload.append(row_days)

    def _calendar_nav_query(year, month):
        params = request.GET.copy()
        params["cal_year"] = str(year)
        params["cal_month"] = str(month)
        params.pop("page", None)
        return params.urlencode()

    if calendar_month == 1:
        prev_month, prev_month_year = 12, calendar_year - 1
    else:
        prev_month, prev_month_year = calendar_month - 1, calendar_year

    if calendar_month == 12:
        next_month, next_month_year = 1, calendar_year + 1
    else:
        next_month, next_month_year = calendar_month + 1, calendar_year

    return render(request, "tasks.html", {
        "task_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "page_query_params": [(key, value) for key, value in request.GET.items() if key != "page"],
        "query": query,
        "status_filter": status_filter,
        "priority_filter": priority_filter,
        "due_filter": due_filter,
        "assignee_filter": assignee_filter,
        "selected_task_id": selected_task_id,
        "assignee_user_lookup": assignee_user_lookup,
        "calendar_payload": calendar_payload,
        "calendar_year": calendar_year,
        "calendar_month": calendar_month,
        "calendar_month_name": calendar.month_name[calendar_month],
        "calendar_prev_month_query": _calendar_nav_query(prev_month_year, prev_month),
        "calendar_next_month_query": _calendar_nav_query(next_month_year, next_month),
        "calendar_prev_year_query": _calendar_nav_query(calendar_year - 1, calendar_month),
        "calendar_next_year_query": _calendar_nav_query(calendar_year + 1, calendar_month),
        "calendar_today_query": _calendar_nav_query(today.year, today.month),
        "task_scope": "all" if _is_task_admin(request.user) else "my",
        "is_admin": _is_task_admin(request.user),
        "assignable_users": _task_assignable_users(request.user),
    })


def tickets(request):
    redirect_response = _handle_form_submission(request, "tickets", "tickets", ["title", "description", "priority", "status", "type", "owner_id"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    sort_field = (request.GET.get("sort") or "created_at").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM tickets"
    params = []
    if query:
        search_term = f"%{query}%"
        sql += " WHERE title LIKE ? OR description LIKE ? OR priority LIKE ? OR status LIKE ?"
        params.extend([search_term, search_term, search_term, search_term])

    allowed_sort_fields = {"created_at": "created_at", "priority": "priority", "status": "status", "title": "title"}
    sort_column = allowed_sort_fields.get(sort_field, "created_at")
    sql += f" ORDER BY {sort_column} {'ASC' if sort_order == 'asc' else 'DESC'}, rowid DESC"
    cursor.execute(sql, params)
    ticket_rows = cursor.fetchall()

    ticket_list = []
    for ticket in ticket_rows:
        ticket_dict = dict(ticket)
        ticket_list.append({
            "row": ticket_dict,
            "details": {
                "subject": _display(ticket_dict.get("title")),
                "status": _display(ticket_dict.get("status")),
                "priority": _display(ticket_dict.get("priority")),
                "category": _display(ticket_dict.get("type")),
                "assigned_user": _resolve_owner(cursor, ticket_dict.get("owner_id")),
                "description": _display(ticket_dict.get("description")),
            },
        })

    paginator = Paginator(ticket_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "tickets.html", {
        "ticket_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "page_query_params": [(key, value) for key, value in request.GET.items() if key != "page"],
        "query": query,
        "sort": sort_field,
        "order": sort_order,
    })


def lead_detail(request, record_id):
    return redirect("leads")


def deal_detail(request, record_id):
    return redirect("deals")


def activity_detail(request, record_id):
    return redirect("activities")


def task_detail(request, record_id):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (_coerce_task_id(record_id, cursor),))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        return redirect("tasks")
    task_dict = dict(task_row)
    if not _task_visible_to_user(request.user, task_dict):
        conn.close()
        return HttpResponseForbidden("403 Forbidden")
    conn.close()
    return redirect(f"{reverse('tasks')}?task={task_dict.get('id')}")


def ticket_detail(request, record_id):
    return redirect("tickets")


def contacts(request):
    query = (request.GET.get("q") or "").strip()
    page_number = request.GET.get("page", 1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    sql = "SELECT * FROM contacts WHERE deleted_at IS NULL"
    params = []
    if query:
        search_term = f"%{query}%"
        sql += " AND (full_name LIKE ? OR role LIKE ? OR phone LIKE ? OR email LIKE ? OR notes LIKE ?)"
        params.extend([search_term, search_term, search_term, search_term, search_term])

    sql += " ORDER BY created_at DESC, rowid DESC"
    cursor.execute(sql, params)
    contacts_rows = cursor.fetchall()
    contact_list = []
    for contact in contacts_rows:
        contact_list.append({
            "contact": contact,
            "details": _fetch_contact_details(contact),
        })

    paginator = Paginator(contact_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()

    return render(request, "contacts.html", {
        "contact_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "query": query,
    })


def dashboard(request):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM contacts")
    contacts_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads")
    leads_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM deals")
    deals_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM activities")
    activities_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tasks")
    tasks_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM tickets")
    tickets_count = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 5")
    recent_contacts = cursor.fetchall()

    cursor.execute("SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 5")
    recent_leads = cursor.fetchall()

    if _is_task_admin(request.user):
        task_scope = (request.GET.get("task_scope") or "my").strip().lower()
        if task_scope == "team":
            task_sql = "SELECT * FROM tasks WHERE assignee_id IS NOT NULL AND assignee_id != ? ORDER BY due_at ASC, rowid DESC LIMIT 5"
            cursor.execute(task_sql, (str(request.user.id),))
        elif task_scope == "all":
            cursor.execute("SELECT * FROM tasks ORDER BY due_at ASC, rowid DESC LIMIT 5")
        else:
            cursor.execute("SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_at ASC, rowid DESC LIMIT 5", (str(request.user.id),))
    else:
        cursor.execute("SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_at ASC, rowid DESC LIMIT 5", (str(request.user.id),))
        task_scope = "my"
    upcoming_followups = cursor.fetchall()

    cursor.execute(
        "SELECT COALESCE(SUM(COALESCE(won_value_minor, expected_value_minor)), 0) FROM deals WHERE deleted_at IS NULL"
    )
    total_pipeline_value = cursor.fetchone()[0] or 0

    cursor.execute(
        "SELECT name, COALESCE(expected_value_minor, won_value_minor) AS amount FROM deals WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 7"
    )
    chart_rows = cursor.fetchall()

    chart_labels = [(_display(row[0])[:18] or f"Deal {index + 1}") for index, row in enumerate(chart_rows)]
    chart_values = []
    for row in chart_rows:
        try:
            chart_values.append(float(row[1] or 0))
        except Exception:
            chart_values.append(0)

    conn.close()
    task_dashboard = _task_state_data(request.user)["dashboard"]

    return render(request, "dashboard.html", {
        "contacts_count": contacts_count,
        "leads_count": leads_count,
        "deals_count": deals_count,
        "activities_count": activities_count,
        "tasks_count": tasks_count,
        "tickets_count": tickets_count,
        "recent_contacts": recent_contacts,
        "recent_leads": recent_leads,
        "upcoming_followups": upcoming_followups,
        "total_pipeline_value": _format_amount(total_pipeline_value),
        "chart_labels": chart_labels,
        "chart_values": chart_values,
        "chart_labels_json": json.dumps(chart_labels),
        "chart_values_json": json.dumps(chart_values),
        "recent_activities": fetch_latest_rows("activities"),
        "recent_deals": fetch_latest_rows("deals"),
        "recent_tasks": fetch_latest_rows("tasks"),
        "task_dashboard": task_dashboard,
        "assignable_users": _task_assignable_users(request.user),
    })


def profile(request):
    if request.method == "POST":
        first_name = (request.POST.get("first_name") or "").strip()
        last_name = (request.POST.get("last_name") or "").strip()
        email = (request.POST.get("email") or "").strip()
        new_password = (request.POST.get("password") or "").strip()
        confirm_password = (request.POST.get("confirm_password") or "").strip()

        request.user.first_name = first_name
        request.user.last_name = last_name
        request.user.email = email

        if new_password or confirm_password:
            if new_password != confirm_password:
                messages.error(request, "Password confirmation does not match.")
                return redirect("profile")
            try:
                validate_password(new_password, request.user)
            except ValidationError as exc:
                messages.error(request, " ".join(exc.messages))
                return redirect("profile")
            request.user.set_password(new_password)
            request.user.save()
            messages.success(request, "Profile and password updated. Please sign in again.")
            return redirect("login")

        request.user.save()
        messages.success(request, "Profile updated successfully.")
        return redirect("profile")

    return render(request, "auth/profile.html")


def analytics_dashboard(request):
    import json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL")
    kpi_total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE junk_reason_id IS NULL AND deleted_at IS NULL")
    kpi_clean = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE junk_reason_id IS NOT NULL AND deleted_at IS NULL")
    kpi_junk = cursor.fetchone()[0]

    cursor.execute("""SELECT s.label, COUNT(l.id) as count
        FROM leads l JOIN sources s ON l.primary_source_id = s.id
        WHERE l.deleted_at IS NULL GROUP BY s.label ORDER BY count DESC""")
    leads_by_source = [{"source": r[0], "count": r[1]} for r in cursor.fetchall()]

    cursor.execute("""SELECT s.label,
        SUM(CASE WHEN l.junk_reason_id IS NOT NULL THEN 1 ELSE 0 END) as junk,
        SUM(CASE WHEN l.junk_reason_id IS NULL THEN 1 ELSE 0 END) as clean
        FROM leads l JOIN sources s ON l.primary_source_id = s.id
        WHERE l.deleted_at IS NULL GROUP BY s.label""")
    junk_by_source = [{"source": r[0], "junk": r[1], "clean": r[2]} for r in cursor.fetchall()]

    cursor.execute("""SELECT u.name, COUNT(d.id),
        SUM(CASE WHEN ps.terminal_type='won' THEN 1 ELSE 0 END),
        SUM(CASE WHEN ps.terminal_type='lost' THEN 1 ELSE 0 END),
        ROUND(100.0*SUM(CASE WHEN ps.terminal_type='won' THEN 1 ELSE 0 END)/COUNT(d.id),1),
        ROUND(SUM(CASE WHEN ps.terminal_type='won' THEN d.won_value_minor ELSE 0 END)/100.0,0)
        FROM deals d JOIN users u ON d.owner_id=u.id
        JOIN pipeline_stages ps ON d.stage_id=ps.id
        WHERE d.deleted_at IS NULL GROUP BY u.name ORDER BY 2 DESC""")
    rep_performance = [{"rep": r[0], "deals": r[1], "won": r[2], "lost": r[3], "win_rate": r[4], "revenue": r[5]} for r in cursor.fetchall()]

    cursor.execute("""SELECT lr.label, COUNT(d.id),
        ROUND(SUM(COALESCE(d.expected_value_minor,0))/100.0,0)
        FROM deals d JOIN lost_reasons lr ON d.lost_reason_id=lr.id
        WHERE d.lost_reason_id IS NOT NULL GROUP BY lr.label ORDER BY 2 DESC""")
    lost_reasons = [{"reason": r[0], "count": r[1], "value_sar": r[2]} for r in cursor.fetchall()]

    cursor.execute("""SELECT s.label,
        ROUND(AVG((julianday(a.occurred_at)-julianday(l.created_at))*24),1)
        FROM activities a JOIN leads l ON a.entity_id=l.id AND a.entity_type='lead'
        JOIN sources s ON l.primary_source_id=s.id
        WHERE a.occurred_at>l.created_at AND l.deleted_at IS NULL
        GROUP BY s.label ORDER BY 2 ASC""")
    response_time = [{"source": r[0], "hours": r[1]} for r in cursor.fetchall()]

    conn.close()
    return render(request, "analytics.html", {
        "kpi_total": kpi_total,
        "kpi_clean": kpi_clean,
        "kpi_junk": kpi_junk,
        "leads_by_source_json": json.dumps(leads_by_source),
        "junk_by_source_json": json.dumps(junk_by_source),
        "rep_performance_json": json.dumps(rep_performance),
        "lost_reasons_json": json.dumps(lost_reasons),
        "response_time_json": json.dumps(response_time),
    })


def lead_scoring(request):
    return render(request, "lead_scoring.html", {})


def predict_lead(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    source = data.get("source", "Instagram")
    has_campaign = bool(data.get("has_campaign", False))
    has_quiz_answers = bool(data.get("has_quiz_answers", False))
    matched_at_intake = bool(data.get("matched_at_intake", False))
    source_junk_rates = {
        "Instagram": 0.805,
        "Website": 0.750,
        "TikTok": 0.667,
        "Snapchat": 0.388,
        "Partner Referral": 0.000,
        "Employee Referral": 0.000,
    }
    base = source_junk_rates.get(source, 0.5)
    if matched_at_intake:
        base *= 0.2
    if has_campaign:
        base *= 0.9
    if has_quiz_answers:
        base *= 0.85
    p_junk = round(min(base, 1.0), 3)
    p_clean = round(1.0 - p_junk, 3)
    is_junk = p_junk >= 0.5
    return JsonResponse({"is_junk": is_junk, "p_junk": p_junk, "p_clean": p_clean})


def auth_portal(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    login_form = AuthenticationForm(request, data=request.POST if request.method == "POST" and request.POST.get("form_type") == "login" else None)
    register_form = CRMUserCreationForm(request.POST if request.method == "POST" and request.POST.get("form_type") == "register" else None)
    if request.method == "POST":
        active_form = request.POST.get("form_type")
    elif request.path.rstrip("/").endswith("auth/register"):
        active_form = "register"
    else:
        active_form = "login"
    register_success = False

    if request.method == "POST":
        form_type = request.POST.get("form_type")
        if form_type == "login" and login_form.is_valid():
            _ensure_custom_permissions_and_groups()
            user = login_form.get_user()
            _assign_default_viewer_role(user)
            login(request, user)
            return redirect("dashboard")
        if form_type == "register" and register_form.is_valid():
            _ensure_custom_permissions_and_groups()
            try:
                with transaction.atomic():
                    user = register_form.save()
                    user.first_name = (request.POST.get("first_name") or "").strip()
                    user.last_name = (request.POST.get("last_name") or "").strip()
                    user.save()
            except IntegrityError:
                # A concurrent registration (e.g. a double-submit) can create a
                # user with this username after the form's uniqueness check but
                # before this insert, tripping the auth_user.username UNIQUE
                # constraint. Surface it as a form error instead of a 500.
                register_form.add_error("username", "A user with that username already exists.")
            else:
                # Every new user automatically gets analytics + lead scoring view access.
                try:
                    for codename in ['analytics_view', 'lead_scoring_view']:
                        perm = Permission.objects.get(codename=codename)
                        user.user_permissions.add(perm)
                except Exception:
                    pass

                has_system_admin = User.objects.filter(groups__name=SYSTEM_ADMIN_ROLE).exists() or User.objects.filter(is_superuser=True).exists()
                if not has_system_admin:
                    _assign_role(user, SYSTEM_ADMIN_ROLE)
                else:
                    _assign_role(user, "Viewer")

                authenticated_user = authenticate(
                    request,
                    username=user.username,
                    password=register_form.cleaned_data["password1"],
                )
                if authenticated_user is not None:
                    login(request, authenticated_user)
                    return redirect("dashboard")
                register_success = True
                messages.success(request, "Account created. Please sign in.")
                active_form = "login"

    return render(request, "auth/login.html", {
        "login_form": login_form,
        "register_form": register_form,
        "active_form": active_form,
        "register_success": register_success,
    })


def _ensure_custom_permissions_and_groups():
    content_type = ContentType.objects.get_for_model(User)
    permission_lookup = {}
    for full_name in ALL_PERMISSION_NAMES:
        perm_code = full_name.split(".", 1)[1]
        permission, _ = Permission.objects.get_or_create(
            codename=perm_code,
            content_type=content_type,
            defaults={"name": f"Can {perm_code.replace('_', ' ')}"},
        )
        permission_lookup[perm_code] = permission

    role_permission_map = {
        "System Administrator": [name.split(".", 1)[1] for name in ALL_PERMISSION_NAMES],
        "Sales Manager": [
            "dashboard_view", "dashboard_create", "dashboard_edit", "dashboard_delete",
            "contacts_view", "contacts_create", "contacts_edit", "contacts_delete",
            "leads_view", "leads_create", "leads_edit", "leads_delete",
            "deals_view", "deals_create", "deals_edit", "deals_delete",
            "activities_view", "activities_create", "activities_edit", "activities_delete",
            "tasks_view", "tasks_create", "tasks_edit", "tasks_delete",
            "tickets_view", "tickets_create", "tickets_edit", "tickets_delete",
            "reports_view", "reports_create", "reports_edit", "reports_delete",
        ],
        "Sales Representative": [
            "dashboard_view", "dashboard_create", "dashboard_edit", "dashboard_delete",
            "contacts_view", "contacts_create", "contacts_edit",
            "leads_view", "leads_create", "leads_edit",
            "deals_view", "deals_create", "deals_edit",
            "activities_view", "activities_create", "activities_edit",
            "tasks_view", "tasks_create", "tasks_edit",
            "tickets_view",
        ],
        "Support": [
            "dashboard_view", "dashboard_create", "dashboard_edit", "dashboard_delete",
            "contacts_view",
            "leads_view",
            "deals_view",
            "activities_view", "activities_create", "activities_edit",
            "tasks_view", "tasks_create", "tasks_edit",
            "tickets_view", "tickets_create", "tickets_edit", "tickets_delete",
        ],
        "Viewer": [
            "dashboard_view", "dashboard_create", "dashboard_edit", "dashboard_delete",
            "contacts_view",
            "leads_view",
            "deals_view",
            "activities_view",
            "tasks_view",
            "tickets_view",
        ],
    }

    for role_name, permission_codes in role_permission_map.items():
        group, _ = Group.objects.get_or_create(name=role_name)
        perms = [permission_lookup.get(code) for code in permission_codes]
        group.permissions.set([perm for perm in perms if perm])

    all_role_names = set(role_permission_map.keys())
    for existing_group in Group.objects.filter(name__in=all_role_names):
        expected_codes = set(role_permission_map.get(existing_group.name, []))
        expected_permissions = [permission_lookup.get(code) for code in expected_codes]
        existing_group.permissions.set([perm for perm in expected_permissions if perm])


def _assign_role(user, role_name):
    role_group = Group.objects.filter(name=role_name).first()
    if role_group:
        user.groups.set([role_group])


def _assign_default_viewer_role(user):
    if not user.is_authenticated or user.is_superuser:
        return
    if user.groups.exists():
        return
    _assign_role(user, "Viewer")


def _split_full_name(full_name):
    value = (full_name or "").strip()
    if not value:
        return "", ""
    parts = value.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


PERMISSION_GROUPS = [
    ("Dashboard", "dashboard"),
    ("Contacts", "contacts"),
    ("Leads", "leads"),
    ("Deals", "deals"),
    ("Activities", "activities"),
    ("Tasks", "tasks"),
    ("Tickets", "tickets"),
    ("Reports", "reports"),
    ("Users", "users"),
]

PERMISSION_ACTIONS = [
    ("view", "View"),
    ("create", "Create"),
    ("edit", "Edit"),
    ("delete", "Delete"),
]


def users_admin(request):
    _ensure_custom_permissions_and_groups()

    role_groups = Group.objects.filter(name__in=["System Administrator", "Sales Manager", "Sales Representative", "Support", "Viewer"]).order_by("name")
    allowed_permission_codes = [name.split(".", 1)[1] for name in ALL_PERMISSION_NAMES]
    custom_permissions = Permission.objects.filter(codename__in=allowed_permission_codes).order_by("codename")
    allowed_permission_ids = set(custom_permissions.values_list("id", flat=True))

    def _clean_permission_ids(raw_ids):
        clean_ids = []
        for raw_id in raw_ids:
            try:
                permission_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if permission_id in allowed_permission_ids:
                clean_ids.append(permission_id)
        return clean_ids

    if request.method == "POST":
        action = (request.POST.get("action") or "").strip()

        if action == "create_user":
            if not can_do(request.user, "users", "create"):
                return HttpResponseForbidden("403 Forbidden")

            username = (request.POST.get("username") or "").strip()
            first_name = (request.POST.get("first_name") or "").strip()
            last_name = (request.POST.get("last_name") or "").strip()
            email = (request.POST.get("email") or "").strip()
            password = (request.POST.get("password") or "").strip()
            confirm_password = (request.POST.get("confirm_password") or "").strip()
            role_name = (request.POST.get("role_name") or "Viewer").strip()
            permission_ids = _clean_permission_ids(request.POST.getlist("permission_ids")) if has_permission(request.user, RESOURCE_ACTION_PERMS["users"]["manage_permissions"]) else []

            if not username or not password:
                messages.error(request, "Username and password are required.")
            elif password != confirm_password:
                messages.error(request, "Password confirmation does not match.")
            elif User.objects.filter(username=username).exists():
                messages.error(request, "Username already exists.")
            else:
                try:
                    validate_password(password)
                except ValidationError as exc:
                    messages.error(request, " ".join(exc.messages))
                    return redirect("users")

                user = User.objects.create_user(username=username, email=email, password=password)
                user.first_name = first_name
                user.last_name = last_name
                user.is_active = request.POST.get("is_active") == "on"
                user.save()
                if has_permission(request.user, RESOURCE_ACTION_PERMS["users"]["manage_roles"]):
                    _assign_role(user, role_name)
                else:
                    _assign_role(user, "Viewer")
                user.user_permissions.set(Permission.objects.filter(id__in=permission_ids))
                messages.success(request, "User created successfully.")

        elif action == "update_user":
            if not can_do(request.user, "users", "edit"):
                return HttpResponseForbidden("403 Forbidden")

            user_id = (request.POST.get("user_id") or "").strip()
            user = User.objects.filter(id=user_id).first()
            if not user:
                messages.error(request, "User not found.")
            else:
                username = (request.POST.get("username") or "").strip()
                if username and User.objects.filter(username=username).exclude(id=user.id).exists():
                    messages.error(request, "Username already exists.")
                    return redirect("users")

                user.username = username or user.username
                user.email = (request.POST.get("email") or "").strip()
                user.first_name = (request.POST.get("first_name") or "").strip()
                user.last_name = (request.POST.get("last_name") or "").strip()
                user.is_active = request.POST.get("is_active") == "on"
                new_password = (request.POST.get("password") or "").strip()
                confirm_password = (request.POST.get("confirm_password") or "").strip()
                if new_password or confirm_password:
                    if new_password != confirm_password:
                        messages.error(request, "Password confirmation does not match.")
                        return redirect("users")
                    try:
                        validate_password(new_password, user)
                    except ValidationError as exc:
                        messages.error(request, " ".join(exc.messages))
                        return redirect("users")
                    user.set_password(new_password)
                user.save()
                if has_permission(request.user, RESOURCE_ACTION_PERMS["users"]["manage_roles"]):
                    role_name = (request.POST.get("role_name") or "Viewer").strip()
                    if user == request.user and role_name != SYSTEM_ADMIN_ROLE:
                        messages.error(request, "You cannot remove your own System Administrator role.")
                        return redirect("users")
                    _assign_role(user, role_name)
                if has_permission(request.user, RESOURCE_ACTION_PERMS["users"]["manage_permissions"]):
                    permission_ids = _clean_permission_ids(request.POST.getlist("permission_ids"))
                    user.user_permissions.set(Permission.objects.filter(id__in=permission_ids))
                messages.success(request, "User updated successfully.")

        elif action == "activate_user":
            if not can_do(request.user, "users", "edit"):
                return HttpResponseForbidden("403 Forbidden")
            user_id = (request.POST.get("user_id") or "").strip()
            user = User.objects.filter(id=user_id).first()
            if user:
                user.is_active = True
                user.save(update_fields=["is_active"])
                messages.success(request, "User activated.")

        elif action == "deactivate_user":
            if not can_do(request.user, "users", "edit"):
                return HttpResponseForbidden("403 Forbidden")
            user_id = (request.POST.get("user_id") or "").strip()
            user = User.objects.filter(id=user_id).first()
            if user:
                if user == request.user:
                    messages.error(request, "You cannot deactivate your own account.")
                    return redirect("users")
                user.is_active = False
                user.save(update_fields=["is_active"])
                messages.success(request, "User deactivated.")

        elif action == "reset_password":
            if not can_do(request.user, "users", "edit"):
                return HttpResponseForbidden("403 Forbidden")
            user_id = (request.POST.get("user_id") or "").strip()
            new_password = (request.POST.get("password") or "").strip()
            confirm_password = (request.POST.get("confirm_password") or "").strip()
            user = User.objects.filter(id=user_id).first()
            if not user:
                messages.error(request, "User not found.")
                return redirect("users")
            if not new_password or new_password != confirm_password:
                messages.error(request, "Reset password and confirmation must match.")
                return redirect("users")
            try:
                validate_password(new_password, user)
            except ValidationError as exc:
                messages.error(request, " ".join(exc.messages))
                return redirect("users")
            user.set_password(new_password)
            user.save()
            messages.success(request, "Password reset successfully.")

        elif action == "update_role_permissions":
            if not has_permission(request.user, RESOURCE_ACTION_PERMS["users"]["manage_permissions"]):
                return HttpResponseForbidden("403 Forbidden")
            role_name = (request.POST.get("role_name") or "").strip()
            permission_ids = _clean_permission_ids(request.POST.getlist("permission_ids"))
            role_group = Group.objects.filter(name=role_name).first()
            if role_group and role_group.name != SYSTEM_ADMIN_ROLE:
                role_group.permissions.set(Permission.objects.filter(id__in=permission_ids))
                messages.success(request, f"Permissions updated for role: {role_name}.")

        elif action == "delete_user":
            if not can_do(request.user, "users", "delete"):
                return HttpResponseForbidden("403 Forbidden")
            user_id = (request.POST.get("user_id") or "").strip()
            user = User.objects.filter(id=user_id).first()
            if user and user != request.user:
                user.delete()
                messages.success(request, "User deleted successfully.")
            else:
                messages.error(request, "Cannot delete this user.")

        return redirect("users")

    query = (request.GET.get("q") or "").strip()
    status_filter = (request.GET.get("status") or "").strip().lower()
    role_filter = (request.GET.get("role") or "").strip()
    sort_field = (request.GET.get("sort") or "date_joined").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)

    users_qs = User.objects.all().prefetch_related("groups", "user_permissions").order_by("-date_joined")
    if query:
        users_qs = users_qs.filter(
            models.Q(username__icontains=query)
            | models.Q(first_name__icontains=query)
            | models.Q(last_name__icontains=query)
            | models.Q(email__icontains=query)
        )
    if status_filter in {"active", "inactive"}:
        users_qs = users_qs.filter(is_active=(status_filter == "active"))
    if role_filter:
        users_qs = users_qs.filter(groups__name=role_filter)

    sort_map = {
        "username": "username",
        "full_name": "first_name",
        "email": "email",
        "status": "is_active",
        "last_login": "last_login",
        "date_joined": "date_joined",
    }
    sort_column = sort_map.get(sort_field, "date_joined")
    order_prefix = "" if sort_order == "asc" else "-"
    users_qs = users_qs.order_by(f"{order_prefix}{sort_column}", "username").distinct()

    paginator = Paginator(users_qs, 12)
    page_obj = paginator.get_page(page_number)

    role_permissions = {
        group.name: set(group.permissions.values_list("id", flat=True))
        for group in role_groups
    }
    role_permissions_json = {
        role_name: sorted(list(permission_ids))
        for role_name, permission_ids in role_permissions.items()
    }
    for listed_user in page_obj.object_list:
        listed_user.direct_permission_ids = set(listed_user.user_permissions.values_list("id", flat=True))

    permissions_by_codename = {permission.codename: permission for permission in custom_permissions}
    grouped_permissions = []
    for group_label, group_key in PERMISSION_GROUPS:
        group_items = []
        for action_key, action_label in PERMISSION_ACTIONS:
            codename = f"{group_key}_{action_key}"
            permission = permissions_by_codename.get(codename)
            if permission:
                group_items.append({
                    "id": permission.id,
                    "codename": permission.codename,
                    "action_key": action_key,
                    "action_label": action_label,
                    "label": f"{group_label} {action_label}",
                })
        if group_items:
            grouped_permissions.append({
                "group_label": group_label,
                "group_key": group_key,
                "items": group_items,
            })

    return render(request, "admin_users.html", {
        "users": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "query": query,
        "status_filter": status_filter,
        "role_filter": role_filter,
        "sort": sort_field,
        "order": sort_order,
        "role_groups": role_groups,
        "custom_permissions": custom_permissions,
        "role_permissions": role_permissions,
        "role_permissions_json": role_permissions_json,
        "grouped_permissions": grouped_permissions,
    })
