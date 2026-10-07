
/**
 * OFFLINE + local/memory session → stay in app (never login).
 * ONLINE → cookie refresh only (no LS Bearer). Fail → login.
 * LS tokens are never deleted except on logout / hard auth fail online.
 */
(function () {
  var LOGIN = '/login.html';
  var APP = '/';

  function isLoginPage() {
    return (
      /login\.html$/i.test(location.pathname || '') ||
      (document.body && document.body.dataset.page === 'login')
    );
  }

  function go(url) {
    if (url === LOGIN && /login\.html$/i.test(location.pathname || '')) return;
    if (
      url === APP &&
      (location.pathname === '/' ||
        location.pathname === '' ||
        /index\.html$/i.test(location.pathname || ''))
    )
      return;
    location.replace(url);
  }

  function hasShell() {
    if (typeof window.__hasOfflineShellSession === 'function') {
      return window.__hasOfflineShellSession();
    }
    try {
      return !!(
        localStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken') ||
        localStorage.getItem('chat_has_session') === '1'
      );
    } catch (e) {
      return false;
    }
  }

  window.__authGate = async function (opts) {
    opts = opts || {};
    var mode = opts.mode || (isLoginPage() ? 'login' : 'app');

    var offline = false;
    if (typeof window.__isOffline === 'function') {
      offline = await window.__isOffline({ probeApi: true });
    } else {
      offline = navigator.onLine === false;
    }

    // ----- OFFLINE -----
    if (offline) {
      if (hasShell()) {
        window.__sessionReady = true;
        window.__offlineSession = true;
        if (mode === 'login') {
          go(APP);
          return { ok: true, mode: 'offline-shell', redirected: true };
        }
        return { ok: true, mode: 'offline-shell', redirected: false };
      }
      if (mode === 'app') {
        go(LOGIN);
        return { ok: false, mode: 'offline-no-shell', redirected: true };
      }
      return { ok: false, mode: 'offline-no-shell', redirected: false };
    }

    // ----- ONLINE: never Authorization from LS -----
    window.__offlineSession = false;
    try {
      var res = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      var data = await res.json().catch(function () {
        return null;
      });
      var access = data && (data.accessToken || data.access_token);

      if (res.ok && access) {
        if (typeof window.__persistSession === 'function') {
          window.__persistSession(data);
        }
        window.__sessionReady = true;
        if (mode === 'login') {
          go(APP);
          return { ok: true, mode: 'online-ok', redirected: true };
        }
        return { ok: true, mode: 'online-ok', redirected: false, session: data };
      }

      // Online auth failed — go login but KEEP ls? User said only logout clears for offline use.
      // Hard fail online: clear so we don't loop with false shell trust on next offline after bad account
      if (typeof window.__clearAuthMemory === 'function') {
        window.__clearAuthMemory();
      }
      if (mode === 'app') {
        go(LOGIN);
        return { ok: false, mode: 'online-auth-failed', redirected: true };
      }
      return { ok: false, mode: 'online-auth-failed', redirected: false };
    } catch (e) {
      // Treat as offline if we have local shell
      if (hasShell()) {
        window.__lastOffline = true;
        window.__sessionReady = true;
        window.__offlineSession = true;
        if (typeof window.__persistSession === 'function') {
          window.__persistSession();
        }
        if (mode === 'login') {
          go(APP);
          return { ok: true, mode: 'degraded-offline', redirected: true };
        }
        return { ok: true, mode: 'degraded-offline', redirected: false };
      }
      if (mode === 'app') {
        go(LOGIN);
        return { ok: false, mode: 'no-session', redirected: true };
      }
      return { ok: false, mode: 'no-session', redirected: false };
    }
  };

  window.__markLoggedIn = function (tokens, user) {
    if (typeof window.__persistSession === 'function') {
      window.__persistSession(tokens, user);
    }
  };
  window.__markLoggedOut = window.__markLoggedOut || function () {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chat_has_session');
    localStorage.removeItem('chat_user_cache');
  } catch (e) {}
};
  window.__markLoggedOut = function () {
    if (typeof window.__logout === 'function') window.__logout();
  };

  var s = document.currentScript;
  if (s && s.getAttribute('data-auto') === 'app') {
    window.__authGatePromise = window.__authGate({ mode: 'app' });
  }
  if (s && s.getAttribute('data-auto') === 'login') {
    window.__authGatePromise = window.__authGate({ mode: 'login' });
  }
})();
