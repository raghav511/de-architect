def latest_per_key(rows, key='event_id', ts='ts'):
    """Keep only the latest row (highest ts) for each key. Return rows sorted by key."""
    out = {}
    for r in rows:
        if r[key] not in out or r[ts] > out[r[key]][ts]:
            out[r[key]] = r
    return [out[k] for k in sorted(out)]
