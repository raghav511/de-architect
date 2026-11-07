/* Data Architect · Sign in with Google. Signing in sends Google's one-time ID token to your own sync script
   (sync/Code.gs), which checks that it is your Google account and returns a session for this device. The session
   lasts 24 hours; after that the app signs out and asks you to sign in again. Signing out never touches your
   progress (it stays on this device and in your sync file), so after signing back in you continue where you were.
   Device-only state in localStorage 'da:auth' (never synced, never in backups). Loaded before app.js. */
'use strict';
const AUTH_KEY = 'da:auth', AUTH_HOURS = 24, GSI = 'https://accounts.google.com/gsi/client';
function authGet() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
function authSet(a) { try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { } }
const GOOGLE_CLIENT_ID = ''; /* the app's OAuth client ID (public, not a secret); until it is filled in, Profile › Sync takes one */
function authClientId() { return String(S.settings.googleClientId || GOOGLE_CLIENT_ID || '').trim(); }
function authOn() { return !!authClientId(); }
function authLive() { const a = authGet(); return !!(a && a.email && a.exp > Date.now()); }
/* signed in on this device before, and the 24 hours are over: the app asks again before anything else */
function authNeeded() { const a = authGet(); return authOn() && !!(a && a.email) && !authLive(); }
function authUntil() { const a = authGet(); return a && a.exp ? new Date(a.exp).toLocaleString('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''; }
function jwtBody(t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } }

let gsiP = null;
function authLoad() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
  return gsiP = gsiP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = GSI; s.async = true; s.onload = res; s.onerror = () => { gsiP = null; rej(new Error('Google sign-in could not load (offline?)')); }; document.head.appendChild(s); });
}
/* draws Google's own button into box; onDone runs after a successful sign-in */
async function authButton(box, onDone) {
  if (!authOn()) { box.appendChild(el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Add your Google client ID under Sync to turn on sign-in.' })); return; }
  try { await authLoad(); } catch (e) { box.appendChild(el('p', { class: 'muted', style: { margin: 0 }, text: e.message })); return; }
  google.accounts.id.initialize({ client_id: authClientId(), callback: r => authCredential(r.credential).then(ok => ok && onDone && onDone()), ux_mode: 'popup', auto_select: false, itp_support: true });
  google.accounts.id.renderButton(box, { theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'left' });
}
/* Google's token is checked by your sync script, which returns a 24-hour session; without a sync URL the session is
   only on this device (nothing to protect on a server yet) */
async function authCredential(tok) {
  const j = jwtBody(tok), url = S.settings.syncUrl, until = Date.now() + AUTH_HOURS * 36e5;
  if (!j.email) { toast('Google sign-in failed. Try again.'); return false; }
  let session = '', exp = until;
  if (url) {
    try {
      const r = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'login', id_token: tok }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }).then(x => x.json());
      if (!r || !r.ok) { toast(r && /not allowed|not the owner/.test(r.error || '') ? 'That Google account is not allowed on this app. Sign in with your own account.' : 'Sign-in was refused by your sync script: ' + ((r && r.error) || 'unknown error') + '. If you just updated it, deploy a new version.', null, 8000); return false; }
      session = r.session; exp = Math.min(until, r.exp || until);
    } catch (e) { toast('Could not reach your sync script to sign in. Check your connection and try again.', null, 6000); return false; }
  }
  authSet({ email: j.email, name: j.given_name || j.name || '', session, exp, at: Date.now() });
  if (typeof mEvent === 'function') mEvent('signin');
  toast('Signed in as ' + j.email + ' until ' + authUntil() + '.');
  if (url) doSync(); else route();
  return true;
}
function authSignOut(msg) { const a = authGet(); if (a) authSet({ email: a.email, name: a.name, exp: 0, at: a.at }); try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) { } toast(msg || 'Signed out. Your progress stays on this device.'); route(); }
function authForget() { authSet(null); toast('Sign-in turned off on this device.'); route(); }

/* the sign-in screen after 24 hours: nothing else is shown until you sign in (or, offline, continue without sync) */
let authOffline = false;
function authGate() {
  if (!authNeeded() || authOffline) return false;
  const a = authGet(), box = el('div', { class: 'authbtn' });
  const root = $('#root'); root.textContent = '';
  root.appendChild(el('main', { class: 'authgate', id: 'page' }, [el('section', { class: 'card pad stack authcard' }, [
    el('div', { class: 'row', style: { gap: '10px' } }, [logo(), el('b', { style: { fontSize: '20px' }, text: 'Data Architect' })]),
    el('h1', { text: 'Sign in again to continue' }),
    el('p', { style: { margin: 0 }, text: 'You were signed out after 24 hours' + (a && a.email ? ' (' + a.email + ')' : '') + '. Your progress is safe: it is still on this device and in your sync file, and you continue where you left off.' }),
    box,
    navigator.onLine === false ? el('button', { class: 'btn', onclick: () => { authOffline = true; route(); }, text: 'Continue offline without syncing' }) : null])]));
  authButton(box, () => route());
  return true;
}
/* the top-right control: Sign in when needed, otherwise the avatar says who is signed in */
function authTopBtn() { return authOn() && !authLive() ? el('a', { class: 'btn sm authtop', href: '#/profile', text: 'Sign in' }) : null; }
function authCard() {
  if (!authOn()) return null;
  const a = authGet(), live = authLive(), box = el('div', { class: 'authbtn' });
  const card = el('section', { class: 'card pad stack authprof' }, [el('b', { style: { fontSize: '16px' }, text: 'Account' }),
    live ? el('span', { text: 'Signed in as ' + a.email + ' · until ' + authUntil() + (a.session ? '' : ' · on this device only (add your sync URL to check it on your server)') }) : el('span', { text: 'Sign in with Google so your progress syncs safely. You stay signed in for 24 hours.' }),
    live ? el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn', onclick: () => authSignOut(), text: 'Sign out' }), el('button', { class: 'btn', onclick: authForget, text: 'Turn off sign-in on this device' })]) : box]);
  if (!live) authButton(box, () => route());
  return card;
}
/* left open past the 24 hours: the sign-in screen appears within a minute, or as soon as you come back to the app */
setInterval(() => { if (authNeeded() && !authOffline && !document.querySelector('.authgate')) route(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && authNeeded() && !authOffline && !document.querySelector('.authgate')) route(); });
