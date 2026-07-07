from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.urls import path
from .access import admin_users_guard, section_guard
from . import views


def protect(section, view):
    return login_required(section_guard(section)(view))

urlpatterns = [
    path("auth/login/", views.auth_portal, name="login"),
    path("auth/register/", views.auth_portal, name="register"),
    path("auth/logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("auth/password-change/", auth_views.PasswordChangeView.as_view(template_name="auth/password_change_form.html"), name="password_change"),
    path("auth/password-change/done/", auth_views.PasswordChangeDoneView.as_view(template_name="auth/password_change_done.html"), name="password_change_done"),
    path("auth/password-reset/", auth_views.PasswordResetView.as_view(template_name="auth/password_reset_form.html", email_template_name="auth/password_reset_email.txt", subject_template_name="auth/password_reset_subject.txt"), name="password_reset"),
    path("auth/password-reset/done/", auth_views.PasswordResetDoneView.as_view(template_name="auth/password_reset_done.html"), name="password_reset_done"),
    path("auth/reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(template_name="auth/password_reset_confirm.html"), name="password_reset_confirm"),
    path("auth/reset/done/", auth_views.PasswordResetCompleteView.as_view(template_name="auth/password_reset_complete.html"), name="password_reset_complete"),

    path("admin/users/", login_required(admin_users_guard(views.users_admin)), name="admin_users"),
    path("users/", login_required(admin_users_guard(views.users_admin)), name="users"),

    path("", protect("dashboard", views.dashboard), name="dashboard"),
    path("dashboard/", protect("dashboard", views.dashboard), name="dashboard_alias"),
    path("api/dashboard/", login_required(views.dashboard_api), name="dashboard_api"),
    path("profile/", login_required(views.profile), name="profile"),
    path("contacts/", protect("contacts", views.contacts), name="contacts"),
    path("api/contacts/", login_required(views.contacts_api), name="contacts_api"),
    path("leads/", protect("leads", views.leads), name="leads"),
    path("api/leads/", login_required(views.leads_api), name="leads_api"),
    path("deals/", protect("deals", views.deals), name="deals"),
    path("api/deals/", login_required(views.deals_api), name="deals_api"),
    path("activities/", protect("activities", views.activities), name="activities"),
    path("api/activities/", login_required(views.activities_api), name="activities_api"),
    path("tasks/", protect("tasks", views.tasks), name="tasks"),
    path("api/tasks/", login_required(views.tasks_api), name="tasks_api"),
    path("api/tasks/state/", login_required(views.task_state), name="task_state"),
    path("api/tasks/<str:record_id>/action/", login_required(views.task_action), name="task_action"),
    path("tickets/", protect("tickets", views.tickets), name="tickets"),
    path("api/tickets/", login_required(views.tickets_api), name="tickets_api"),
    path("analytics/", protect("analytics", views.analytics_dashboard), name="analytics"),
    path("api/analytics/", login_required(views.analytics_api), name="analytics_api"),
    path("lead-scoring/", protect("lead_scoring", views.lead_scoring), name="lead_scoring"),
    path("api/predict/", login_required(views.predict_lead), name="predict_lead"),
    path("leads/<str:record_id>/", protect("leads", views.lead_detail), name="lead_detail"),
    path("deals/<str:record_id>/", protect("deals", views.deal_detail), name="deal_detail"),
    path("activities/<str:record_id>/", protect("activities", views.activity_detail), name="activity_detail"),
    path("tasks/<str:record_id>/", protect("tasks", views.task_detail), name="task_detail"),
    path("tickets/<str:record_id>/", protect("tickets", views.ticket_detail), name="ticket_detail"),
    path("api/users/", login_required(views.users_api), name="users_api"),
]