// Clickjacking guard: GitHub Pages cannot send X-Frame-Options / frame-ancestors headers,
// so refuse to run when the page is embedded in a frame on another site.
window.__FRAMED__ = false;
try {
  if (window.top !== window.self) {
    window.__FRAMED__ = true;
    document.documentElement.style.display = "none";
    try { window.top.location = window.self.location.href; } catch (e) {}
  }
} catch (e) {
  window.__FRAMED__ = true;
}

window.SUPABASE_URL = "https://kfgswynickhywzhneltu.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_ldEJk9Wd7TNeTEW5m3-N8g_NsrcXUXc";
if (!window.__FRAMED__ && window.supabase && window.supabase.createClient) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
