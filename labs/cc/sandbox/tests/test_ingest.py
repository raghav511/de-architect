import unittest
from datetime import date

from pipeline.ingest import parse_amount, clean


def row(i, d, amount='10.00', updated='2026-10-01T00:00:00'):
    return {'order_id': str(i), 'order_date': d, 'country': 'IN', 'email': 'a@example.com', 'amount': amount, 'updated_at': updated}


class TestIngest(unittest.TestCase):
    def test_us_amount(self):
        self.assertEqual(parse_amount('1,234.50'), 1234.5)

    def test_eu_amount(self):
        self.assertEqual(parse_amount('12,50'), 12.5)

    def test_end_day_included(self):
        out = clean([row(1, '2026-10-07')], date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual(len(out), 1)

    def test_dedupe_keeps_latest(self):
        rows = [row(1, '2026-10-02', '5.00', '2026-10-02T09:00:00'), row(1, '2026-10-02', '7.00', '2026-10-02T10:00:00')]
        out = clean(rows, date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual([r['amount'] for r in out], [7.0])


if __name__ == '__main__':
    unittest.main()
