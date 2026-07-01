import json
import re
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from django.core.paginator import Paginator
from django.shortcuts import redirect, render
from django.urls import reverse

DB_PATH = Path(__file__).resolve().parent.parent / "crm.db"


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


def _safe_lookup(cursor, table_name, label_columns=("name", "label", "title", "display_name", "full_name")):
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
    for table_name in ("users", "employees", "contacts"):
        lookup = _safe_lookup(cursor, table_name)
        if str(owner_id) in lookup:
            return lookup[str(owner_id)]
    return _display(owner_id)


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


def _query_without(request, *keys):
    params = request.GET.copy()
    for key in keys:
        params.pop(key, None)
    return params.urlencode()


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
        lead_list.append({
            "row": lead_dict,
            "details": {
                "name": _display(lead_dict.get("full_name")),
                "company": _display(company_lookup.get(str(lead_dict.get("establishment_id"))) or lead_dict.get("company_name")),
                "stage": _display(stage_lookup.get(str(lead_dict.get("stage_id")))),
                "status": "Active" if (lead_dict.get("notes") or lead_dict.get("normalized_phone") or lead_dict.get("normalized_email")) else "Pending",
                "phone": _display(lead_dict.get("normalized_phone")),
                "email": _display(lead_dict.get("normalized_email")),
                "value": _display(_extract_custom_value(lead_dict.get("custom_fields")) or lead_dict.get("value")),
                "owner": _display(owner_lookup.get(str(lead_dict.get("owner_id"))) or lead_dict.get("owner_id")),
                "notes": _display(lead_dict.get("notes")),
            },
        })

    paginator = Paginator(lead_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "leads.html", {
        "lead_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "query": query,
        "sort": sort_field,
        "order": sort_order,
        "stage_lookup": stage_lookup,
    })


def deals(request):
    redirect_response = _handle_form_submission(request, "deals", "deals", ["name", "notes", "expected_value_minor", "currency_code", "stage_id", "probability_pct", "target_close_date"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    stage_filter = (request.GET.get("stage") or "").strip()
    sort_field = (request.GET.get("sort") or "created_at").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM deals WHERE deleted_at IS NULL"
    params = []
    if query:
        search_term = f"%{query}%"
        sql += " AND (name LIKE ? OR notes LIKE ? OR currency_code LIKE ?)"
        params.extend([search_term, search_term, search_term])

    allowed_sort_fields = {"created_at": "created_at", "name": "name", "stage_id": "stage_id", "expected_value_minor": "expected_value_minor"}
    sort_column = allowed_sort_fields.get(sort_field, "created_at")
    sql += f" ORDER BY {sort_column} {'ASC' if sort_order == 'asc' else 'DESC'}, rowid DESC"
    cursor.execute(sql, params)
    deal_rows = cursor.fetchall()

    stage_lookup = _safe_lookup(cursor, "pipeline_stages")
    company_lookup = _safe_lookup(cursor, "establishments")
    contact_lookup = _safe_lookup(cursor, "contacts", label_columns=("full_name", "name", "label"))
    lead_lookup = _safe_lookup(cursor, "leads", label_columns=("full_name", "name", "label"))

    stage_columns = []
    try:
        cursor.execute("SELECT id, name FROM pipeline_stages ORDER BY rowid ASC")
        stage_columns = [
            {"id": str(row[0]), "name": _display(row[1])}
            for row in cursor.fetchall()
            if row[0] is not None
        ]
    except Exception:
        stage_columns = []

    if not stage_columns:
        stage_columns = [{"id": "unassigned", "name": "Unassigned"}]

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

    stage_map = {column["name"]: [] for column in stage_columns}
    deal_list = []
    for deal in deal_rows:
        deal_dict = dict(deal)
        amount = deal_dict.get("won_value_minor") or deal_dict.get("expected_value_minor")
        close_date = deal_dict.get("actual_close_date") or deal_dict.get("target_close_date") or deal_dict.get("contract_end_date")
        stage_name = _stage_name_from_id(deal_dict.get("stage_id"))

        if stage_name not in stage_map:
            stage_map[stage_name] = []
            stage_columns.append({"id": str(deal_dict.get("stage_id") or stage_name).lower(), "name": stage_name})

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
        }

        item = {
            "row": deal_dict,
            "details": details,
        }

        stage_map[stage_name].append(item)
        deal_list.append(item)

    if stage_filter:
        normalized_filter = stage_filter.lower()
        if normalized_filter == "unassigned":
            deal_list = [item for item in deal_list if (item["details"].get("stage") or "").lower() == "unassigned"]
        else:
            deal_list = [item for item in deal_list if (item["details"].get("stage") or "").lower() == normalized_filter]

    normalized_stage_columns = []
    seen_stage_names = set()
    for column in stage_columns:
        column_name = column["name"]
        if stage_filter and column_name.lower() != stage_filter.lower():
            continue
        if column_name in seen_stage_names:
            continue
        seen_stage_names.add(column_name)
        normalized_stage_columns.append({
            "id": column["id"],
            "name": column["name"],
            "items": [],
        })

    if stage_filter and stage_filter.lower() == "unassigned" and not normalized_stage_columns:
        normalized_stage_columns.append({"id": "unassigned", "name": "Unassigned", "items": []})

    paginator = Paginator(deal_list, 15)
    page_obj = paginator.get_page(page_number)

    visible_stage_map = {column["name"]: [] for column in normalized_stage_columns}
    for item in page_obj.object_list:
        stage_name = item["details"].get("stage") or "Unassigned"
        if stage_name in visible_stage_map:
            visible_stage_map[stage_name].append(item)

    for column in normalized_stage_columns:
        column["items"] = visible_stage_map.get(column["name"], [])

    stage_filter_options = ["All Stages"]
    stage_filter_options.extend([column["name"] for column in stage_columns if column["name"] not in stage_filter_options])
    if "Unassigned" not in stage_filter_options:
        stage_filter_options.append("Unassigned")

    conn.close()
    return render(request, "deals.html", {
        "deal_list": page_obj.object_list,
        "stage_columns": normalized_stage_columns,
        "stage_filter": stage_filter,
        "stage_filter_options": stage_filter_options,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "query": query,
        "sort": sort_field,
        "order": sort_order,
        "stage_lookup": stage_lookup,
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
    if query:
        search_term = f"%{query}%"
        sql += " AND (body LIKE ? OR outcome LIKE ? OR direction LIKE ?)"
        params.extend([search_term, search_term, search_term])

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
    contact_lookup = _safe_lookup(cursor, "contacts", label_columns=("full_name", "name", "label"))
    user_lookup = _safe_lookup(cursor, "users")
    if not user_lookup:
        user_lookup = _safe_lookup(cursor, "employees")

    direction_options = set()
    assigned_user_options = {}
    activity_list = []
    for activity in activity_rows:
        activity_dict = dict(activity)
        activity_contact_id = activity_dict.get("contact_id") or (
            activity_dict.get("entity_id") if (activity_dict.get("entity_type") or "").lower() == "contact" else None
        )
        contact_name = _display(contact_lookup.get(str(activity_contact_id)) if activity_contact_id else None)
        assigned_user_id = activity_dict.get("user_id") or activity_dict.get("owner_id") or activity_dict.get("created_by")
        assigned_user = _display(user_lookup.get(str(assigned_user_id)) if assigned_user_id else None)
        status = "Completed" if activity_dict.get("outcome") else "Pending"

        if status_filter and status.lower() != status_filter:
            continue

        if activity_dict.get("direction"):
            direction_options.add(_display(activity_dict.get("direction")))

        if assigned_user_id and assigned_user and assigned_user != "-":
            assigned_user_options[str(assigned_user_id)] = assigned_user

        activity_list.append({
            "row": activity_dict,
            "details": {
                "activity_type": _display(activity_type_lookup.get(str(activity_dict.get("activity_type_id")))),
                "description": _display(activity_dict.get("body")),
                "date": _format_date(activity_dict.get("occurred_at") or activity_dict.get("created_at")),
                "direction": _display(activity_dict.get("direction")),
                "outcome": _display(activity_dict.get("outcome")),
                "status": status,
                "contact_id": _display(activity_contact_id),
                "contact_name": contact_name,
                "assigned_user": assigned_user,
            },
        })

    paginator = Paginator(activity_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "activities.html", {
        "activity_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
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


def tasks(request):
    redirect_response = _handle_form_submission(request, "tasks", "tasks", ["title", "description", "due_at", "outcome", "assignee_id"])
    if redirect_response:
        return redirect_response

    query = (request.GET.get("q") or "").strip()
    sort_field = (request.GET.get("sort") or "created_at").strip()
    sort_order = (request.GET.get("order") or "desc").strip().lower()
    page_number = request.GET.get("page", 1)
    conn = _connect()
    cursor = conn.cursor()

    sql = "SELECT * FROM tasks"
    params = []
    if query:
        search_term = f"%{query}%"
        sql += " WHERE title LIKE ? OR description LIKE ? OR outcome LIKE ?"
        params.extend([search_term, search_term, search_term])

    allowed_sort_fields = {"created_at": "created_at", "due_at": "due_at", "title": "title", "outcome": "outcome"}
    sort_column = allowed_sort_fields.get(sort_field, "created_at")
    sql += f" ORDER BY {sort_column} {'ASC' if sort_order == 'asc' else 'DESC'}, rowid DESC"
    cursor.execute(sql, params)
    task_rows = cursor.fetchall()

    task_list = []
    for task in task_rows:
        task_dict = dict(task)
        task_list.append({
            "row": task_dict,
            "details": {
                "title": _display(task_dict.get("title")),
                "description": _display(task_dict.get("description")),
                "due_date": _format_date(task_dict.get("due_at")),
                "priority": "-",
                "status": "Completed" if task_dict.get("completed_at") else "Pending",
                "assigned_user": _resolve_owner(cursor, task_dict.get("assignee_id")),
            },
        })

    paginator = Paginator(task_list, 15)
    page_obj = paginator.get_page(page_number)
    conn.close()
    return render(request, "tasks.html", {
        "task_list": page_obj.object_list,
        "page_obj": page_obj,
        "page_query": _query_without(request, "page"),
        "query": query,
        "sort": sort_field,
        "order": sort_order,
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
    return redirect("tasks")


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

    cursor.execute("SELECT * FROM tasks ORDER BY due_at ASC, rowid DESC LIMIT 5")
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
    })