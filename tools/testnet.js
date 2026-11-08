/* Test browsers never wait on the internet. Requests to a host the test does not stub are aborted at once, so a DNS
   outage (fonts.googleapis.com, fonts.gstatic.com, accounts.google.com, …) cannot hang a page load and fail a release.
   Call blockExternal(context) right after newContext(), before any other route: Playwright tries the newest route
   first, so every stub a test adds later (https://sync.test, script.google.com, the Mac grader) still answers.
   cdn.jsdelivr.net stays reachable: Pyodide and marked are real files the coding tests run. */
const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const REAL = ['cdn.jsdelivr.net'];
async function blockExternal(ctx, allow) {
  const ok = new Set(REAL.concat(allow || []));
  await ctx.route(u => /^https?:$/.test(u.protocol) && !LOCAL.has(u.hostname) && !ok.has(u.hostname), r => r.abort('internetdisconnected'));
  return ctx;
}
module.exports = { blockExternal };
