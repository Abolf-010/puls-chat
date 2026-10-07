
/**
 * Local tokens: KEEP in localStorage always (after login / offline persist).
 * ONLINE: never send LS tokens to server — use cookie refresh → memory.
 * OFFLINE: use LS for app shell only (no API with those tokens).
 */
(function () {
  var mem = { accessToken: null, refreshToken: null, user: null };
  window.__authMemory = mem;

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      if (v == null || v === '') localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
    } catch (e) {}
  }

  /** Update memory + always write LS (keep local tokens) */
  window.__persistSession = function (tokens, user) {
    if (tokens) {
      if (tokens.accessToken || tokens.access_token)
        mem.accessToken = tokens.accessToken || tokens.access_token;
      if (tokens.refreshToken || tokens.refresh_token)
        mem.refreshToken = tokens.refreshToken || tokens.refresh_token;
    }
    if (user !== undefined && user !== null) mem.user = user;

    if (mem.accessToken) lsSet('accessToken', mem.accessToken);
    if (mem.refreshToken) lsSet('refreshToken', mem.refreshToken);
    if (mem.accessToken || mem.refreshToken) lsSet('chat_has_session', '1');
    if (mem.user) {
      try {
        localStorage.setItem('chat_user_cache', JSON.stringify(mem.user));
      } catch (e) {}
    }
  };

  window.__setAuthMemory = function (tokens, user) {
    window.__persistSession(tokens, user);
  };

  window.__persistTokensForOffline = function () {
    window.__persistSession();
  };

  window.__persistSessionForOfflineOnly = function () {
    window.__persistSession();
  };

  /** Full clear — only logout */
  window.__clearAuthMemory = function () {
    mem.accessToken = null;
    mem.refreshToken = null;
    mem.user = null;
    lsSet('accessToken', null);
    lsSet('refreshToken', null);
    lsSet('chat_has_session', null);
    try {
      localStorage.removeItem('chat_user_cache');
    } catch (e) {}
  };

  /** Shell session for offline gate */
  window.__hasOfflineShellSession = function () {
    return !!(
      mem.accessToken ||
      mem.refreshToken ||
      lsGet('accessToken') ||
      lsGet('refreshToken') ||
      lsGet('chat_has_session') === '1'
    );
  };

  window.__hasOnlineSession = function () {
    return !!(mem.accessToken || mem.refreshToken);
  };

  /**
   * Token for callers:
   * - ONLINE → memory only (never LS for server)
   * - OFFLINE → memory or LS (UI/shell only)
   */
  window.__getAccessToken = function () {
    if (window.__lastOffline === true) {
      return mem.accessToken || lsGet('accessToken');
    }
    return mem.accessToken || null;
  };

  window.__logout = function () {
    window.__clearAuthMemory();
    location.replace('/login.html');
  };

  window.__probeServer = async function () {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { reachable: false, reason: 'navigator-offline' };
    }
    try {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer =
        ctrl &&
        setTimeout(function () {
          try {
            ctrl.abort();
          } catch (e) {}
        }, 3000);
      // Cookie only — do NOT attach LS Bearer
      var res = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      return { reachable: true, status: res.status, res: res };
    } catch (e) {
      return {
        reachable: false,
        reason: e && e.name === 'AbortError' ? 'timeout' : 'fetch-failed',
      };
    }
  };

  window.__isOffline = async function (opts) {
    opts = opts || {};
    var probe =
      opts.probeApi === false
        ? { reachable: navigator.onLine !== false, reason: 'skip' }
        : await window.__probeServer();
    var offline = !probe.reachable;
    window.__lastOffline = offline;
    window.__lastOfflineReasons = { offline: offline, probe: probe };
     .log('[offline-detect]', offline ? 'OFFLINE' : 'ONLINE', probe);
    // Keep LS always — only ensure persist when offline so shell is complete
    if (offline) {
      window.__persistSession();
    }
    return offline;
  };

  window.addEventListener('offline', function () {
    window.__lastOffline = true;
    window.__persistSession();
  });
  window.addEventListener('online', function () {
    window.__lastOffline = false;
    // Do NOT clear LS — just mark online; next API uses memory/cookie
     .log('[offline-detect] online — LS tokens kept but not used for API');
  });
})();
