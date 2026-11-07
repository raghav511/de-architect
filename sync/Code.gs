/**
 * Data Architect progress sync (Google Apps Script). Stores your progress, the nightly coach's feedback,
 * and a small queue of grading jobs (answers waiting for the grader on your Mac) as JSON files in your Google Drive.
 * Setup: script.google.com → New project → paste this file → set KEY below to a long random string →
 * Deploy → New deployment → type "Web app", Execute as "Me", Who has access "Anyone" →
 * copy the /exec URL, add ?k=<your KEY> to the end, and paste that into Data Architect → Settings → Sync URL
 * on every device. The nightly coach and the grader use the same URL.
 * With KEY set, nobody can read or change your data without it, even though access is "Anyone".
 * After changing this file: Deploy → Manage deployments → Edit → Version: New version → Deploy (keeps the same URL).
 * Sign in with Google (optional): set CLIENT_ID to the app's OAuth client ID and OWNERS to your Gmail address(es).
 * The app then signs in with Google, this script checks the token is for this app and one of OWNERS, and returns a
 * session that works for 24 hours. The ?k= key keeps working for the Mac grader and the nightly coach.
 * Keep your real CLIENT_ID and OWNERS only in your deployed copy (script.google.com), not in the public repository.
 */
const KEY = ''; // set a long random string here: with no KEY this script refuses every request that has no valid sign-in session
const FILE = 'keystone-progress.json'; // name from the Keystone days; kept so existing synced progress is found
const COACH_FILE = 'data-architect-coach.json';
const JOBS_FILE = 'data-architect-jobs.json';
const MAX_JOBS = 200;
const CLIENT_ID = ''; // the app's Google OAuth client ID, e.g. 1234-abc.apps.googleusercontent.com
const OWNERS = [];    // the Google accounts allowed to sign in: your Gmail address in quotes
const SESSION_HOURS = 24;

function file_(name) {
  const it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFile(name, name === JOBS_FILE ? '[]' : '{}', 'application/json');
}
function read_(name) { return JSON.parse(file_(name).getBlob().getDataAsString() || (name === JOBS_FILE ? '[]' : '{}')); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* no KEY means no open door: only a matching ?k= key or a valid session gets in (security review 12) */
function allowed_(e) { return !!KEY && !!(e && e.parameter && e.parameter.k === KEY); }
const NO_KEY = 'the sync script has no KEY set: set one at the top of Code.gs and deploy a new version';
function refused_(session) { return out_({ ok: false, error: !KEY && !session ? NO_KEY : session ? 'session expired: sign in again' : 'wrong or missing key' }); }
/* sessions from Sign in with Google: random ids with an expiry, kept in the script's private properties */
function sessions_() { const P = PropertiesService.getScriptProperties(); const s = JSON.parse(P.getProperty('sessions') || '{}'), now = Date.now(); Object.keys(s).forEach(k => { if (s[k] < now) delete s[k]; }); return s; }
function sessionOk_(id) { return !!id && (sessions_()[id] || 0) > Date.now(); }
/* run once from the Apps Script editor (Run › authorize) only to grant the one-time UrlFetch permission sign-in needs */
function authorize() { UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=authorize', { muteHttpExceptions: true }); }
function login_(tok) {
  if (!CLIENT_ID || !OWNERS.length) return { ok: false, error: 'sign-in is not set up in the sync script (CLIENT_ID and OWNERS)' };
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok || ''), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'Google did not accept that sign-in' };
  const j = JSON.parse(r.getContentText());
  if (j.aud !== CLIENT_ID) return { ok: false, error: 'that sign-in is for another app' };
  if (String(j.email_verified) !== 'true' || OWNERS.map(x => x.toLowerCase()).indexOf(String(j.email).toLowerCase()) < 0) return { ok: false, error: 'not allowed: not the owner' };
  if (+j.exp * 1000 < Date.now()) return { ok: false, error: 'that sign-in has expired' };
  /* the client ID may be shared with another app of yours: only sign-ins made by Data Architect (nonce da-...) open this data */
  if (String(j.nonce || '').indexOf('da-') !== 0) return { ok: false, error: 'that sign-in was made by another app' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { const s = sessions_(), id = Utilities.getUuid() + Utilities.getUuid(), exp = Date.now() + SESSION_HOURS * 36e5; s[id] = exp; PropertiesService.getScriptProperties().setProperty('sessions', JSON.stringify(s)); return { ok: true, session: id, exp: exp }; }
  finally { lock.releaseLock(); }
}
/* the job queue is read-modify-write, so changes are serialised with a lock */
function withJobs_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = file_(JOBS_FILE);
    const jobs = JSON.parse(f.getBlob().getDataAsString() || '[]');
    const res = fn(jobs);
    const cutoff = Date.now() - 3 * 864e5; /* forget finished jobs after 3 days */
    const kept = jobs.filter(j => j.status !== 'done' || (j.doneAt || 0) > cutoff).slice(-MAX_JOBS);
    f.setContent(JSON.stringify(kept));
    return res;
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  if (!allowed_(e)) return refused_('');
  const a = (e.parameter || {}).action || 'load';
  if (a === 'jobs') return out_({ ok: true, jobs: read_(JOBS_FILE).filter(j => j.status === 'pending') });
  if (a === 'results') {
    const ids = String(e.parameter.ids || '').split(',').filter(Boolean);
    const map = {};
    read_(JOBS_FILE).forEach(j => { if (ids.indexOf(j.id) >= 0) map[j.id] = { status: j.status, result: j.result || null, at: j.at, doneAt: j.doneAt || null }; });
    return out_({ ok: true, results: map });
  }
  return out_({ ok: true, data: read_(FILE), coach: read_(COACH_FILE) });
}

function doPost(e) {
  const body = JSON.parse((e.postData && e.postData.contents) || '{}');
  if (body.action === 'login') return out_(login_(body.id_token));
  if (!allowed_(e) && !sessionOk_(body.session)) return refused_(body.session);
  if (body.action === 'load') return out_({ ok: true, data: read_(FILE), coach: read_(COACH_FILE) });
  if (body.action === 'save' && body.data) {
    const f = file_(FILE);
    const old = JSON.parse(f.getBlob().getDataAsString() || '{}');
    /* one backup per day at most (it used to create a new file on every sync) */
    const name = 'keystone-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    if (old && old.updated && !DriveApp.getFilesByName(name).hasNext()) DriveApp.createFile(name, JSON.stringify(old), 'application/json');
    f.setContent(JSON.stringify(body.data));
  } else if (body.action === 'saveCoach' && body.coach) {
    file_(COACH_FILE).setContent(JSON.stringify(body.coach));
  } else if (body.action === 'ask' && body.job && body.job.id) {
    withJobs_(jobs => {
      if (!jobs.some(j => j.id === body.job.id)) jobs.push({ id: String(body.job.id), kind: String(body.job.kind || ''), payload: body.job.payload || {}, status: 'pending', at: Date.now() });
    });
  } else if (body.action === 'answer' && body.id) {
    withJobs_(jobs => { jobs.forEach(j => { if (j.id === body.id) { j.status = 'done'; j.result = body.result || null; j.doneAt = Date.now(); } }); });
  }
  return out_({ ok: true });
}
