import calendar
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase

from .ai_scoring import AIScoringService
from .models import Task
from .views import _task_state_data


class CRMPageTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # The crm.* models are managed=False, so Django does not create their
        # tables in the test database. Raw SQL in the views now runs through
        # Django's connection (the test DB), so create every crm table here from
        # the model definitions to keep the suite hermetic instead of leaking
        # onto the real crm.db. Plain DDL is used (rather than schema_editor,
        # which SQLite refuses to run inside the test's atomic transaction).
        type_map = {
            "TextField": "text",
            "IntegerField": "integer",
            "BigIntegerField": "integer",
            "BooleanField": "bool",
            "DateTimeField": "datetime",
            "DateField": "date",
        }
        with connection.cursor() as cursor:
            for model in apps.get_app_config("crm").get_models():
                columns = []
                for field in model._meta.fields:
                    sql_type = type_map.get(type(field).__name__, "varchar(255)")
                    column = f'"{field.column}" {sql_type}'
                    if field.primary_key:
                        column += " PRIMARY KEY"
                    columns.append(column)
                cursor.execute(
                    f'CREATE TABLE IF NOT EXISTS "{model._meta.db_table}" '
                    f'({", ".join(columns)})'
                )

    def setUp(self):
        Task.objects.all().delete()

    def test_lead_create_via_post_redirects(self):
        response = self.client.post(
            "/leads/",
            {
                "action": "create",
                "full_name": "Ava Carter",
                "normalized_phone": "+1-555-1234",
                "normalized_email": "ava@example.com",
                "notes": "Warm lead",
            },
            HTTP_HOST="127.0.0.1",
        )
        self.assertEqual(response.status_code, 302)

    def test_contacts_page_renders(self):
        response = self.client.get("/contacts/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_leads_page_renders(self):
        response = self.client.get("/leads/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_deals_page_renders(self):
        response = self.client.get("/deals/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_activities_page_renders(self):
        response = self.client.get("/activities/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_tasks_page_renders(self):
        response = self.client.get("/tasks/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_tickets_page_renders(self):
        response = self.client.get("/tickets/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 302)

    def test_login_page_renders(self):
        response = self.client.get("/auth/login/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_password_reset_page_renders(self):
        response = self.client.get("/auth/password-reset/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_task_creation_uses_numeric_primary_key(self):
        User = get_user_model()
        user = User.objects.create_user(username="tasktester", password="secret123", is_superuser=True)
        self.client.force_login(user)

        response = self.client.post(
            "/tasks/",
            {
                "action": "create",
                "title": "Regression task",
                "description": "Task id must stay numeric",
                "due_at": "2026-07-03",
                "priority": "Medium",
                "status": "Pending",
                "assignee_id": str(user.id),
            },
            HTTP_HOST="127.0.0.1",
        )

        self.assertEqual(response.status_code, 302)

        task_id = Task.objects.filter(title="Regression task").values_list("id", flat=True).first()
        self.assertIsNotNone(task_id)
        self.assertTrue(str(task_id).isdigit())

    def test_created_task_uses_one_model_record_across_task_surfaces(self):
        User = get_user_model()
        user = User.objects.create_user(username="sync-task-tester", password="secret123", is_superuser=True)
        self.client.force_login(user)
        due_at = datetime.now().replace(microsecond=0) + timedelta(minutes=30)

        response = self.client.post(
            "/tasks/",
            {
                "action": "create",
                "title": "Synchronized task",
                "description": "Must come from one Task row",
                "due_at": due_at.date().isoformat(),
                "due_time": due_at.strftime("%H:%M"),
                "priority": "High",
                "status": "Pending",
                "assignee_id": str(user.id),
            },
            HTTP_HOST="127.0.0.1",
        )

        self.assertEqual(response.status_code, 302)
        saved_tasks = Task.objects.filter(title="Synchronized task")
        self.assertEqual(saved_tasks.count(), 1)
        saved_task = saved_tasks.get()
        self.assertEqual(saved_task.due_at, due_at.strftime("%Y-%m-%dT%H:%M"))

        state = _task_state_data(user)
        saved_id = str(saved_task.id)
        self.assertIn(saved_id, [task["id"] for task in state["notifications"]["today"]])
        self.assertIn(saved_id, [task["id"] for task in state["reminders"]])
        self.assertIn(saved_id, [task["id"] for task in state["dashboard"]["today_tasks"]])

        response = self.client.get("/tasks/", HTTP_HOST="127.0.0.1")
        self.assertContains(response, "Synchronized task")
        self.assertContains(response, f'data-task-row-id="{saved_id}"')
        self.assertContains(response, f'data-open-task-modal="#taskModal{saved_id}"')

    def test_tasks_page_renders_calendar_day_modal_with_prefilled_due_date(self):
        User = get_user_model()
        user = User.objects.create_user(username="calendartester", password="secret123", is_superuser=True)
        self.client.force_login(user)

        today = date.today().isoformat()
        response = self.client.get("/tasks/", HTTP_HOST="127.0.0.1")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="calendarDayModal"', count=1)
        self.assertContains(
            response,
            'data-bs-target="#calendarDayModal"',
            count=calendar.monthrange(date.today().year, date.today().month)[1],
        )
        self.assertContains(response, f'data-calendar-date="{today}"')
        self.assertContains(response, f'data-calendar-day-panel="{today}"')
        self.assertContains(response, f'name="due_at" value="{today}"')
        self.assertContains(response, 'id="taskEditModal"', count=1)
        self.assertContains(response, 'id="taskNotificationBell"', count=1)
        self.assertContains(response, 'js/task-center.js', count=1)

    def test_task_state_classifies_notifications_and_reminders_without_duplicates(self):
        now = datetime.now().replace(microsecond=0)
        rows = [
            {"id": 901, "title": "Overdue", "due_at": (now - timedelta(minutes=31)).isoformat(), "mode": "High", "outcome": "Pending"},
            {"id": 902, "title": "One hour", "due_at": (now + timedelta(minutes=59)).isoformat(), "mode": "Medium", "outcome": "Pending"},
            {"id": 903, "title": "Completed", "due_at": now.isoformat(), "mode": "Low", "outcome": "Completed", "completed_at": now.isoformat()},
            {"id": 904, "title": "Eight days overdue", "due_at": (now - timedelta(days=8)).isoformat(), "mode": "High", "outcome": "Pending"},
            {"id": 905, "title": "Four hours", "due_at": (now + timedelta(hours=4)).isoformat(), "mode": "Medium", "outcome": "Pending"},
            {"id": 906, "title": "Two days overdue", "due_at": (now - timedelta(days=2)).isoformat(), "mode": "Low", "outcome": "Pending"},
        ]

        with patch("crm.views._visible_task_rows", return_value=rows):
            state = _task_state_data(object())

        notification_ids = [
            task["id"]
            for group in state["notifications"].values()
            for task in group
        ]
        reminder_ids = [task["id"] for task in state["reminders"]]
        self.assertNotIn("903", notification_ids)
        self.assertNotIn("903", reminder_ids)
        self.assertIn("901", reminder_ids)
        self.assertIn("902", reminder_ids)
        self.assertIn("906", reminder_ids)
        self.assertNotIn("904", reminder_ids)
        self.assertNotIn("905", reminder_ids)
        self.assertLess(reminder_ids.index("901"), reminder_ids.index("906"))
        self.assertLess(reminder_ids.index("906"), reminder_ids.index("902"))
        self.assertEqual(len(notification_ids), len(set(notification_ids)))
        self.assertEqual(state["notification_count"], len(state["notifications"]["overdue"]) + len(state["notifications"]["today"]))
        self.assertEqual(state["dashboard"]["completed_today_count"], 1)

    def test_ajax_task_status_toggle_returns_live_state(self):
        User = get_user_model()
        user = User.objects.create_user(username="ajax-task-tester", password="secret123", is_superuser=True)
        self.client.force_login(user)
        task = Task.objects.create(
            id="1901",
            title="AJAX notification test",
            assignee_id=str(user.id),
            due_at=datetime.now().isoformat(),
            mode="High",
            outcome="Pending",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        response = self.client.post(
            f"/api/tasks/{task.id}/action/",
            data=json.dumps({"action": "status", "status": "Completed"}),
            content_type="application/json",
            HTTP_HOST="127.0.0.1",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["task"]["status"], "Completed")
        self.assertNotIn(str(task.id), [task["id"] for task in response.json()["state"]["reminders"]])

        response = self.client.post(
            f"/api/tasks/{task.id}/action/",
            data=json.dumps({"action": "status", "status": "Pending"}),
            content_type="application/json",
            HTTP_HOST="127.0.0.1",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["task"]["status"], "Pending")
        self.assertIn(str(task.id), [task["id"] for task in response.json()["state"]["reminders"]])

    def test_dashboard_renders_live_task_widgets(self):
        User = get_user_model()
        user = User.objects.create_user(username="dashboard-task-tester", password="secret123", is_superuser=True)
        self.client.force_login(user)

        response = self.client.get("/dashboard/", HTTP_HOST="127.0.0.1")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="dashboardTodayTasks"', count=1)
        self.assertContains(response, 'id="dashboardTodayCount"', count=1)

    def test_task_reminders_are_global_non_autohiding_and_not_persistently_dismissed(self):
        base_html = Path("templates/base.html").read_text(encoding="utf-8")
        task_center_js = Path("static/js/task-center.js").read_text(encoding="utf-8")

        self.assertIn('id="taskToastContainer"', base_html)
        self.assertIn("js/task-center.js", base_html)
        self.assertIn("REMINDER_WINDOW_SECONDS = 3 * 60 * 60", task_center_js)
        self.assertNotIn("OVERDUE_REMINDER_WINDOW_SECONDS", task_center_js)
        self.assertIn("expandedReminderId", task_center_js)
        self.assertIn("dismissedReminderIds", task_center_js)
        self.assertIn("dataset.taskReminderExpanded", task_center_js)
        self.assertIn("sortReminderTasks", task_center_js)
        self.assertIn("autohide: false", task_center_js)
        self.assertNotIn("localStorage", task_center_js)
        self.assertNotIn("reminderKey", task_center_js)

    def test_ai_scoring_service_returns_deterministic_score(self):
        today = date.today()
        payload = {
            "activities": [
                {"body": "Customer asked about pricing", "occurred_at": (today - timedelta(days=2)).isoformat()},
                {"body": "Completed a meeting", "occurred_at": (today - timedelta(days=4)).isoformat()},
            ],
            "notes": [
                {"body": "Positive follow-up reply", "created_at": (today - timedelta(days=1)).isoformat()},
            ],
            "tasks": [
                {"title": "Follow up", "due_at": today.isoformat()},
            ],
            "last_activity_date": (today - timedelta(days=1)).isoformat(),
            "stage_history": ["new", "meeting", "qualified"],
        }

        score = AIScoringService.score(payload)

        self.assertGreaterEqual(score["score"], 70)
        self.assertEqual(score["confidence"], "High")
        self.assertTrue(any("pricing" in reason.lower() for reason in score["reasons"]))
