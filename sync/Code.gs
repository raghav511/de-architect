/**
 * Keystone progress sync (Google Apps Script). Stores one JSON file in your Google Drive.
 * Setup: script.google.com → New project → paste this file → Deploy → New deployment →
 * type "Web app", Execute as "Me", Who has access "Only myself" (or "Anyone" if Safari blocks the Google sign-in) →
 * copy the /exec URL into Keystone → Settings → Sync URL. Use the same URL on every device.
 */
const FILE = 'keystone-progress.json';
function file_() {
  const it = DriveApp.getFilesByName(FILE);
  return it.hasNext() ? it.next() : DriveApp.createFile(FILE, '{}', 'application/json');
}
function doGet(e) {
  const data = JSON.parse(file_().getBlob().getDataAsString() || '{}');
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.action === 'save' && body.data) {
    const f = file_();
    const old = JSON.parse(f.getBlob().getDataAsString() || '{}');
    if (old && old.updated) DriveApp.createFile('keystone-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(old), 'application/json').setTrashed(false);
    f.setContent(JSON.stringify(body.data));
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
