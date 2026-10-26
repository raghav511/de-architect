"""Read raw order files and return clean rows."""
import csv
from datetime import date


def parse_amount(s):
    """'1,234.50' -> 1234.5. Files from the EU shop write amounts like '12,50'."""
    return float(s.replace(',', ''))


def read_orders(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def clean(rows, start, end):
    """Keep orders with start <= order_date <= end (both days included).
    Drop duplicate order_ids, keeping the row with the latest updated_at."""
    latest = {}
    for r in rows:
        d = date.fromisoformat(r['order_date'])
        if start <= d < end:
            k = r['order_id']
            if k not in latest or r['updated_at'] > latest[k]['updated_at']:
                latest[k] = r
    return [dict(r, amount=parse_amount(r['amount'])) for r in latest.values()]
