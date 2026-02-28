def format_amd(amount_int):
    """Format integer AMD amount as string with thousands separator."""
    if amount_int is None:
        return "—"
    return f"{int(amount_int):,}"


def format_budget(min_amd, max_amd):
    """Format budget range: '15,000–40,000 AMD' or '40,000 AMD' or '—'."""
    if min_amd is None and max_amd is None:
        return "—"
    if min_amd is not None and max_amd is not None:
        if min_amd == max_amd:
            return f"{format_amd(min_amd)} AMD"
        return f"{format_amd(min_amd)}–{format_amd(max_amd)} AMD"
    if max_amd is not None:
        return f"{format_amd(max_amd)} AMD"
    return f"{format_amd(min_amd)} AMD"
