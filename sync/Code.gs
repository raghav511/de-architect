/**
 * Data Architect progress sync (Google Apps Script). Stores your progress and the nightly coach's
 * feedback as two JSON files in your Google Drive.
 * Setup: script.google.com → New project → paste this file → set KEY below to a long random string →
 * Deploy → New deployment → type "Web app", Execute as "Me", Who has access "Anyone" →
 * copy the /exec URL, add ?k=<your KEY> to the end, and paste that into Data Architect → Settings → Sync URL
 * on every device. The nightly coach uses the same URL.
 * With KEY set, nobody can read or change your data without it, even though access is "Anyone".
 */
const KEY = ''; // set a long random string here; leave empty only for the old "Only myself" deployment
const FILE = 'keystone-progress.json'; // name from the Keystone days; kept so existing synced progress is found
const COACH_FILE = 'data-architect-coach.json';

function file_(name) {
  const it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFile(name, '{}', 'application/json');
}
function read_(name) { return JSON.parse(file_(name).getBlob().getDataAsString() || '{}'); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function allowed_(e) { return !KEY || (e && e.parameter && e.parameter.k === KEY); }

function doGet(e) {
  if (!allowed_(e)) return out_({ ok: false, error: 'wrong or missing key' });
  return out_({ ok: true, data: read_(FILE), coach: read_(COACH_FILE) });
}
function doPost(e) {
  if (!allowed_(e)) return out_({ ok: false, error: 'wrong or missing key' });
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.action === 'save' && body.data) {
    const f = file_(FILE);
    const old = JSON.parse(f.getBlob().getDataAsString() || '{}');
    if (old && old.updated) DriveApp.createFile('keystone-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(old), 'application/json').setTrashed(false);
    f.setContent(JSON.stringify(body.data));
  } else if (body.action === 'saveCoach' && body.coach) {
    file_(COACH_FILE).setContent(JSON.stringify(body.coach));
  }
  return out_({ ok: true });
}
