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
    path("profile/", login_required(views.profile), name="profile"),
    path("contacts/", protect("contacts", views.contacts), name="contacts"),
    path("leads/", protect("leads", views.leads), name="leads"),
    path("deals/", protect("deals", views.deals), name="deals"),
    path("activities/", protect("activities", views.activities), name="activities"),
    path("tasks/", protect("tasks", views.tasks), name="tasks"),
    path("api/tasks/state/", login_required(views.task_state), name="task_state"),
    path("api/tasks/<str:record_id>/action/", login_required(views.task_action), name="task_action"),
    path("tickets/", protect("tickets", views.tickets), name="tickets"),
    path("leads/<str:record_id>/", protect("leads", views.lead_detail), name="lead_detail"),
    path("deals/<str:record_id>/", protect("deals", views.deal_detail), name="deal_detail"),
    path("activities/<str:record_id>/", protect("activities", views.activity_detail), name="activity_detail"),
    path("tasks/<str:record_id>/", protect("tasks", views.task_detail), name="task_detail"),
    path("tickets/<str:record_id>/", protect("tickets", views.ticket_detail), name="ticket_detail"),
]
