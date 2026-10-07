
(function () {
  function hasTokens() {
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
  window.__shouldSkipHardAuth = function () {
    return navigator.onLine === false && hasTokens();
  };
  window.__getCachedUser = function () {
    try {
      var raw = localStorage.getItem('chat_user_cache');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { userId: 'offline-user', username: 'offline' };
  };
})();
