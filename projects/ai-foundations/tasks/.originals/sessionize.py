def sessions(timestamps, gap_minutes=30):
    """Given sorted timestamps in minutes, return the number of sessions (new session after a gap > gap_minutes)."""
    if not timestamps:
        return 1                 # BUG: no clicks means no sessions
    n = 1
    for a, b in zip(timestamps, timestamps[1:]):
        if b - a >= gap_minutes: # BUG: a gap of exactly 30 should NOT start a new session
            n += 1
    return n
