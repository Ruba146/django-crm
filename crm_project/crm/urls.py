from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("contacts/", views.contacts, name="contacts"),
    path("leads/", views.leads, name="leads"),
    path("deals/", views.deals, name="deals"),
    path("activities/", views.activities, name="activities"),
    path("tasks/", views.tasks, name="tasks"),
    path("tickets/", views.tickets, name="tickets"),
    path("leads/<str:record_id>/", views.lead_detail, name="lead_detail"),
    path("deals/<str:record_id>/", views.deal_detail, name="deal_detail"),
    path("activities/<str:record_id>/", views.activity_detail, name="activity_detail"),
    path("tasks/<str:record_id>/", views.task_detail, name="task_detail"),
    path("tickets/<str:record_id>/", views.ticket_detail, name="ticket_detail"),
]