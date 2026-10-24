def error_counts(lines):
    """Count ERROR lines per service. Lines look like '2026-10-20T08:01:02 ERROR svc=payments msg=timeout'."""
    out = {}
    for line in lines:
        parts = line.split()
        if len(parts) >= 3 and parts[1] == 'ERROR':
            kv = dict(p.split('=', 1) for p in parts[2:] if '=' in p)
            svc = kv.get('svc')
            out[svc] = out.get(svc, 0) + 1
    return out
