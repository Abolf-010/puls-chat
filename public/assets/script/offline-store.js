
/**
 * Offline data store — always available (IndexedDB + localStorage fallback)
 */
(function () {
  var DB = 'chat-data-v1';
  var VER = 1;
  var LS_PREFIX = 'chat_cache_';

  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
       
      return false;
    }
  }

  function lsGet(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('no indexedDB'));
        return;
      }
      var req = indexedDB.open(DB, VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ key: key, value: value, at: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('kv', 'readonly');
        var req = tx.objectStore('kv').get(key);
        req.onsuccess = function () {
          resolve(req.result ? req.result.value : null);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(key, value) {
    lsSet(key, value);
    return idbPut(key, value).catch(function () {});
  }

  function get(key) {
    return idbGet(key)
      .then(function (v) { return v != null ? v : lsGet(key); })
      .catch(function () { return lsGet(key); });
  }

  window.__offlineStore = {
    available: true,
    saveConversations: function (list) {
      var arr = Array.isArray(list) ? list : [];

      return put('conversations', arr);
    },
    loadConversations: function () {
      return get('conversations').then(function (v) {
        return Array.isArray(v) ? v : [];
      });
    },
    saveMessages: function (conversationId, messages, meta) {
      return put('messages:' + String(conversationId || ''), {
        messages: Array.isArray(messages) ? messages : [],
        meta: meta || {},
      });
    },
    loadMessages: function (conversationId) {
      return get('messages:' + String(conversationId || '')).then(function (v) {
        if (v && Array.isArray(v.messages)) return v;
        return { messages: [], meta: {} };
      });
    },
    saveCallLogs: function (list) {
      var arr = Array.isArray(list) ? list : [];

      return put('callLogs', arr);
    },
    loadCallLogs: function () {
      return get('callLogs').then(function (v) {
        return Array.isArray(v) ? v : [];
      });
    },
  };


})();
