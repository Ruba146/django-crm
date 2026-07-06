from functools import wraps

from django.contrib.auth.models import Group
from django.http import HttpResponseForbidden

SYSTEM_ADMIN_ROLE = "System Administrator"
LEGACY_ADMIN_ROLE = "Administrator"

SECTION_PERM_MAP = {
    "dashboard": "auth.dashboard_view",
    "contacts": "auth.contacts_view",
    "leads": "auth.leads_view",
    "deals": "auth.deals_view",
    "activities": "auth.activities_view",
    "tasks": "auth.tasks_view",
    "tickets": "auth.tickets_view",
    "reports": "auth.reports_view",
    "analytics": "auth.analytics_view",
    "lead_scoring": "auth.lead_scoring_view",
    "users": "auth.users_view",
}

RESOURCE_ACTION_PERMS = {
    "dashboard": {
        "view": "auth.dashboard_view",
        "create": "auth.dashboard_create",
        "edit": "auth.dashboard_edit",
        "delete": "auth.dashboard_delete",
    },
    "contacts": {
        "view": "auth.contacts_view",
        "create": "auth.contacts_create",
        "edit": "auth.contacts_edit",
        "delete": "auth.contacts_delete",
    },
    "leads": {
        "view": "auth.leads_view",
        "create": "auth.leads_create",
        "edit": "auth.leads_edit",
        "delete": "auth.leads_delete",
    },
    "deals": {
        "view": "auth.deals_view",
        "create": "auth.deals_create",
        "edit": "auth.deals_edit",
        "delete": "auth.deals_delete",
    },
    "activities": {
        "view": "auth.activities_view",
        "create": "auth.activities_create",
        "edit": "auth.activities_edit",
        "delete": "auth.activities_delete",
    },
    "tasks": {
        "view": "auth.tasks_view",
        "create": "auth.tasks_create",
        "edit": "auth.tasks_edit",
        "delete": "auth.tasks_delete",
    },
    "tickets": {
        "view": "auth.tickets_view",
        "create": "auth.tickets_create",
        "edit": "auth.tickets_edit",
        "delete": "auth.tickets_delete",
    },
    "reports": {
        "view": "auth.reports_view",
        "create": "auth.reports_create",
        "edit": "auth.reports_edit",
        "delete": "auth.reports_delete",
    },
    "analytics": {
        "view": "auth.analytics_view",
    },
    "lead_scoring": {
        "view": "auth.lead_scoring_view",
    },
    "users": {
        "view": "auth.users_view",
        "create": "auth.users_create",
        "edit": "auth.users_edit",
        "delete": "auth.users_delete",
        "manage_roles": "auth.users_manage_roles",
        "manage_permissions": "auth.users_manage_permissions",
    },
}


def _iter_all_permission_names():
    names = set(SECTION_PERM_MAP.values())
    for action_map in RESOURCE_ACTION_PERMS.values():
        names.update(action_map.values())
    return sorted(names)


ALL_PERMISSION_NAMES = _iter_all_permission_names()


ALL_SECTIONS = list(SECTION_PERM_MAP.keys())


def _is_admin_user(user):
    if not getattr(user, "is_authenticated", False):
        return False

    # System administrators always have full access and never go through per-permission checks.
    return user.is_superuser or user.groups.filter(name=SYSTEM_ADMIN_ROLE).exists()


def has_permission(user, perm_name):
    if not user.is_authenticated:
        return False
    if _is_admin_user(user):
        return True
    return user.has_perm(perm_name)


def can_do(user, resource, action):
    action_map = RESOURCE_ACTION_PERMS.get(resource, {})
    perm_name = action_map.get(action)
    if not perm_name:
        return False
    return has_permission(user, perm_name)


def user_can_access_section(user, section):
    if not user.is_authenticated:
        return False

    perm_name = SECTION_PERM_MAP.get(section)
    if not perm_name:
        return False
    return has_permission(user, perm_name)


def user_allowed_sections(user):
    if not user.is_authenticated:
        return []
    return [section for section in ALL_SECTIONS if user_can_access_section(user, section)]


def build_ui_permissions(user):
    can = {
        "is_system_admin": _is_admin_user(user),
    }
    for section, perm_name in SECTION_PERM_MAP.items():
        can[f"section_{section}"] = has_permission(user, perm_name)

    for resource, action_map in RESOURCE_ACTION_PERMS.items():
        for action, perm_name in action_map.items():
            can[f"{resource}_{action}"] = has_permission(user, perm_name)

    return can


def section_guard(section):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not user_can_access_section(request.user, section):
                return HttpResponseForbidden("403 Forbidden")
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def admin_users_guard(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return HttpResponseForbidden("403 Forbidden")
        if _is_admin_user(request.user):
            return view_func(request, *args, **kwargs)
        return HttpResponseForbidden("403 Forbidden")

    return wrapped
