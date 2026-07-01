from django.db import models


class Contact(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=255, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    role = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    establishment_id = models.CharField(max_length=255, blank=True, null=True)
    preferred_channel = models.CharField(max_length=255, blank=True, null=True)
    deleted_at = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "contacts"


class Lead(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    full_name = models.CharField(max_length=255, blank=True, null=True)
    normalized_phone = models.CharField(max_length=255, blank=True, null=True)
    normalized_email = models.CharField(max_length=255, blank=True, null=True)
    stage_id = models.CharField(max_length=255, blank=True, null=True)
    primary_source_id = models.CharField(max_length=255, blank=True, null=True)
    establishment_id = models.CharField(max_length=255, blank=True, null=True)
    owner_id = models.CharField(max_length=255, blank=True, null=True)
    referrer_contact_id = models.CharField(max_length=255, blank=True, null=True)
    referrer_employee_id = models.CharField(max_length=255, blank=True, null=True)
    junk_reason_id = models.CharField(max_length=255, blank=True, null=True)
    merged_into_id = models.CharField(max_length=255, blank=True, null=True)
    custom_fields = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    deleted_at = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "leads"


class Deal(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    lead_id = models.CharField(max_length=255, blank=True, null=True)
    establishment_id = models.CharField(max_length=255, blank=True, null=True)
    stage_id = models.CharField(max_length=255, blank=True, null=True)
    owner_id = models.CharField(max_length=255, blank=True, null=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    deleted_at = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)
    expected_value_minor = models.IntegerField(blank=True, null=True)
    won_value_minor = models.IntegerField(blank=True, null=True)
    currency_code = models.CharField(max_length=255, blank=True, null=True)
    mrr_minor = models.IntegerField(blank=True, null=True)
    contract_length_months = models.IntegerField(blank=True, null=True)
    seat_count = models.IntegerField(blank=True, null=True)
    probability_pct = models.IntegerField(blank=True, null=True)
    target_close_date = models.CharField(max_length=255, blank=True, null=True)
    actual_close_date = models.CharField(max_length=255, blank=True, null=True)
    contract_end_date = models.CharField(max_length=255, blank=True, null=True)
    discount_requested_pct = models.IntegerField(blank=True, null=True)
    discount_approved_pct = models.IntegerField(blank=True, null=True)
    discount_approved_by_id = models.CharField(max_length=255, blank=True, null=True)
    discount_status = models.CharField(max_length=255, blank=True, null=True)
    lost_reason_id = models.CharField(max_length=255, blank=True, null=True)
    custom_fields = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "deals"


class Activity(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    entity_type = models.CharField(max_length=255, blank=True, null=True)
    entity_id = models.CharField(max_length=255, blank=True, null=True)
    activity_type_id = models.CharField(max_length=255, blank=True, null=True)
    direction = models.CharField(max_length=255, blank=True, null=True)
    duration_seconds = models.IntegerField(blank=True, null=True)
    outcome = models.CharField(max_length=255, blank=True, null=True)
    body = models.TextField(blank=True, null=True)
    user_id = models.CharField(max_length=255, blank=True, null=True)
    occurred_at = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "activities"


class Task(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    entity_type = models.CharField(max_length=255, blank=True, null=True)
    entity_id = models.CharField(max_length=255, blank=True, null=True)
    task_type_id = models.CharField(max_length=255, blank=True, null=True)
    task_type_option_id = models.CharField(max_length=255, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    mode = models.CharField(max_length=255, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    meeting_url = models.CharField(max_length=255, blank=True, null=True)
    assignee_id = models.CharField(max_length=255, blank=True, null=True)
    due_at = models.CharField(max_length=255, blank=True, null=True)
    completed_at = models.CharField(max_length=255, blank=True, null=True)
    outcome = models.CharField(max_length=255, blank=True, null=True)
    google_event_id = models.CharField(max_length=255, blank=True, null=True)
    google_meet_url = models.CharField(max_length=255, blank=True, null=True)
    calendar_sync_status = models.CharField(max_length=255, blank=True, null=True)
    calendar_sync_error = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "tasks"


class Ticket(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    type = models.CharField(max_length=255, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    priority = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=255, blank=True, null=True)
    end_date = models.CharField(max_length=255, blank=True, null=True)
    reporter_tenant_id = models.CharField(max_length=255, blank=True, null=True)
    reporter_user_id = models.CharField(max_length=255, blank=True, null=True)
    owner_id = models.CharField(max_length=255, blank=True, null=True)
    closed_at = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "tickets"


class Establishment(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "establishments"


class PipelineStage(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "pipeline_stages"


class ActivityType(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "activity_types"
