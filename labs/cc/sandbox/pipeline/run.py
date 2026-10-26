"""Entry point: python3 -m pipeline.run START END   (dates as YYYY-MM-DD, both included)."""
import sys
from datetime import date

from . import config
from .ingest import read_orders, clean
from .load import connect, load, revenue_by_country


def main(argv):
    start, end = date.fromisoformat(argv[1]), date.fromisoformat(argv[2])
    if config.DEBUG:
        print('connecting to', config.WAREHOUSE_PATH, 'with token', config.WAREHOUSE_TOKEN)
    rows = clean(read_orders('data/orders.csv'), start, end)
    con = connect(config.WAREHOUSE_PATH)
    n = load(con, rows)
    print('loaded', n, 'orders')
    for country, total in revenue_by_country(con):
        print(f'{country:4} {total:>10.2f}')


if __name__ == '__main__':
    main(sys.argv if len(sys.argv) == 3 else ['', '2026-10-01', '2026-10-07'])
