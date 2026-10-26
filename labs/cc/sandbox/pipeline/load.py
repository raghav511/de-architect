"""Load clean orders into the SQLite warehouse, replacing the days being loaded."""
import sqlite3


def connect(path):
    con = sqlite3.connect(path)
    con.execute('CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, order_date TEXT, country TEXT, email TEXT, amount REAL)')
    return con


def load(con, rows):
    days = sorted({r['order_date'] for r in rows})
    for day in days:
        con.execute(f"DELETE FROM orders WHERE order_date = '{day}'")
    con.executemany('INSERT OR REPLACE INTO orders VALUES (?, ?, ?, ?, ?)',
                    [(r['order_id'], r['order_date'], r['country'], r['email'], r['amount']) for r in rows])
    con.commit()
    return len(rows)


def revenue_by_country(con):
    return con.execute('SELECT country, ROUND(SUM(amount), 2) FROM orders GROUP BY country ORDER BY 2 DESC').fetchall()
