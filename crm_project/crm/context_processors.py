from .access import build_ui_permissions, user_allowed_sections


def access_context(request):
    allowed_sections = user_allowed_sections(request.user)
    can = build_ui_permissions(request.user)
    return {
        "allowed_sections": allowed_sections,
        "can": can,
    }
