def error_counts(lines):
    """Count ERROR lines per service. Lines look like '2026-10-20T08:01:02 ERROR svc=payments msg=timeout'."""
    out = {}
    for line in lines:
        parts = line.split(' ')
        if parts[1] == 'ERROR':  # BUG: crashes on blank lines and ignores extra spaces
            svc = parts[2].split('=')[1]
            out[svc] = out.get(svc, 0) + 1
    return out
