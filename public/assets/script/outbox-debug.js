/**
 * Outbox badge disabled for demo UI.
 * Logic (IndexedDB queue) still works without this badge.
 */
(function () {
  function removeBadge() {
    var el = document.getElementById('outboxBadge');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  window.__outboxCount = async function () { return 0; };
  window.__outboxDebugRefresh = removeBadge;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeBadge);
  } else {
    removeBadge();
  }
})();
