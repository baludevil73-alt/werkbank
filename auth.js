(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('workbench'), overlay = $('loginOverlay'), status = $('loginError');
  let sb, generation = 0, signedIn = false;
  function lock(text) {
    app.hidden = true; app.inert = true; overlay.hidden = false;
    $('loggedInUser').textContent = ''; status.textContent = text;
  }
  function controls() {
    $('loginBtn').disabled = !sb;
    $('retryBtn').hidden = !signedIn;
    $('authLogoutBtn').hidden = !signedIn;
  }
  async function check() {
    const current = ++generation;
    lock('Anmeldung und Discord-Rolle werden geprüft …');
    try {
      const {data, error} = await sb.auth.getSession();
      if (current !== generation) return;
      if (error) throw error;
      signedIn = Boolean(data.session); controls();
      if (!data.session) { lock('Bitte mit Discord anmelden.'); return; }
      const response = await fetch(`${window.WERKBANK_CONFIG.supabaseUrl}/functions/v1/check-discord-role`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${data.session.access_token}`, apikey: window.WERKBANK_CONFIG.supabaseKey, 'Content-Type': 'application/json'},
        body: '{}', signal: AbortSignal.timeout(15000), cache: 'no-store',
      });
      const result = await response.json();
      if (current !== generation) return;
      if (!response.ok) throw new Error('Prüfung fehlgeschlagen');
      if (result.allowed !== true) { lock('Kein Zugriff: Servermitgliedschaft oder erforderliche Discord-Rolle fehlt.'); return; }
      app.hidden = false; app.inert = false; overlay.hidden = true;
      $('loggedInUser').textContent = 'Mit Discord angemeldet · Rolle geprüft';
    } catch {
      if (current === generation) lock('Rollenprüfung nicht möglich. Bitte erneut prüfen. Bei wiederholtem Fehler Konfiguration und Edge Function kontrollieren.');
    }
  }
  async function logout() {
    ++generation; lock('Abmeldung …');
    try {
      const {error} = await sb.auth.signOut({scope: 'local'});
      if (error) throw error;
      signedIn = false; controls(); lock('Abgemeldet. Bitte mit Discord anmelden.');
    } catch { lock('Abmeldung fehlgeschlagen. Bitte erneut versuchen.'); }
  }
  try {
    const config = window.WERKBANK_CONFIG;
    if (!config || config.supabaseUrl !== 'https://jjhkufmfbhxugkpvggqc.supabase.co' || !config.supabaseKey || /HIER_|sb_secret_/.test(config.supabaseKey)) throw new Error('In config.js den öffentlichen Key des Projekts jjhkufmfbhxugkpvggqc eintragen.');
    if (config.supabaseKey.startsWith('eyJ')) {
      const payload = JSON.parse(atob(config.supabaseKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.role !== 'anon' || payload.ref !== 'jjhkufmfbhxugkpvggqc') throw new Error('Nur den anon Key dieses Projekts verwenden.');
    } else if (!config.supabaseKey.startsWith('sb_publishable_')) throw new Error('Publishable oder anon Key erforderlich.');
    const redirect = new URL(config.redirectUrl);
    if (redirect.protocol !== 'https:' || /DEIN-/.test(config.redirectUrl) || redirect.origin !== location.origin || redirect.search || redirect.hash) throw new Error('In config.js die exakte HTTPS-Adresse dieser GitHub-Pages-Seite eintragen.');
    if (!window.supabase) throw new Error('Supabase-Bibliothek konnte nicht geladen werden.');
    sb = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.sessionStorage},
    });
    $('loginBtn').onclick = async () => {
      $('loginBtn').disabled = true; status.textContent = 'Weiterleitung zu Discord …';
      try {
        const {error} = await sb.auth.signInWithOAuth({provider: 'discord', options: {redirectTo: config.redirectUrl}});
        if (error) throw error;
      } catch { lock('Discord-Anmeldung fehlgeschlagen. Provider und Redirect-Adressen prüfen.'); controls(); }
    };
    $('retryBtn').onclick = check;
    $('logoutBtn').onclick = logout; $('authLogoutBtn').onclick = logout;
    sb.auth.onAuthStateChange(() => { ++generation; lock('Anmeldung wird geprüft …'); setTimeout(check, 0); });
    controls();
    check();
    setInterval(() => { if (signedIn && document.visibilityState === 'visible') check(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { ++generation; lock('Anmeldung wird geprüft …'); } else check(); });
  } catch (error) { sb = undefined; controls(); lock(error.message); }
})();
