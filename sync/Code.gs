/**
 * Data Architect progress sync (Google Apps Script). Stores your progress, the nightly coach's feedback,
 * and a small queue of grading jobs (answers waiting for the grader on your Mac) as JSON files in your Google Drive.
 * Setup: script.google.com → New project → paste this file → set KEY below to a long random string →
 * Deploy → New deployment → type "Web app", Execute as "Me", Who has access "Anyone" →
 * copy the /exec URL, add ?k=<your KEY> to the end, and paste that into Data Architect → Settings → Sync URL
 * on every device. The nightly coach and the grader use the same URL.
 * With KEY set, nobody can read or change your data without it, even though access is "Anyone".
 * After changing this file: Deploy → Manage deployments → Edit → Version: New version → Deploy (keeps the same URL).
 */
const KEY = ''; // set a long random string here; leave empty only for the old "Only myself" deployment
const FILE = 'keystone-progress.json'; // name from the Keystone days; kept so existing synced progress is found
const COACH_FILE = 'data-architect-coach.json';
const JOBS_FILE = 'data-architect-jobs.json';
const MAX_JOBS = 200;

function file_(name) {
  const it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFile(name, name === JOBS_FILE ? '[]' : '{}', 'application/json');
}
function read_(name) { return JSON.parse(file_(name).getBlob().getDataAsString() || (name === JOBS_FILE ? '[]' : '{}')); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function allowed_(e) { return !KEY || (e && e.parameter && e.parameter.k === KEY); }
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
  if (!allowed_(e)) return out_({ ok: false, error: 'wrong or missing key' });
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
  if (!allowed_(e)) return out_({ ok: false, error: 'wrong or missing key' });
  const body = JSON.parse(e.postData.contents || '{}');
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
