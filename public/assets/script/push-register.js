/**
 * Web Push client helpers
 * Exposes: window.registerPush, window.unregisterPush
 */
(function () {
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function authHeaders() {
    var token =
      (window.__authMemory && window.__authMemory.accessToken) ||
      localStorage.getItem('accessToken') ||
      '';
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  async function registerPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push not supported in this browser');
    }
    if (!window.isSecureContext) {
      throw new Error('Push requires HTTPS (or localhost)');
    }

    var meta = await fetch('/push/vapid-public-key', { credentials: 'include' }).then(function (r) {
      return r.json();
    });
    if (!meta || !meta.enabled || !meta.publicKey) {
      throw new Error('Push is disabled on server (set VAPID keys)');
    }

    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(meta.publicKey),
      });
    }

    var json = sub.toJSON();
    var res = await fetch('/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || err.error || 'Subscribe failed');
    }
    localStorage.setItem('chat_push_enabled', '1');
    return { ok: true, endpoint: json.endpoint };
  }

  async function unregisterPush() {
    if (!('serviceWorker' in navigator)) return { ok: true };
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      var endpoint = sub.endpoint;
      try {
        await fetch('/push/unsubscribe', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({ endpoint: endpoint }),
        });
      } catch (e) {}
      try {
        await sub.unsubscribe();
      } catch (e) {}
    }
    localStorage.setItem('chat_push_enabled', '0');
    return { ok: true };
  }

  window.registerPush = registerPush;
  window.unregisterPush = unregisterPush;
  window.__registerPush = registerPush;
})();
