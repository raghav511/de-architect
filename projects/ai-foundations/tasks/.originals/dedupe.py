def latest_per_key(rows, key='event_id', ts='ts'):
    """Keep only the latest row (highest ts) for each key. Return rows sorted by key."""
    out = {}
    for r in rows:
        out[r[key]] = r          # BUG: keeps the last row seen, not the latest ts
    return [out[k] for k in sorted(out)]
