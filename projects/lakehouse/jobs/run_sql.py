"""Run a .sql file against Trino, statement by statement (used by Airflow and `make silver`)."""
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
from common import trino
path = sys.argv[1]
sql = re.sub(r'--[^\n]*', '', open(path).read())
cur = trino().cursor()
for stmt in [s.strip() for s in sql.split(';') if s.strip()]:
    cur.execute(stmt)
    rows = cur.fetchall()
    print(stmt.split('\n')[0][:80], '->', rows[:1])
