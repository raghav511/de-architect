"""Lab 9: an MCP server that exposes your data read-only.  Run the client: python labs/lab9_client.py
Uses DuckDB on a small sample so it works anywhere; point it at Trino (lakehouse) as the stretch goal."""
import os, re, sys, logging
import duckdb
from mcp.server.fastmcp import FastMCP
logging.basicConfig(filename=os.path.join(os.path.dirname(__file__), '..', 'traces', 'mcp_queries.log'), level=logging.INFO)
con = duckdb.connect()
con.execute("create table trips as select i as trip_id, 'city_' || (i % 5) as city, round(50 + (i * 37) % 400, 2) as fare from range(1, 1001) t(i)")
mcp = FastMCP('lakehouse-readonly')
READ_ONLY = re.compile(r'^\s*(select|with|show|describe)\b', re.I)

@mcp.tool()
def list_tables() -> list[str]:
    """List the tables you can query."""
    return [r[0] for r in con.execute('show tables').fetchall()]

@mcp.tool()
def describe_table(name: str) -> list[dict]:
    """Columns and types of one table."""
    return [{'column': r[0], 'type': r[1]} for r in con.execute(f'describe "{name}"').fetchall()]

@mcp.tool()
def run_sql(query: str) -> dict:
    """Run a read-only SQL query (SELECT/WITH/SHOW/DESCRIBE). Returns at most 200 rows."""
    # TODO: also reject multiple statements (a ';' followed by more SQL)
    if not READ_ONLY.match(query):
        return {'error': 'only read-only queries are allowed'}
    logging.info('run_sql %s', query.replace('\n', ' ')[:500])
    cur = con.execute(query)
    cols = [d[0] for d in cur.description]
    return {'columns': cols, 'rows': [list(map(str, r)) for r in cur.fetchmany(200)]}

if __name__ == '__main__':
    mcp.run()
