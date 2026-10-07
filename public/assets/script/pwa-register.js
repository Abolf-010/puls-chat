(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) {
        reg.update().catch(function () {});

        navigator.serviceWorker.addEventListener('message', function (event) {
          if (event.data && event.data.type === 'CHAT_OUTBOX_SYNC') {
            window.dispatchEvent(new CustomEvent('chat:outbox-sync'));
          }
        });
      })
      .catch(function (err) {
      });
  });
})();
