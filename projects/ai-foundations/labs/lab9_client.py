"""Starts the MCP server over stdio, lists its tools and calls them."""
import asyncio, os, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
async def main():
    params = StdioServerParameters(command=sys.executable, args=[os.path.join(os.path.dirname(__file__), 'lab9_mcp_server.py')])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            print('tools:', [t.name for t in (await s.list_tools()).tools])
            print((await s.call_tool('run_sql', {'query': 'select city, count(*) n, round(avg(fare),2) avg_fare from trips group by 1 order by 1'})).content[0].text[:300])
            print((await s.call_tool('run_sql', {'query': 'drop table trips'})).content[0].text)
asyncio.run(main())
