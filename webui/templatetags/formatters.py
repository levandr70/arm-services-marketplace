from django import template
from django.utils.safestring import mark_safe

from webui.utils import format_amd as _format_amd, format_budget as _format_budget

register = template.Library()


@register.filter
def amd(amount_int):
    """Template filter: {{ value|amd }} -> '15,000' or '—'."""
    return _format_amd(amount_int)


@register.filter
def budget(budget_range):
    """
    Template filter: {{ job|budget }} expects job with budget_min_amd, budget_max_amd
    or pass (min_amd, max_amd) from a tuple tag.
    """
    if budget_range is None:
        return "—"
    if hasattr(budget_range, "budget_min_amd"):
        return _format_budget(budget_range.budget_min_amd, budget_range.budget_max_amd)
    if isinstance(budget_range, (list, tuple)) and len(budget_range) >= 2:
        return _format_budget(budget_range[0], budget_range[1])
    return "—"
