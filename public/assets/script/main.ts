declare const io: any;

let aToken: string = '';
(window as any).__privacy = {
  lastSeen: localStorage.getItem('chat_privacy_last_seen') !== '0',
  readReceipts: localStorage.getItem('chat_privacy_read_receipts') !== '0',
};

/** Access token for API/socket only — never localStorage offline copies */

function hardenInputsAgainstAutofill(root?: ParentNode | null) {
  const scope: ParentNode = root || document;
  scope.querySelectorAll(
    'input:not([type="checkbox"]):not([type="file"]):not([type="hidden"])',
  ).forEach((el) => {
    const input = el as HTMLInputElement;
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-form-type', 'other');
    if (input.type === 'password') {
      input.setAttribute('autocomplete', 'new-password');
      if (!input.name || /pass|user|email/i.test(input.name)) {
        input.name = 'not-password-' + Math.random().toString(36).slice(2, 8);
      }
    } else {
      input.setAttribute('autocomplete', 'one-time-code');
      if (!input.name || /user|email|pass/i.test(input.name)) {
        input.name = 'no-autofill-' + Math.random().toString(36).slice(2, 8);
      }
    }
    if (!input.dataset.autofillHardened) {
      input.dataset.autofillHardened = '1';
      input.readOnly = true;
      const unlock = () => {
        input.readOnly = false;
      };
      input.addEventListener('focus', unlock, { once: true });
      input.addEventListener('touchstart', unlock, { once: true });
    }
  });
}
(window as any).hardenInputsAgainstAutofill = hardenInputsAgainstAutofill;

function getOnlineAccessToken(): string {
  const mem = (window as any).__authMemory?.accessToken;
  const t = String(aToken || mem || '').trim();
  return t;
}
(window as any).__getOnlineAccessToken = getOnlineAccessToken;


const DEFAULT_AVATAR_URL =
  '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg';

function resolveAvatarUrl(path: any): string {
  let p = String(path || '').trim();
  if (!p || p === 'undefined' || p === 'null') return DEFAULT_AVATAR_URL;
  if (
    p.startsWith('http://') ||
    p.startsWith('https://') ||
    p.startsWith('blob:') ||
    p.startsWith('data:')
  ) {
    return p;
  }
  // default wallpaper path in project
  if (p.includes('wallpaperflare')) {
    return p.startsWith('/') ? p : '/' + p.replace(/^\/+/, '');
  }
  if (p.startsWith('uploads/')) p = '/' + p;
  if (p.startsWith('/uploads') || p.startsWith('/assets')) return p;
  if (p.startsWith('/')) return p;
  return '/' + p.replace(/^\/+/, '');
}

/** S8 — in-app modal (replaces window.alert / confirm) */
type AppDialogOpts = {
  title?: any;
  message: any;
  okText?: any;
  cancelText?: any;
  danger?: any;
};

function ensureAppDialogStyles() {
  if (document.getElementById('appDialogStyles')) return;
  const s = document.createElement('style');
  s.id = 'appDialogStyles';
  s.textContent = `
  .app-dialog-backdrop{position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  .app-dialog{width:min(92vw,360px);background:#161b22;border-radius:16px;padding:18px 16px 14px;box-shadow:0 16px 48px rgba(0,0,0,.45);color:#f5f7fa}
  .app-dialog-title{margin:0 0 8px;font-size:1.05rem;font-weight:700}
  .app-dialog-msg{margin:0 0 16px;font-size:.92rem;line-height:1.45;color:rgba(245,247,250,.8);white-space:pre-wrap}
  .app-dialog-actions{display:flex;gap:8px;justify-content:flex-end}
  .app-dialog-btn{border:none;border-radius:12px;padding:10px 14px;font-weight:600;cursor:pointer;font-size:.9rem}
  .app-dialog-btn.ok{background:#6132DB;color:#fff}
  .app-dialog-btn.ok.danger{background:#7f1d1d}
  .app-dialog-btn.cancel{background:#1f2633;color:#f5f7fa}
  .app-dialog-input-wrap{margin:0 0 14px}
  .app-dialog-input{
    width:100%;box-sizing:border-box;min-height:88px;resize:vertical;
    border:1px solid rgba(255,255,255,.12);border-radius:12px;
    background:#0d1117;color:#f5f7fa;padding:10px 12px;font-size:.92rem;
    font-family:inherit;line-height:1.4;outline:none
  }
  .app-dialog-input:focus{border-color:#6132DB}
  `;
  document.head.appendChild(s);
}

function appDialogShow(opts: AppDialogOpts & { showCancel?: boolean }): Promise<boolean> {
  ensureAppDialogStyles();
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'app-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="app-dialog" role="dialog" aria-modal="true">
        ${opts.title ? `<h3 class="app-dialog-title"></h3>` : ''}
        <p class="app-dialog-msg"></p>
        <div class="app-dialog-actions">
          ${opts.showCancel ? `<button type="button" class="app-dialog-btn cancel" data-act="cancel"></button>` : ''}
          <button type="button" class="app-dialog-btn ok ${opts.danger ? 'danger' : ''}" data-act="ok"></button>
        </div>
      </div>
    `;
    const titleEl = backdrop.querySelector('.app-dialog-title');
    if (titleEl) titleEl.textContent = opts.title || '';
    const msgEl = backdrop.querySelector('.app-dialog-msg');
    if (msgEl) msgEl.textContent = opts.message || '';
    const okBtn = backdrop.querySelector('[data-act="ok"]') as HTMLButtonElement;
    const cancelBtn = backdrop.querySelector('[data-act="cancel"]') as HTMLButtonElement | null;
    if (okBtn) okBtn.textContent = opts.okText || 'OK';
    if (cancelBtn) cancelBtn.textContent = opts.cancelText || 'Cancel';

    const close = (val: boolean) => {
      backdrop.remove();
      resolve(val);
    };
    okBtn?.addEventListener('click', () => close(true));
    cancelBtn?.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
    document.body.appendChild(backdrop);
    okBtn?.focus();
  });
}

const appDialog :any= {
  alert(message: string, title?: string) {
    return appDialogShow({ title, message, showCancel: false });
  },
  confirm(message: string, title?: string, danger?: boolean) {
    return appDialogShow({
      title,
      message,
      showCancel: true,
      danger,
      okText: 'Confirm',
      cancelText: 'Cancel',
    });
  },
  /** Text input dialog — returns string or null if cancelled */
  prompt(
    message: string,
    defaultValue?: string,
    title?: string,
  ): Promise<string | null> {
    ensureAppDialogStyles();
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'app-dialog-backdrop';
      backdrop.innerHTML = `
        <div class="app-dialog" role="dialog" aria-modal="true">
          <h3 class="app-dialog-title"></h3>
          <p class="app-dialog-msg"></p>
          <div class="app-dialog-input-wrap">
            <textarea class="app-dialog-input" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
          </div>
          <div class="app-dialog-actions">
            <button type="button" class="app-dialog-btn cancel" data-act="cancel">Cancel</button>
            <button type="button" class="app-dialog-btn ok" data-act="ok">Save</button>
          </div>
        </div>
      `;
      const titleEl = backdrop.querySelector('.app-dialog-title') as HTMLElement;
      titleEl.textContent = title || 'Edit';
      const msgEl = backdrop.querySelector('.app-dialog-msg') as HTMLElement;
      msgEl.textContent = message || '';
      if (!message) msgEl.style.display = 'none';
      const input = backdrop.querySelector('.app-dialog-input') as HTMLTextAreaElement;
      input.value = defaultValue || '';
      const close = (value: string | null) => {
        backdrop.remove();
        resolve(value);
      };
      backdrop.querySelector('[data-act="ok"]')?.addEventListener('click', () => {
        close(input.value);
      });
      backdrop.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        close(null);
      });
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(null);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          close(input.value);
        }
      });
      document.body.appendChild(backdrop);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 0);
    });
  },
};
(window as any).appDialog = appDialog;


let socket: any = null;


 
async function connectSocket(accessToken: string) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }
  if (typeof io === 'undefined') {
    return null;
  }
  if (socket?.connected) {
    return socket;
  }
  const url = typeof location !== 'undefined' ? location.origin : 'https://192.168.1.100/';
  socket = io(url, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socket!.on('connect', () => {
    if (typeof flushOutbox === 'function') {
      flushOutbox().catch(() => undefined);
    }
    // Re-attach call listeners after every connect
    try {
      if (typeof (window as any).__setupCallListeners === 'function') {
        (window as any).__setupCallListeners();
      }
    } catch (e) {
    }
  });
  
  socket.off('call:incoming');
  socket.on('call:incoming', (data: any) => {
    const callId = String(data?.callId ?? data?.callID ?? '');
    const callerId = String(data?.callerId ?? data?.from ?? '');
    if (!callId) {
      return;
    }
    document.getElementById('incomingCallBanner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'incomingCallBanner';
    banner.setAttribute('data-call-modal', '1');
    banner.className = 'nx-call-overlay';
    banner.innerHTML =
      '<div class="nx-call-card nx-call-incoming">' +
      '<div class="nx-call-avatar"><i class="fa-solid fa-phone"></i></div>' +
      '<div class="nx-call-title">Incoming call</div>' +
      '<div class="nx-call-sub">' + String(callerId).replace(/</g, '') + '</div>' +
      '<div class="nx-call-actions">' +
      '<button type="button" id="incomingRejectBtn" class="nx-call-btn reject" title="Reject"><i class="fa-solid fa-phone-slash"></i></button>' +
      '<button type="button" id="incomingAcceptBtn" class="nx-call-btn accept" title="Accept"><i class="fa-solid fa-phone"></i></button>' +
      '</div></div>';
    document.body.appendChild(banner);
    banner.querySelector('#incomingAcceptBtn')?.addEventListener('click', () => {
      banner.remove();
      socket.emit('call:accept', { callId });
      try {
        if ((window as any).__callClientAccept) (window as any).__callClientAccept(callId);
      } catch {}
    });
    banner.querySelector('#incomingRejectBtn')?.addEventListener('click', () => {
      banner.remove();
      socket.emit('call:reject', { callId });
    });
  });

  socket.off('call:failed');
  socket.on('call:failed', (d: any) => {
    const reason = typeof d === 'string' ? d : d?.reason || JSON.stringify(d);
    void appDialog.alert('Call failed: ' + reason);
  });
  
  socket.off('call:accepted');
  socket.on('call:accepted', (d: any) => {
    // forward to call client if present
    try {
      if (typeof (window as any).__onCallAccepted === 'function') {
        (window as any).__onCallAccepted(d);
      }
    } catch (e) {
    }
  });

  socket.off('call:ringing');
  socket.on('call:ringing', (d: any) => {
  });


  socket.off('conversation:card');
  socket.on('conversation:card', (data: any) => {
    try {
      const msg = {
        conversationId: data.conversationId,
        messageId: data.messageId,
        senderId: data.senderId,
        content: data.content ?? data.preview,
        type: data.type || 'text',
        createdAt: data.createdAt,
      };
      const fn = (window as any).__updateConvCard;
      const uid =
        (window as any).__currentUserId ||
        (window as any).__authMemory?.user?.userId ||
        '';
      const openId = (window as any).__currentConversationId || null;
      if (typeof fn === 'function') fn(msg, uid, openId);
    } catch (e) {
    }
  });

  socket.off('message:new');
  socket.on('message:new', (msg: any) => {
    if (!msg) return;
    try {
      const fn = (window as any).__updateConvCard;
      const uid =
        (window as any).__currentUserId ||
        (window as any).__authMemory?.user?.userId ||
        '';
      const openId = (window as any).__currentConversationId || null;
      if (typeof fn === 'function') fn(msg, uid, openId);
    } catch (e) {
    }
  });


  return socket;
}

async function refresh() {

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err: any = new Error('offline — skip refresh');
    err.code = 'OFFLINE';
    throw err;
  }
  const response = await fetch('/auth/refresh', {
    method: "POST",
  });
  if (!response.ok) {
    const err: any = new Error('refresh failed ' + response.status);
    err.status = response.status;
    throw err;
  }
  const res = await response.json();
  aToken = res.accessToken;
  if (typeof (window as any).__persistSession === 'function') {
    (window as any).__persistSession({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    });
  }

  try {
    if (typeof (window as any).__setAuthMemory === 'function') {
      (window as any).__setAuthMemory({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
    }
  } catch { /* */ }
  const resPon = await fetch('users/profile', {
    headers: {
      Authorization: `Bearer ${res.accessToken}`
    }
  });
  const user = await resPon.json();
  try {
    if (user?.user) {
      localStorage.setItem('chat_user_cache', JSON.stringify(user.user));
    }
  } catch {
    /* */
  }
  await connectSocket(aToken);
  return { res: res, user: user.user };
}

/**
 * Pure IndexedDB/local cache loaders — NO socket, NO refresh.
 * Prefer window.__offlineStore (offline-store.js); fallback localStorage.
 */

/** Cache helpers — no socket, no refresh */

/** ========== OFFLINE-ONLY functions (no socket, no refresh, no API) ========== */
async function detectOfflineNow(): Promise<boolean> {
  // Server reachable → ONLINE (local tokens must not block API)
  if (typeof (window as any).__isOffline === 'function') {
    // Do not pass socket as offline signal — probe API only
    return await (window as any).__isOffline({ probeApi: true });
  }
  if (typeof (window as any).__probeServer === 'function') {
    const p = await (window as any).__probeServer();
    return !p.reachable;
  }
  return navigator.onLine === false;
}

async function loadConversationsOffline(): Promise<any[]> {
  const store = (window as any).__offlineStore;
  if (store?.loadConversations) {
    const list = await store.loadConversations();
    return Array.isArray(list) ? list : [];
  }
  try {
    const raw = localStorage.getItem('chat_cache_conversations');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function loadMessagesOffline(conversationId: string): Promise<{
  messages: any[];
  nextCursor?: any;
  hasMore: boolean;
  offline: true;
}> {
  const store = (window as any).__offlineStore;
  if (store?.loadMessages) {
    const cached = await store.loadMessages(conversationId);
    return {
      messages: cached?.messages || [],
      nextCursor: cached?.meta?.nextCursor,
      hasMore: false,
      offline: true,
    };
  }
  try {
    const raw = localStorage.getItem('chat_cache_messages:' + conversationId);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      messages: parsed?.messages || [],
      nextCursor: parsed?.meta?.nextCursor,
      hasMore: false,
      offline: true,
    };
  } catch {
    return { messages: [], hasMore: false, offline: true };
  }
}

async function bootOffline(): Promise<{
  mode: 'offline';
  conversations: any[];
  accessToken?: string | null;
  user?: any;
}> {
  if (typeof (window as any).__persistTokensForOffline === 'function') {
    (window as any).__persistTokensForOffline();
  }
  const conversations = await loadConversationsOffline();
  let user: any = { userId: 'offline-user', username: 'offline' };
  try {
    const raw = localStorage.getItem('chat_user_cache');
    if (raw) user = JSON.parse(raw);
  } catch {
    /* */
  }
  if ((window as any).__authMemory?.user) {
    user = (window as any).__authMemory.user;
  }
  return {
    mode: 'offline',
    conversations,
    accessToken:
      (typeof (window as any).__getOnlineAccessToken === 'function'
        ? (window as any).__getOnlineAccessToken()
        : getOnlineAccessToken()),
    user,
  };
}

/** ========== ONLINE-ONLY functions ========== */
async function loadConversationsOnline(): Promise<any[]> {
  const auth = await refresh();
  const token = auth?.res?.accessToken;
  const response = await fetch('/conversation/get', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit: 50 }),
  });
  if (!response.ok) throw new Error('conversation list failed');
  const resp = await response.json();
  const list = Array.isArray(resp?.conversations)
    ? resp.conversations
    : Array.isArray(resp)
      ? resp
      : [];
  await saveConversationsToCache(list);
  return list;
}

async function loadMessagesOnline(
  conversationId: string,
  limit = 50,
  cursor: string | null = null,
): Promise<any> {
  const refreshed = await refresh();
  const token = refreshed.res.accessToken;
  let url = `/messages/${conversationId}?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to load messages');
  const data = await res.json();
  if (!cursor) {
    await saveMessagesToCache(String(conversationId), data.messages || [], {
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    });
  }
  return data;
}

async function bootOnline(): Promise<{
  mode: 'online';
  conversations: any[];
  accessToken?: string | null;
  user?: any;
}> {
  const auth = await refresh();
  const token = auth?.res?.accessToken;
  if (token && typeof (window as any).__setAuthMemory === 'function') {
    (window as any).__setAuthMemory({
      accessToken: token,
      refreshToken: (auth as any)?.res?.refreshToken,
    }, auth.user);
  }
  try {
    if (!socket?.connected) await connectSocket(token);
  } catch (e) {
  }
  const list = await loadConversationsOnline();
  return {
    mode: 'online',
    conversations: list,
    accessToken: token,
    user: auth.user,
  };
}


/** Back-compat aliases (old names) */
const loadConversationsFromCache = loadConversationsOffline;
const loadMessagesFromCache = loadMessagesOffline;

async function saveConversationsToCache(list: any[]) {
  const arr = Array.isArray(list) ? list : [];
  const store = (window as any).__offlineStore;
  try {
    if (store?.saveConversations) await store.saveConversations(arr);
  } catch {
    /* */
  }
  try {
    localStorage.setItem('chat_cache_conversations', JSON.stringify(arr));
  } catch {
    /* */
  }
}

async function saveMessagesToCache(
  conversationId: string,
  messages: any[],
  meta?: any,
) {
  const store = (window as any).__offlineStore;
  try {
    if (store?.saveMessages) {
      await store.saveMessages(conversationId, messages || [], meta || {});
    }
  } catch {
    /* */
  }
  try {
    localStorage.setItem(
      'chat_cache_messages:' + conversationId,
      JSON.stringify({ messages: messages || [], meta: meta || {} }),
    );
  } catch {
    /* */
  }
}

/**
 * Router: pick online or offline boot (separate function trees)
 */
async function bootData(): Promise<{
  mode: 'online' | 'offline';
  conversations: any[];
  accessToken?: string | null;
  user?: any;
}> {
  const offline = await detectOfflineNow();
  if (offline) {
    return bootOffline();
  }
  try {
    return await bootOnline();
  } catch (e) {
    if (typeof (window as any).__persistTokensForOffline === 'function') {
      (window as any).__persistTokensForOffline();
    }
    return bootOffline();
  }
}


/** Offline outbox + read cache (does not touch refresh()) */
const OUTBOX_KEY = 'chat_outbox_v1';

function loadOutbox(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOutbox(items: any[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items || []));
}

function enqueueOutbox(item: any) {
  const list = loadOutbox();
  list.push(item);
  saveOutbox(list);
}

function removeOutboxItem(clientMessageId: string) {
  saveOutbox(loadOutbox().filter((x) => x.clientMessageId !== clientMessageId));
}

function isSocketOnline() {
  return !!socket && socket.connected === true;
}

async function flushOutbox() {
  if (!isSocketOnline()) {
    return;
  }
  const list = loadOutbox();
  if (!list.length) return;
  for (const item of [...list]) {
    await new Promise<void>((resolve) => {
      try {
        socket.emit(
          'message:send',
          {
            conversationId: item.conversationId,
            content: item.content,
            clientMessageId: item.clientMessageId,
            type: item.type || 'text',
            replyToMessageId: item.replyToMessageId,
          },
          (res: any) => {
            if (res && res.success) {
              removeOutboxItem(item.clientMessageId);
              const el =
                document.querySelector(
                  `[data-client-id="${item.clientMessageId}"]`,
                ) ||
                document.querySelector(
                  `[data-message-id="local-${item.clientMessageId}"]`,
                );
              if (el && res.message?.messageId) {
                el.setAttribute('data-message-id', res.message.messageId);
                el.classList.remove('msg-pending');
              }
            } else {
            }
            resolve();
          },
        );
      } catch (e) {
        resolve();
      }
    });
  }
}

/** Call when back online */
function setupOutboxAutoFlush() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    (window as any).__lastOffline = false;
    flushOutbox().catch(() => undefined);
  });
}
setupOutboxAutoFlush();

// Flush when back online / socket reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOutbox().catch(() => undefined);
  });
}


/**
 * Voice call client (LAN-first)
 * Requires global `io` socket already connected with auth: { token: accessToken }
 *
 * Usage:
 *   const call = createCallClient(socket);
 *   call.start(peerUserId);
 *   // incoming UI is automatic
 */


function createCallClient(socket: any) {
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let currentCallId: string | null = null;
  let isCaller = false;
  let remoteAudio: HTMLAudioElement | null = null;

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  function ensureRemoteAudio() {
    if (remoteAudio) return remoteAudio;
    remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.id = 'remoteAudio';
      document.body.appendChild(remoteAudio);
    }
    remoteAudio.autoplay = true;
    remoteAudio.muted = false;
    remoteAudio.volume = 1;
    remoteAudio.setAttribute('playsinline', 'true');
    (remoteAudio as any).playsInline = true;
    return remoteAudio;
  }

  async function playRemote() {
    const el = ensureRemoteAudio();
    el.muted = false;
    el.volume = 1;
    try {
      await el.play();
    } catch (e) {
    }
  }

  function showIncomingUI(callerId: string, callId: string) {
    document.getElementById('incomingCallBanner')?.remove();
    ensureCallUiStyles();
    const banner = document.createElement('div');
    banner.id = 'incomingCallBanner';
    banner.className = 'nx-call-overlay';
    banner.innerHTML = `
      <div class="nx-call-card nx-call-incoming">
        <div class="nx-call-avatar"><i class="fa-solid fa-phone"></i></div>
        <div class="nx-call-title">Incoming call</div>
        <div class="nx-call-sub">${escapeHtml(callerId)}</div>
        <div class="nx-call-actions">
          <button type="button" class="nx-call-btn reject" data-act="reject" title="Reject">
            <i class="fa-solid fa-phone-slash"></i>
          </button>
          <button type="button" class="nx-call-btn accept" data-act="accept" title="Accept">
            <i class="fa-solid fa-phone"></i>
          </button>
        </div>
      </div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-act="accept"]')?.addEventListener('click', () => {
      banner.remove();
      void accept(callId);
    });
    banner.querySelector('[data-act="reject"]')?.addEventListener('click', () => {
      banner.remove();
      reject(callId);
    });
  }

  function escapeHtml(s: string) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }


  let callUiMinimized = false;
  let callUiStatusText = '';
  let isMuted = false;
  let speakerOn = true;

  function ensureCallUiStyles() {
    if (document.getElementById('callUiStyles')) return;
    const s = document.createElement('style');
    s.id = 'callUiStyles';
    s.textContent = `
      .nx-call-overlay{
        position:fixed;inset:0;z-index:2147483647;
        display:flex;align-items:center;justify-content:center;
        background:rgba(8,10,14,.72);backdrop-filter:blur(6px);
        padding:16px;
      }
      .nx-call-card{
        width:min(92vw,340px);
        background:#161b22;
        border:1px solid rgba(97,50,219,.25);
        border-radius:20px;
        padding:28px 22px 22px;
        text-align:center;
        color:#f5f7fa;
        box-shadow:0 20px 50px rgba(0,0,0,.45);
      }
      .nx-call-avatar{
        width:72px;height:72px;margin:0 auto 14px;
        border-radius:50%;
        background:linear-gradient(145deg,#6132DB,#3b1d8f);
        display:grid;place-items:center;
        font-size:1.6rem;color:#fff;
        box-shadow:0 0 0 4px rgba(97,50,219,.2);
      }
      .nx-call-title{font-size:1.15rem;font-weight:700;margin:0 0 6px}
      .nx-call-sub{font-size:.88rem;color:rgba(245,247,250,.55);margin:0 0 22px;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .nx-call-actions{display:flex;gap:18px;justify-content:center;align-items:center}
      .nx-call-btn{
        width:56px;height:56px;border:none;border-radius:50%;
        cursor:pointer;display:grid;place-items:center;
        font-size:1.2rem;color:#fff;transition:transform .12s ease,opacity .12s;
      }
      .nx-call-btn:active{transform:scale(.94)}
      .nx-call-btn.accept{background:#6132DB;box-shadow:0 6px 18px rgba(97,50,219,.4)}
      .nx-call-btn.reject{background:#3d1f2a;color:#fca5a5}
      #callModalPanel{
        position:fixed;left:50%;transform:translateX(-50%);
        top:max(10px,env(safe-area-inset-top));
        width:min(100%,420px);
        z-index:2147483645;
        background:#161b22;
        border:1px solid rgba(97,50,219,.28);
        border-radius:0 0 18px 18px;
        color:#f5f7fa;
        padding:14px 14px 16px;
        box-shadow:0 12px 32px rgba(0,0,0,.4);
        font-family:system-ui,-apple-system,sans-serif;
      }
      #callModalPanel .call-row{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
      }
      #callModalPanel .call-title{font-size:.95rem;font-weight:700;color:#f5f7fa}
      #callModalPanel .call-sub{font-size:.78rem;color:rgba(245,247,250,.55);margin-top:2px}
      #callModalPanel .call-actions{
        display:flex;gap:10px;margin-top:14px;justify-content:center;flex-wrap:wrap;
      }
      #callModalPanel button.call-btn{
        border:none;border-radius:14px;padding:10px 14px;min-width:72px;
        font-size:.8rem;font-weight:600;cursor:pointer;color:#f5f7fa;
        background:#1f2633;
      }
      #callModalPanel button.call-btn.mute{background:#1f2633}
      #callModalPanel button.call-btn.speaker{background:#1f2633}
      #callModalPanel button.call-btn.hang{background:#7f1d1d;color:#fecaca}
      #callModalPanel button.call-btn.mini{
        background:transparent;border:1px solid rgba(255,255,255,.12);
        min-width:auto;padding:8px 10px;font-size:.75rem;opacity:.9;
      }
      #callModalPanel button.call-btn.active{
        outline:2px solid #6132DB;background:rgba(97,50,219,.2);
      }
      #callStatusBar{
        position:fixed;left:50%;transform:translateX(-50%);
        top:max(8px,env(safe-area-inset-top));
        z-index:2147483644;
        width:min(92vw,360px);
        background:#161b22;
        border:1px solid rgba(97,50,219,.35);
        color:#f5f7fa;
        padding:10px 14px;border-radius:14px;
        font-size:.85rem;text-align:center;cursor:pointer;
        box-shadow:0 8px 24px rgba(0,0,0,.35);
      }
    `;
    document.head.appendChild(s);
  }

  function applyMute(mute: boolean) {
    isMuted = mute;
    try {
      if (localStream) {
        localStream.getAudioTracks().forEach((tr) => {
          tr.enabled = !mute;
        });
      }
      if (pc) {
        pc.getSenders().forEach((sender) => {
          const tr = sender.track;
          if (tr && tr.kind === 'audio') {
            tr.enabled = !mute;
          }
        });
      }
    } catch (e) {
    }
    const btn = document.querySelector('#callModalPanel button.call-btn.mute');
    if (btn) {
      btn.innerHTML = mute
        ? '<i class="fa-solid fa-microphone"></i> Unmute'
        : '<i class="fa-solid fa-microphone-slash"></i> Mute';
      btn.classList.toggle('active', mute);
      btn.setAttribute('aria-pressed', mute ? 'true' : 'false');
    }
  }


  async function applySpeaker(on: boolean) {
    speakerOn = on;
    const el = ensureRemoteAudio();
    el.muted = false;
    el.volume = 1;
    try {
      const anyEl = el as any;
      if (typeof anyEl.setSinkId === 'function') {
        try {
          const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
          tmp.getTracks().forEach((tr) => tr.stop());
        } catch {}
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outs = devices.filter((d) => d.kind === 'audiooutput');
        if (on) {
          try {
            await anyEl.setSinkId('default');
          } catch {
            await anyEl.setSinkId('');
          }
        } else {
          const ear =
            outs.find((d) =>
              /comm|ear|phone|receiver|headset/i.test(d.label || ''),
            ) ||
            outs.find((d) => d.deviceId && d.deviceId !== 'default');
          if (ear) await anyEl.setSinkId(ear.deviceId);
          else {
            await anyEl.setSinkId('');
          }
        }
      } else {
      }
      void el.play().catch(() => undefined);
    } catch (e) {
    }
    const btn = document.querySelector('#callModalPanel button.call-btn.speaker');
    if (btn) {
      btn.innerHTML = on ? '<i class="fa-solid fa-volume-high"></i> Speaker' : '<i class="fa-solid fa-mobile"></i> Earpiece';
      btn.classList.toggle('active', on);
    }
  }


  function showCallModal() {
    ensureCallUiStyles();
    callUiMinimized = false;
    document.getElementById('callStatusBar')?.remove();
    let panel = document.getElementById('callModalPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'callModalPanel';
      document.body.appendChild(panel);
    }
    panel.style.display = 'block';
    panel.innerHTML = `
      <div class="call-row">
        <div>
          <div class="call-title"><i class="fa-solid fa-phone" style="color:#6132DB;margin-right:6px"></i>Voice call</div>
          <div class="call-sub" id="callModalStatusText">${callUiStatusText || 'In call'}</div>
        </div>
        <button type="button" class="call-btn mini" data-act="minimize" title="Minimize"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      <div class="call-actions">
        <button type="button" class="call-btn mute" data-act="mute">${isMuted ? '<i class="fa-solid fa-microphone"></i> Unmute' : '<i class="fa-solid fa-microphone-slash"></i> Mute'}</button>
        <button type="button" class="call-btn speaker" data-act="speaker">${speakerOn ? '<i class="fa-solid fa-volume-high"></i> Speaker' : '<i class="fa-solid fa-mobile"></i> Earpiece'}</button>
        <button type="button" class="call-btn hang" data-act="hang"><i class="fa-solid fa-phone-slash"></i> End</button>
      </div>
    `;
    panel.querySelector('[data-act="minimize"]')?.addEventListener('click', () => minimizeCallUi());
    panel.querySelector('[data-act="mute"]')?.addEventListener('click', () => applyMute(!isMuted));
    panel.querySelector('[data-act="speaker"]')?.addEventListener('click', () => void applySpeaker(!speakerOn));
    panel.querySelector('[data-act="hang"]')?.addEventListener('click', () => end());
  }

  function minimizeCallUi() {
    callUiMinimized = true;
    document.getElementById('callModalPanel')?.remove();
    ensureCallUiStyles();
    let bar = document.getElementById('callStatusBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'callStatusBar';
      document.body.appendChild(bar);
    }
    bar.style.display = 'block';
    bar.textContent = callUiStatusText || 'In call — tap to expand';
    bar.onclick = () => {
      showCallModal();
      const st = document.getElementById('callModalStatusText');
      if (st) st.textContent = callUiStatusText || 'In call';
    };
  }

  function showStatus(text: string) {
    callUiStatusText = text;
    ensureCallUiStyles();
    // While in an active call UI, prefer modal (or mini bar)
    if (currentCallId || isCaller) {
      if (callUiMinimized) {
        const bar = document.getElementById('callStatusBar');
        if (bar) {
          bar.style.display = 'block';
          bar.textContent = text + ' — tap to expand';
          bar.onclick = () => {
            showCallModal();
            const st = document.getElementById('callModalStatusText');
            if (st) st.textContent = callUiStatusText;
          };
        } else {
          minimizeCallUi();
        }
      } else {
        showCallModal();
        const st = document.getElementById('callModalStatusText');
        if (st) st.textContent = text;
      }
      return;
    }
    // Fallback tiny bar (pre-call edge cases)
    let el = document.getElementById('callStatusBar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'callStatusBar';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.textContent = text;
  }

  function hideStatus() {
    document.getElementById('callModalPanel')?.remove();
    document.getElementById('callStatusBar')?.remove();
    callUiMinimized = false;
    callUiStatusText = '';
    isMuted = false;
    speakerOn = true;
  }

  async function ensurePc(): Promise<RTCPeerConnection> {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (ev) => {
      if (ev.candidate && currentCallId && socket?.connected) {
        socket.emit('call:ice', {
          callId: currentCallId,
          candidate: ev.candidate,
        });
      }
    };

    pc.ontrack = (ev) => {
      const el = ensureRemoteAudio();
      if (ev.streams && ev.streams[0]) {
        el.srcObject = ev.streams[0];
        remoteStream = ev.streams[0];
      } else {
        if (!remoteStream) remoteStream = new MediaStream();
        if (!remoteStream.getTracks().some((x) => x.id === ev.track.id)) {
          remoteStream.addTrack(ev.track);
        }
        el.srcObject = remoteStream;
      }
      el.muted = false;
      el.volume = 1;
      void playRemote();
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'connected') {
        callUiMinimized = false;
        showStatus('In call');
      }
      if (
        pc?.connectionState === 'failed' ||
        pc?.connectionState === 'disconnected' ||
        pc?.connectionState === 'closed'
      ) {
        // soft — endCall will cleanup
      }
    };

    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }
    if (isMuted) applyMute(true);
    return pc;
  }

  let remoteStream: MediaStream | null = null;

  async function ensureMic() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return localStream;
  }

  async function cleanup() {
    document.getElementById('incomingCallBanner')?.remove();
    hideStatus();
    currentCallId = null;
    isCaller = false;
    try {
      pc?.getSenders()?.forEach((s) => {
        try {
          s.track?.stop();
        } catch {}
      });
      pc?.close();
    } catch {}
    pc = null;
    try {
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStream = null;
    remoteStream = null;
    if (remoteAudio) remoteAudio.srcObject = null;
  }

  async function start(receiverId: string, conversationId?: string) {
    if (!socket?.connected) {
      void appDialog.alert('Socket not connected');
      return;
    }
    if (!receiverId) {
      void appDialog.alert('No peer user id');
      return;
    }
    isCaller = true;
    void playRemote(); // unlock audio under gesture
    showStatus('Calling…');
    socket.emit('call:start', {
      receiverId: String(receiverId),
      conversationId: conversationId ? String(conversationId) : undefined,
    });
  }

  async function accept(callId: string) {
    isCaller = false;
    currentCallId = callId;
    void playRemote();
    try {
      await ensureMic();
    } catch (e) {
      void appDialog.alert('Microphone permission required');
      reject(callId);
      return;
    }
    showStatus('Connecting…');
    socket.emit('call:accept', { callId });
  }

  function reject(callId: string) {
    socket.emit('call:reject', { callId });
    void cleanup();
  }

  function end() {
    if (currentCallId && socket?.connected) {
      socket.emit('call:end', { callId: currentCallId });
    }
    void cleanup();
    try {
      setTimeout(() => (window as any).__reloadCallLogs?.(), 400);
    } catch {}
  }

  async function onAccepted(data: any) {
    const callId = String(data?.callId || '');
    if (!callId) {
      return;
    }
    currentCallId = callId;
    if (!isCaller) {
      showStatus('Connecting…');
      return;
    }

    try {
      showStatus('Creating offer…');
      await ensureMic();
      const conn = await ensurePc();
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      socket.emit('call:offer', { callId, sdp: offer });
      showStatus('Offer sent…');
    } catch (e) {
      end();
    }
  }

  async function onOffer(data: any) {
    const callId = String(data?.callId || '');
    const sdp = data?.sdp;
    if (!callId || !sdp) return;
    currentCallId = callId;
    try {
      await ensureMic();
      const conn = await ensurePc();
      await conn.setRemoteDescription(sdp);
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      socket.emit('call:answer', { callId, sdp: answer });
    } catch (e) {
    }
  }

  async function onAnswer(data: any) {
    const sdp = data?.sdp;
    if (!sdp || !pc) return;
    try {
      await pc.setRemoteDescription(sdp);
    } catch (e) {
    }
  }

  async function onIce(data: any) {
    const candidate = data?.candidate;
    if (!candidate || !pc) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch (e) {
    }
  }

  function bind() {
    if (!socket) return;
    socket.off('call:incoming');
    socket.off('call:ringing');
    socket.off('call:accepted');
    socket.off('call:offer');
    socket.off('call:answer');
    socket.off('call:ice');
    socket.off('call:rejected');
    socket.off('call:ended');
    socket.off('call:failed');

    socket.on('call:ringing', (d: any) => {
      currentCallId = d?.callId || currentCallId;
      showStatus('Ringing…');
    });

    socket.on('call:incoming', (d: any) => {
      const callId = String(d?.callId || '');
      const callerId = String(d?.callerId || '');
      if (!callId) {
        return;
      }
      currentCallId = callId;
      showIncomingUI(callerId, callId);
    });

    socket.on('call:accepted', (d: any) => {
      void onAccepted(d);
    });

    socket.on('call:offer', (d: any) => void onOffer(d));
    socket.on('call:answer', (d: any) => void onAnswer(d));
    socket.on('call:ice', (d: any) => void onIce(d));

    socket.on('call:rejected', () => {
      void appDialog.alert('Call rejected');
      void cleanup();
    });
    socket.on('call:ended', () => {
      void cleanup();
      try {
        (window as any).__reloadCallLogs?.();
      } catch {}
    });
    socket.on('call:failed', (d: any) => {
      const reason = typeof d === 'string' ? d : d?.reason || 'unknown';
      void appDialog.alert('Call failed: ' + reason);
      void cleanup();
    });

  }

  bind();
  socket.on('connect', () => bind());

  (window as any).__callClientAccept = (id: string) => void accept(id);
  (window as any).__onCallAccepted = (d: any) => void onAccepted(d);

  return {
    start,
    accept,
    reject,
    end,
    bind,
    get callId() {
      return currentCallId;
    },
  };
}


async function initi() {
  setTimeout(() => hardenInputsAgainstAutofill(document), 0);
  const boot = await bootData();
  (window as any).__bootMode = boot.mode;
  (window as any).__bootConversations = boot.conversations;

  const user = boot.user || {};
  const currentUserId = String(
    user.userId || user._id || user.id || 'offline-user',
  );
  let currentUsername = String(
    user.username ||
      user.userName ||
      user.name ||
      (window as any).__authMemory?.user?.username ||
      (window as any).__authMemory?.user?.userName ||
      '',
  );
  if (!currentUsername) {
    try {
      const cached = JSON.parse(localStorage.getItem('chat_user_cache') || 'null');
      currentUsername = String(
        cached?.username || cached?.userName || cached?.name || '',
      );
    } catch {}
  }
  if (!currentUsername || currentUsername.toLowerCase() === 'user') {
    currentUsername = '';
  }
  // Point 4: socket/call optional
  (window as any).__currentUserId = currentUserId;
  (window as any).__currentUsername = currentUsername;

  const DEFAULT_AVATAR = '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg';

  function resolveMediaUrl(path: any): string {
    const p = String(path || '').trim();
    if (!p) return DEFAULT_AVATAR;
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('blob:') || p.startsWith('data:')) {
      return p;
    }
    if (p.startsWith('/')) return p;
    return '/' + p.replace(/^\/+/, '');
  }

  function applySelfAvatar(url?: string) {
    const src = resolveMediaUrl(
      url ||
        (window as any).__authMemory?.user?.profilePic ||
        (window as any).__selfProfilePic ||
        '',
    );
    (window as any).__selfProfilePic = src === DEFAULT_AVATAR ? (window as any).__selfProfilePic : src;
    const finalSrc =
      (window as any).__selfProfilePic && (window as any).__selfProfilePic !== DEFAULT_AVATAR
        ? (window as any).__selfProfilePic
        : src;
    const el = document.getElementById('ali') as HTMLImageElement | null;
    if (el) el.src = finalSrc || DEFAULT_AVATAR;
    document.querySelectorAll('#settingsHomeAvatar, #settingsAvatarImg').forEach((img) => {
      (img as HTMLImageElement).src = finalSrc || DEFAULT_AVATAR;
    });
  }

  void (async () => {
    try {
      const token =
        getOnlineAccessToken();
      if (!token) return;
      const res = await fetch('/users/profile', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const u = data.user || data;
      if (u.profilePic) {
        (window as any).__selfProfilePic = resolveMediaUrl(u.profilePic);
        applySelfAvatar(u.profilePic);
      }
      if (u.displayName) {
        try {
          applyMyUsername(u.displayName);
        } catch {
          (window as any).__currentUsername = u.displayName;
        }
      }
    } catch {}
  })();

  try {
    if (currentUsername) {
      const mem = (window as any).__authMemory || {};
      mem.user = {
        ...(mem.user || {}),
        userId: currentUserId,
        username: currentUsername,
        userName: currentUsername,
      };
      (window as any).__authMemory = mem;
    }
  } catch {}

  function applyMyUsername(name: string) {
    const n = String(name || '').trim();
    if (!n || n.toLowerCase() === 'user' || n.toLowerCase() === 'account') return;
    (window as any).__currentUsername = n;
    try {
      const mem = (window as any).__authMemory || {};
      mem.user = {
        ...(mem.user || {}),
        userId: currentUserId,
        username: n,
        userName: n,
      };
      (window as any).__authMemory = mem;
      localStorage.setItem(
        'chat_user_cache',
        JSON.stringify({ ...(mem.user || {}), userId: currentUserId, username: n }),
      );
    } catch {}
  }

  async function fetchMyUsername(): Promise<string> {
    try {
      const token =
        getOnlineAccessToken();
      if (!token) return (window as any).__currentUsername || '';
      // JWT payload fallback
      try {
        const mid = token.split('.')[1];
        if (mid) {
          const json = JSON.parse(
            atob(mid.replace(/-/g, '+').replace(/_/g, '/')),
          );
          const fromJwt =
            json.username || json.userName || json.name || json.preferred_username;
          if (fromJwt) applyMyUsername(String(fromJwt));
        }
      } catch {}
      const res = await fetch('/users/profile', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user || data;
        const n =
          u.username || u.userName || u.name || data.username || '';
        if (n) applyMyUsername(String(n));
      }
      // last resort: find self in /users/list
      if (!(window as any).__currentUsername) {
        try {
          const lr = await fetch('/users/list', {
            headers: { Authorization: 'Bearer ' + token },
            credentials: 'include',
            cache: 'no-store',
          });
          if (lr.ok) {
            const ld = await lr.json();
            // profile alone may not list self; skip
          }
        } catch {}
      }
    } catch (e) {
    }
    return String((window as any).__currentUsername || '');
  }

  // Resolve name early (settings + UI)
  void fetchMyUsername();
  const chatManager = createChatManager(socket, currentUserId);
  try { chatManager.setupListeners(); } catch { /* ignore */ }
  let presenceUI: any = null;
  try {
    if (socket) {
      presenceUI = initPresenceUI({ socket, currentUserId });
    }
  } catch (e) {
  }

  let callClient: any = null;
  function ensureCallClient() {
    if (!socket) {
      return null;
    }
    if (!callClient) {
      callClient = createCallClient(socket);
    } else {
      callClient.bind();
    }
    return callClient;
  }
  try {
    ensureCallClient();
  } catch (e) {
  }
  (window as any).__setupCallListeners = () => {
    try { ensureCallClient(); } catch { /* ignore */ }
  };

  (window as any).__startCall = (peerId: string) => {
  void startCall(peerId);
};
function startCall(targetUserId: string | number, conversationId?: string) {
    const cc = ensureCallClient();
    if (!cc || !socket?.connected) {
      void appDialog.alert('Calls unavailable — socket not connected');
      return;
    }
    cc.start(String(targetUserId || ''), conversationId ? String(conversationId) : undefined);
  }
  (window as any).__startCall = startCall;
  (window as any).__endCall = () => callClient && callClient.end();

  const $ = document;

  const searcheInput = $.getElementById("SINP") as HTMLInputElement;
  let topList = $.querySelectorAll<HTMLElement>("#topList>li");
  let bottomListSVG = $.querySelectorAll<HTMLElement>("#bottomList>li");
  let pageL: number = 0;

  /** Mobile / in-app back — single coherent history model */
  let __navSilent = false;

  function closeTopOverlay(): boolean {
    const peer = document.getElementById('peerProfileOverlay');
    if (peer) {
      peer.remove();
      return true;
    }
    const nc = document.getElementById('newChatOverlay');
    if (nc) {
      nc.remove();
      return true;
    }
    const ctx = document.getElementById('msgContextMenu') as HTMLElement | null;
    if (ctx && ctx.style.display !== 'none') {
      ctx.style.display = 'none';
      return true;
    }
    const lb = document.getElementById('mediaLightbox') as HTMLElement | null;
    if (lb && lb.style.display !== 'none') {
      lb.style.display = 'none';
      return true;
    }
    return false;
  }

  function navigateToMessagesTab() {
    try {
      const msgBtn = Array.from(bottomListSVG).find((el) =>
        (el.className || '').includes('fa-message'),
      );
      if (msgBtn) {
        msgBtn.click();
        return;
      }
    } catch {}
    pageL = 0;
    try {
      clearMainPanels();
      void hel();
    } catch {}
  }

  /** Close chat → one API reload, filter applied before cards are built */
  function restoreConversationListAfterChat() {
    if (typeof pageL !== 'undefined' && pageL !== 0) return;
    try {
      void Promise.resolve(hel());
    } catch (e) {
    }
  }

  function closeChatDomOnly() {
    try { document.body.classList.remove('chat-open'); } catch {}
    const chatPage = document.getElementById('chatPage');
    const leavingId =
      (window as any).__currentConversationId ||
      chatManager?.currentConversationId ||
      null;

    try {
      chatManager?.leaveConversation?.(leavingId);
    } catch {}
    try {
      if (presenceUI && typeof presenceUI.onCloseChat === 'function') {
        presenceUI.onCloseChat(leavingId);
      }
    } catch {}

    (window as any).__currentConversationId = null;

    if (chatPage) {
      chatPage.remove();
    }

    restoreConversationListAfterChat();
    return true;
  }

  function armNavTrap() {
    try {
      __navSilent = true;
      history.pushState(
        { app: 'trap', pageL, t: Date.now() },
        '',
        location.pathname + location.search,
      );
      setTimeout(() => {
        __navSilent = false;
      }, 0);
    } catch {
      __navSilent = false;
    }
  }

  /**
   * In-app back button on chat header.
   * Closes chat and replaces history state so we are not "still on chat" in the stack.
   */
  function backFromChatButton() {
    closeChatDomOnly();
    try {
      // Replace current (chat) entry with trap — do NOT history.back()
      // (history.back would fire popstate and feel like a second navigation)
      history.replaceState(
        { app: 'trap', pageL: 0 },
        '',
        location.pathname + location.search,
      );
      armNavTrap();
    } catch {}
  }

  function handleAppBack(): void {
    if (closeTopOverlay()) return;
    if (document.getElementById('chatPage')) {
      closeChatDomOnly();
      return;
    }
    if (pageL !== 0) {
      navigateToMessagesTab();
      return;
    }
    // Already on conversation list — stay (caller re-arms trap)
  }

  try {
    history.replaceState({ app: 'home', pageL: 0 }, '', location.href);
    armNavTrap();
  } catch {}

  window.addEventListener('popstate', () => {
    if (__navSilent) return;
    try {
      handleAppBack();
    } catch (e) {
    }
    // Always keep a trap so list / home never exits the app
    armNavTrap();
  });

  (window as any).__armNavTrap = armNavTrap;
  (window as any).__backFromChatButton = backFromChatButton;
  (window as any).__closeChatDomOnly = closeChatDomOnly;
  (window as any).__navPush = (state: any) => {
    try {
      history.pushState(state, '', location.pathname + location.search);
    } catch {}
  };


  /** Remove all main tab UIs (chats, calls, contacts, settings, AI, chat page) */
  function clearMainPanels() {
    document
      .querySelectorAll(
        'main > .conv, main > .call, main > .empty-state, main > .settings-card, main > .settings-panel, main > .ai-panel, main > .contact-row, main > .contacts-wrap, #chatPage',
      )
      .forEach((e) => e.remove());
  }


  let _reloadConvTimer: any = null;
  function reloadConversationList(_meta?: any) {
    try {
      if (_reloadConvTimer) clearTimeout(_reloadConvTimer);
      _reloadConvTimer = setTimeout(() => {
        if (typeof hel === 'function') {
          void Promise.resolve(hel()).catch((e: any) =>{})
        }
      }, 300);
    } catch (e) {
    }
  }
  (window as any).__reloadConversationList = reloadConversationList;


  const a = $.querySelector('.plus') as HTMLElement;

  async function kkk(opts: { cursor?: string; archived?: boolean } = {}) {
    const store = (window as any).__offlineStore;

    // Offline: never touch network / refresh
    if (await detectOfflineNow()) {
      const cached = await loadConversationsOffline();
      return { conversations: cached, offline: true };
    }

    try {
      const conver = await refresh();
      const response = await fetch('/conversation/get', {
        method: "POST",
        headers: {
          Authorization: `Bearer ${conver.res.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cursor: opts.cursor,
          limit: 50,
          archived: opts.archived,
        }),
      });
      if (!response.ok) throw new Error('conversation list failed');
      const resp = await response.json();
      const list = Array.isArray(resp.conversations)
        ? resp.conversations
        : Array.isArray(resp)
          ? resp
          : [];
      await saveConversationsToCache(list);
      return { ...resp, conversations: list };
    } catch (err) {
      const cached = await loadConversationsOffline();
      return { conversations: cached, offline: true };
    }
  }

  async function createConversationWithUser(participantId: string) {
    const conver = await refresh();
    const response = await fetch('/conversation/create', {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conver.res.accessToken}`,
        'Content-Type': "application/json",
      },
      body: JSON.stringify({ participantId }),
    });
    const resp = await response.json();
    if (!response.ok) {
      throw new Error(resp.message || resp.error || 'create failed');
    }
    // Normalize Mongo document / various API shapes
    const conversationId = String(
      resp.conversationId ||
        resp._id ||
        resp.id ||
        resp.conversation?._id ||
        resp.conversation?.id ||
        '',
    );
    return {
      ...resp,
      conversationId,
      peerId: participantId,
      userId: participantId,
    };
  }

  /**
   * After create: reload conversation list from API and upsert the matching card
   * so name / lastMessage / unread come from backend, not Contacts UI only.
   */
  async function hydrateConversationCardFromApi(
    conversationId: string,
    fallback?: {
      conID: string;
      ID?: string | null;
      name?: string;
      imgSrc?: string;
    },
  ) {
    const id = String(conversationId || '');
    if (!id) return null;
    try {
      const co = await kkk({ limit: 50 } as any);
      const list = (co as any)?.conversations || [];
      let mapped: any = null;
      for (const ele of list) {
        const d = mapConversationItem(ele);
        if (d.conID && String(d.conID) === id) {
          mapped = d;
          break;
        }
      }
      if (mapped) {
        upsertConversationCard(
          {
            conID: String(mapped.conID),
            ID: mapped.ID,
            name: mapped.name,
            imgSrc: mapped.imgSrc,
            LME: mapped.LME,
            LMET: mapped.LMET,
            UNM: mapped.UNM,
          },
          { forceDom: typeof pageL === 'undefined' || pageL === 0 },
        );
        return mapped;
      }
    } catch (e) {
    }
    if (fallback?.conID) {
      upsertConversationCard(fallback);
    }
    return null;
  }


  async function createGroupConversation(title: string, participantIds: string[]) {
    const conver = await refresh();
    const response = await fetch('/conversation/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conver.res.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'group',
        title: title.trim(),
        participantIds,
      }),
    });
    const resp = await response.json();
    if (!response.ok) {
      throw new Error(resp.message || resp.error || 'create group failed');
    }
    const conversationId = String(
      resp.conversationId ||
        resp._id ||
        resp.id ||
        resp.conversation?._id ||
        '',
    );
    return { ...resp, conversationId, title: title.trim() };
  }

  function closeNewChatOverlay() {
    document.getElementById('newChatOverlay')?.remove();
  }

  function showNewChatMenu() {
    closeNewChatOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'newChatOverlay';
    overlay.className = 'new-chat-overlay';
    overlay.innerHTML = `
      <div class="new-chat-sheet" role="dialog" aria-label="New conversation">
        <div class="new-chat-sheet-head">
          <h3>New</h3>
          <button type="button" class="new-chat-close" aria-label="Close">×</button>
        </div>
        <button type="button" class="new-chat-option" data-act="direct">New chat</button>
        <button type="button" class="new-chat-option" data-act="group">New group</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeNewChatOverlay();
    });
    overlay.querySelector('.new-chat-close')?.addEventListener('click', () => closeNewChatOverlay());
    overlay.querySelector('[data-act="direct"]')?.addEventListener('click', () => {
      closeNewChatOverlay();
      void openDirectChatPicker();
    });
    overlay.querySelector('[data-act="group"]')?.addEventListener('click', () => {
      closeNewChatOverlay();
      void openGroupCreator();
    });
    document.body.appendChild(overlay);
  }

  async function openDirectChatPicker() {
    closeNewChatOverlay();
    let users: any[] = [];
    try {
      users = await fetchAllUsers();
    } catch (e) {
      void appDialog.alert('Could not load users');
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'newChatOverlay';
    overlay.className = 'new-chat-overlay';
    const rows = users
      .map(
        (u) => `
      <button type="button" class="new-chat-user" data-id="${escapeHtml(u.userId)}" data-name="${escapeHtml(u.username)}">
        <span class="new-chat-user-name">${escapeHtml(u.username)}</span>
      </button>`,
      )
      .join('');
    overlay.innerHTML = `
      <div class="new-chat-sheet new-chat-sheet-tall">
        <div class="new-chat-sheet-head">
          <h3>New chat</h3>
          <button type="button" class="new-chat-close">×</button>
        </div>
        <input type="search" class="new-chat-search" placeholder="Search username…" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
        <div class="new-chat-list">${rows || '<p class="new-chat-empty">No users</p>'}</div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeNewChatOverlay();
    });
    overlay.querySelector('.new-chat-close')?.addEventListener('click', () => closeNewChatOverlay());
    const listEl = overlay.querySelector('.new-chat-list') as HTMLElement;
    overlay.querySelector('.new-chat-search')?.addEventListener('input', (e) => {
      const q = String((e.target as HTMLInputElement).value || '').toLowerCase();
      listEl.querySelectorAll('.new-chat-user').forEach((btn) => {
        const name = (btn as HTMLElement).dataset.name || '';
        (btn as HTMLElement).style.display = name.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    listEl.querySelectorAll('.new-chat-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id;
        const name = (btn as HTMLElement).dataset.name || 'Chat';
        if (!id) return;
        try {
          closeNewChatOverlay();
          const resp = await createConversationWithUser(id);
          const conId = resp.conversationId;
          if (!conId) throw new Error('No conversation id');
          await hydrateConversationCardFromApi(String(conId), {
            conID: String(conId),
            ID: id,
            name,
          });
          if (pageL === 0) await hel();
          openChatPage(
            String(conId),
            name,
            '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg',
            chatManager,
            currentUserId,
            id,
            typeof presenceUI !== 'undefined' ? presenceUI : undefined,
          );
        } catch (err: any) {
          void appDialog.alert(err?.message || 'Failed to create chat');
        }
      });
    });
    document.body.appendChild(overlay);
  }

  async function openGroupCreator() {
    closeNewChatOverlay();
    let users: any[] = [];
    try {
      users = await fetchAllUsers();
    } catch {
      void appDialog.alert('Could not load users');
      return;
    }
    const selected = new Set<string>();
    const overlay = document.createElement('div');
    overlay.id = 'newChatOverlay';
    overlay.className = 'new-chat-overlay';
    const rows = users
      .map(
        (u) => `
      <label class="new-chat-user new-chat-check">
        <input type="checkbox" data-id="${escapeHtml(u.userId)}" />
        <span class="new-chat-user-name">${escapeHtml(u.username)}</span>
      </label>`,
      )
      .join('');
    overlay.innerHTML = `
      <div class="new-chat-sheet new-chat-sheet-tall">
        <div class="new-chat-sheet-head">
          <h3>New group</h3>
          <button type="button" class="new-chat-close">×</button>
        </div>
        <input type="text" class="new-chat-title" placeholder="Group name" maxlength="60" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
        <input type="search" class="new-chat-search" placeholder="Search members…" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
        <div class="new-chat-list">${rows || '<p class="new-chat-empty">No users</p>'}</div>
        <button type="button" class="new-chat-create" disabled>Create group</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeNewChatOverlay();
    });
    overlay.querySelector('.new-chat-close')?.addEventListener('click', () => closeNewChatOverlay());

    const titleInp = overlay.querySelector('.new-chat-title') as HTMLInputElement;
    const createBtn = overlay.querySelector('.new-chat-create') as HTMLButtonElement;
    const listEl = overlay.querySelector('.new-chat-list') as HTMLElement;

    const refreshBtn = () => {
      createBtn.disabled = !(titleInp.value.trim() && selected.size >= 1);
    };
    titleInp.addEventListener('input', refreshBtn);
    overlay.querySelector('.new-chat-search')?.addEventListener('input', (e) => {
      const q = String((e.target as HTMLInputElement).value || '').toLowerCase();
      listEl.querySelectorAll('.new-chat-check').forEach((lab) => {
        const name = lab.querySelector('.new-chat-user-name')?.textContent || '';
        (lab as HTMLElement).style.display = name.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = (cb as HTMLInputElement).dataset.id;
        if (!id) return;
        if ((cb as HTMLInputElement).checked) selected.add(id);
        else selected.delete(id);
        refreshBtn();
      });
    });

    createBtn.addEventListener('click', async () => {
      const title = titleInp.value.trim();
      if (!title || selected.size < 1) return;
      try {
        createBtn.disabled = true;
        createBtn.textContent = 'Creating…';
        const resp = await createGroupConversation(title, [...selected]);
        const conId = resp.conversationId;
        if (!conId) throw new Error('No conversation id');
        closeNewChatOverlay();
        await hydrateConversationCardFromApi(String(conId), {
          conID: String(conId),
          name: title,
        });
        // force type group on memory row
        try {
          const ix = (conves || []).findIndex(
            (c: any) => String(c?.conID) === String(conId),
          );
          if (ix >= 0) (conves as any)[ix].type = 'g';
        } catch {}
        if (pageL === 0) await hel();
        openChatPage(
          String(conId),
          title,
          '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg',
          chatManager,
          currentUserId,
          undefined,
          typeof presenceUI !== 'undefined' ? presenceUI : undefined,
        );
      } catch (err: any) {
        void appDialog.alert(err?.message || 'Failed to create group');
        createBtn.disabled = false;
        createBtn.textContent = 'Create group';
      }
    });
  }

  a.addEventListener('click', () => {
    showNewChatMenu();
  });


function escapeHtml(text:any) {
  const map :any= { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

function createMessageElement(msg:any, currentUserId:any) {
  const isMine = msg.senderId === currentUserId;
  const div = document.createElement('div');
  div.className = `message ${isMine ? 'Ma' : 'Mb'}`;
  div.dataset.messageId = msg.messageId;

  const time = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  div.innerHTML = `
    <div class="msg-body">
      <p class="msg-text">${escapeHtml(msg.content || '')}</p>
      <span class="msg-time">${time}</span>
    </div>
  `;
  return div;
}

function scrollToBottom(el:any) {
  el.scrollTop = el.scrollHeight;
}

function setupPresence(socket:any, currentUserId:any) {
  if (!socket) {
    return {
      getPresence: async () => null,
      getManyPresences: async () => [],
      joinChatPresence: async () => null,
      leaveChatPresence: () => undefined,
      destroy: () => undefined,
    };
  }
  // Heartbeat every 20s (TTL is 45s)
  const heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('presence:heartbeat');
    }
  }, 20_000);

  // Listen for global presence changes
  socket.on('presence:update', (data:any) => {
    // data = { userId, status: 'online'|'offline', lastSeen }
    window.dispatchEvent(
      new CustomEvent('presence:update', { detail: data }),
    );
  });

  // Listen for conversation online list
  socket.on('presence:chat', (data:any) => {
    // data = { conversationId, onlineUserIds: string[] }
    window.dispatchEvent(
      new CustomEvent('presence:chat', { detail: data }),
    );
  });

  function getPresence(userId:any) {
    return new Promise((resolve) => {
      socket.emit('presence:get', { userId }, (res:any) => {
        resolve(res?.success ? res.presence : null);
      });
    });
  }

  function getManyPresences(userIds:any) {
    return new Promise((resolve) => {
      socket.emit('presence:getMany', { userIds }, (res:any) => {
        resolve(res?.success ? res.presences : []);
      });
    });
  }

  function joinChatPresence(conversationId:any) {
    if (!socket?.connected) return Promise.resolve(null);
    return new Promise((resolve) => {
      socket.emit('presence:joinChat', { conversationId }, (res:any) => {
        resolve(res);
      });
    });
  }

  function leaveChatPresence(conversationId:any) {
    if (socket?.connected) socket.emit('presence:leaveChat', { conversationId });
  }

  function destroy() {
    clearInterval(heartbeatInterval);
  }

  return {
    getPresence,
    getManyPresences,
    joinChatPresence,
    leaveChatPresence,
    destroy,
  };
}

function formatLastSeen(ts: any) {
  if (!ts || ts === 0) return 'Last seen unknown';
  const now = Date.now();
  const diff = now - Number(ts);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return Math.floor(diff / minute) + ' min ago';
  if (diff < day) return Math.floor(diff / hour) + ' hours ago';
  const date = new Date(Number(ts));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) {
    return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function getStatusText(presence: any, isTyping: boolean) {
  if (isTyping) return 'typing...';
  if (!presence) return '';
  if (presence.status === 'online') return 'online';
  return formatLastSeen(presence.lastSeen);
}

function findConversationCards(userId: any) {
  const cards = document.querySelectorAll('main .conv');
  const result: HTMLElement[] = [];
  cards.forEach((card: any) => {
    if (card._peerUserId === userId) result.push(card);
  });
  return result;
}

function ensurePresenceDot(card: HTMLElement) {
  let dot = card.querySelector('.presence-dot') as HTMLElement | null;
  if (dot) return dot;
  const img = card.querySelector('img');
  if (!img) return null;
  let wrap = img.parentElement as HTMLElement;
  if (!wrap || wrap === card) {
    wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';
    img.replaceWith(wrap);
    wrap.appendChild(img);
  } else {
    wrap.style.position = 'relative';
  }
  dot = document.createElement('span');
  dot.className = 'presence-dot offline';
  wrap.appendChild(dot);
  return dot;
}

function updateConversationCard(userId: any, presence: any) {
  findConversationCards(userId).forEach((card) => {
    const dot = ensurePresenceDot(card);
    if (!dot) return;
    if (presence && presence.status === 'online') {
      dot.classList.add('online');
      dot.classList.remove('offline');
      dot.title = 'online';
    } else {
      dot.classList.remove('online');
      dot.classList.add('offline');
      dot.title = presence ? formatLastSeen(presence.lastSeen) : 'offline';
    }
  });
}

function updateChatHeaderStatus(text: string) {
  const el = document.querySelector('#chatPage #contentStatus');
  if (el) el.textContent = text || '';
}

function initPresenceUI({ socket, currentUserId }: { socket: any; currentUserId: any }) {
  const presenceApi = setupPresence(socket, currentUserId);
  const cache = new Map<string, any>();

  function setCache(p: any) {
    if (p && p.userId) cache.set(p.userId, p);
  }

  window.addEventListener('presence:update', ((e: CustomEvent) => {
    const data = e.detail;
    if (!data || !data.userId) return;
    const prev = cache.get(data.userId) || {};
    const next = {
      userId: data.userId,
      status: data.status,
      lastSeen: data.lastSeen ?? prev.lastSeen ?? Date.now(),
      socketIds: prev.socketIds || [],
    };
    setCache(next);
    updateConversationCard(data.userId, next);

    const page: any = document.querySelector('#chatPage');
    const openPeerId = page?._peerUserId;
    if (openPeerId && openPeerId === data.userId) {
      const statusEl = document.querySelector('#contentStatus') as HTMLElement | null;
      const isTyping = statusEl?.textContent === 'typing...' || statusEl?.textContent === 'typing...';
      updateChatHeaderStatus(getStatusText(next, !!isTyping));
    }
  }) as EventListener);

  async function refreshListPresence(peerUserIds: any[]) {
    const ids = [...new Set((peerUserIds || []).filter(Boolean))];
    if (!ids.length) return;
    const list = await presenceApi.getManyPresences(ids);
    (list as any[]).forEach(setCache);
    (list as any[]).forEach((p) => {
      if (p && p.userId) updateConversationCard(p.userId, p);
    });
  }

  function bindCardPeer(cardEl: any, peerUserId: any) {
    if (cardEl && peerUserId) cardEl._peerUserId = peerUserId;
  }

  async function onOpenChat(conversationId: any, peerUserId: any) {
    const page: any = document.querySelector('#chatPage');
    if (page) {
      page._peerUserId = peerUserId || null;
      page._conversationId = conversationId || null;
    }
    if (conversationId) await presenceApi.joinChatPresence(conversationId);

    let presence = peerUserId ? cache.get(peerUserId) : null;
    if (!presence && peerUserId) {
      presence = await presenceApi.getPresence(peerUserId);
      if (presence) setCache(presence);
    }
    updateChatHeaderStatus(getStatusText(presence, false));
    if (peerUserId) updateConversationCard(peerUserId, presence);
  }

  function onCloseChat(conversationId: any) {
      if (!socket?.connected) return;

    const page: any = document.querySelector('#chatPage');
    const id = conversationId || page?._conversationId;
    if (id) presenceApi.leaveChatPresence(id);
    if (page) {
      page._peerUserId = null;
      page._conversationId = null;
    }
  }

  function onPeerTyping(peerUserId: any, isTyping: boolean) {
    const presence = cache.get(peerUserId);
    updateChatHeaderStatus(getStatusText(presence, isTyping));
  }

  return {
    presenceApi,
    refreshListPresence,
    bindCardPeer,
    onOpenChat,
    onCloseChat,
    onPeerTyping,
    formatLastSeen,
    getStatusText,
    updateConversationCard,
    cache,
  };
}

function createChatManager(socket:any, currentUserId:any) {
  const messagesCache = new Map();
  let currentConversationId :any= null;
  let listenersReady :any= false;
  let onMessageReceived :any= null;
  let onTypingUpdate :any= null;
  let typingTimeout :any= null;

  function setupListeners() {
    if (listenersReady) return;
    listenersReady = true;

    
    socket.on('conversation:refresh', (data: any) => {
      // List truth is updated on message:new via card patch.
      // Full reload only if no card exists for this conversation (new chat edge case).
      try {
        const conId = data?.conversationId ? String(data.conversationId) : '';
        let hasCard = false;
        if (conId) {
          document.querySelectorAll('main > .conv').forEach((el) => {
            if (String((el as any)._conversationId) === conId) hasCard = true;
          });
        }
        if (!hasCard && typeof (window as any).__reloadConversationList === 'function') {
          (window as any).__reloadConversationList(data);
        }
      } catch (e) {
      }
    });

    
    socket.on('conversation:card', (data: any) => {
      try {
        const msg = {
          conversationId: data.conversationId,
          messageId: data.messageId,
          senderId: data.senderId,
          content: data.content ?? data.preview,
          type: data.type || 'text',
          createdAt: data.createdAt,
        };
        const fn =
          typeof updateConversationCardFromMessage === 'function'
            ? updateConversationCardFromMessage
            : (window as any).__updateConvCard;
        const openId =
          (window as any).__currentConversationId ||
          currentConversationId ||
          null;
        const uid =
          (window as any).__currentUserId ||
          currentUserId ||
          '';
        fn?.(msg, uid, openId);
      } catch (e) {
      }
    });

    socket.on('message:new', (msg:any) => {
      if (!msg) return;

      const list = messagesCache.get(msg.conversationId) || [];
      if (msg.messageId && !list.some((m:any) => m.messageId === msg.messageId)) {
        list.push(msg);
        messagesCache.set(msg.conversationId, list);
      }

      // Open chat bubble
      if (
        currentConversationId === msg.conversationId &&
        onMessageReceived &&
        document.getElementById('chatPage')
      ) {
        onMessageReceived(msg);
      }

      // Home list card: use conversationId + text from this emit (no full list reload)
      try {
        const fn =
          typeof updateConversationCardFromMessage === 'function'
            ? updateConversationCardFromMessage
            : (window as any).__updateConvCard;
        const pageOpen = !!document.getElementById('chatPage');
        const openId = pageOpen
          ? currentConversationId ||
            (window as any).__currentConversationId ||
            null
          : null;
        const uid =
          currentUserId ||
          (window as any).__currentUserId ||
          '';
        fn?.(msg, uid, openId);
      } catch (e) {
      }

      if (msg.senderId !== currentUserId) {
        socket.emit('message:delivered', {
          messageId: msg.messageId,
          conversationId: msg.conversationId,
        });
      }
    });

    socket.on('typing:update', (data:any) => {
      if (
        data.conversationId === currentConversationId &&
        onTypingUpdate
      ) {
        onTypingUpdate(data);
      }
    });

    function applyReceiptTicks(messageId: string, status: string) {
      const el = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
      if (!el || !el.classList.contains('Ma')) return;
      el.dataset.receiptStatus = status;
      let tick = el.querySelector('.msg-ticks') as HTMLElement | null;
      if (!tick) {
        tick = document.createElement('span');
        tick.className = 'msg-ticks';
        const meta = el.querySelector('span') || el;
        meta.appendChild(tick);
      }
      if (status === 'read') { tick.innerHTML = '<i class="fa-solid fa-check-double"></i>'; tick.style.color = '#3b82f6'; }
      else if (status === 'delivered') { tick.innerHTML = '<i class="fa-solid fa-check-double"></i>'; tick.style.color = '#9ca3af'; }
      else { tick.innerHTML = '<i class="fa-solid fa-check"></i>'; tick.style.color = '#9ca3af'; }
    }
    socket.on('message:receipt', (data: any) => {
      if (!data?.messageId) return;
      applyReceiptTicks(data.messageId, data.status || (data.readAt ? 'read' : 'delivered'));
    });
    socket.on('message:receipt:bulk', (data: any) => {
      if (!data?.messageIds?.length) return;
      for (const id of data.messageIds) applyReceiptTicks(id, data.status || 'read');
    });
  }

  async function joinConversation(conversationId:any) {
    if (!conversationId) return;
    if (!socket) {
      currentConversationId = conversationId;
      return { success: true, offline: true };
    }

    if (currentConversationId && currentConversationId !== conversationId) {
      stopTyping(currentConversationId);
      if (socket?.connected) socket.emit('message:leave', {
        conversationId: currentConversationId,
      });
    }

    currentConversationId = conversationId;

    return new Promise((resolve) => {
      socket.emit('message:join', { conversationId }, (res:any) => {
        resolve(res);
      });
    });
  }

  /**
   * Cursor pagination
   * cursor = messageId (from previous response nextCursor)
   */
  async function loadMessages(conversationId:any, limit = 50, cursor = null) {
    if (await detectOfflineNow()) {
      const cached = await loadMessagesOffline(String(conversationId));
      messagesCache.set(conversationId, cached.messages || []);
      return cached;
    }

    try {
      const refreshed = await refresh();
      const token = refreshed.res.accessToken;

      let url = `/messages/${conversationId}?limit=${limit}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load messages');

      const data = await res.json();
      // data = { messages, nextCursor, hasMore }

      const prev = messagesCache.get(conversationId) || [];
      const merged = cursor
        ? [...(data.messages || []), ...prev]
        : data.messages || [];

      messagesCache.set(conversationId, merged);

      if (!cursor) {
        await saveMessagesToCache(String(conversationId), data.messages || [], {
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
        });
      }

      return data;
    } catch (err) {
      // store local var removed — use pure cache helper
      const cached = await loadMessagesOffline(String(conversationId));
      if (cached.messages?.length) {
        messagesCache.set(conversationId, cached.messages);
        return cached;
      }
      throw err;
    }
  }

  function sendMessage(
    conversationId:any,
    content:any,
    replyToMessageId?: string,
    type: 'text' | 'image' | 'file' | 'audio' | 'video' = 'text',
  ) {
    if (!content || !String(content).trim()) return Promise.resolve(null);

    stopTyping(conversationId);

    const text = String(content).trim();
    const clientMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const payload: any = {
      conversationId,
      content: text,
      clientMessageId,
      type: type || 'text',
    };
    if (replyToMessageId) payload.replyToMessageId = replyToMessageId;

    // Queue only when truly offline (network/API), not merely socket still connecting
    // Outbox only when browser offline or last probe said unreachable — NOT when socket still connecting
    const reallyOffline =
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      (window as any).__lastOffline === true;
    if (reallyOffline) {
      try {
        if (typeof (window as any).__persistTokensForOffline === 'function') {
          (window as any).__persistTokensForOffline();
        }
      } catch { /* */ }
      enqueueOutbox({
        conversationId,
        content: text,
        clientMessageId,
        type: type || 'text',
        replyToMessageId: replyToMessageId || undefined,
        createdAt: new Date().toISOString(),
      });
      const optimistic = {
        messageId: `local-${clientMessageId}`,
        clientMessageId,
        conversationId,
        content: text,
        type: type || 'text',
        senderId: currentUserId,
        createdAt: new Date().toISOString(),
        pending: true,
        receiptStatus: 'pending',
        replyToMessageId: replyToMessageId || undefined,
      };
      const list = messagesCache.get(conversationId) || [];
      list.push(optimistic);
      messagesCache.set(conversationId, list);
      return Promise.resolve(optimistic);
    }

    if (!socket) {
      enqueueOutbox({
        conversationId,
        content: text,
        clientMessageId,
        type: type || 'text',
        replyToMessageId: replyToMessageId || undefined,
        createdAt: new Date().toISOString(),
      });
      return Promise.resolve({
        messageId: `local-${clientMessageId}`,
        clientMessageId,
        conversationId,
        content: text,
        type: type || 'text',
        senderId: currentUserId,
        pending: true,
      });
    }

    return new Promise((resolve) => {
      socket.emit(
        'message:send',
        payload,
        (res:any) => {
          if (res && res.success) {
            const list = messagesCache.get(conversationId) || [];
            if (res.message && !list.some((m: any) => m.messageId === res.message.messageId)) {
              list.push(res.message);
              messagesCache.set(conversationId, list);
            }
            resolve(res.message);
          } else {
            // Network ack failed → keep in outbox for retry
            enqueueOutbox({
              conversationId,
              content: text,
              clientMessageId,
              type: type || 'text',
              replyToMessageId: replyToMessageId || undefined,
              createdAt: new Date().toISOString(),
            });
            void appDialog.alert(res?.error || 'Send failed — queued for retry');
            resolve({
              messageId: `local-${clientMessageId}`,
              clientMessageId,
              conversationId,
              content: text,
              type: type || 'text',
              senderId: currentUserId,
              pending: true,
              receiptStatus: 'pending',
            });
          }
        },
      );
    });
  }

  function editMessage(messageId: string, content: string) {
    return new Promise((resolve) => {
      socket.emit(
        'message:edit',
        { messageId, content: String(content).trim() },
        (res: any) => {
          if (res && res.success) {
            try {
              const fn = (window as any).__updateConvCard;
              const uid =
                currentUserId ||
                (window as any).__currentUserId ||
                '';
              const openId =
                currentConversationId ||
                (window as any).__currentConversationId ||
                null;
              if (typeof fn === 'function' && res.message) {
                fn(res.message, uid, openId);
              }
            } catch {}
            resolve(res.message);
          }
          else {
            void appDialog.alert(res?.error || 'Edit failed');
            resolve(null);
          }
        },
      );
    });
  }

  function deleteMessage(messageId: string) {
    return new Promise((resolve) => {
      socket.emit(
        'message:delete',
        { messageId },
        (res: any) => {
          if (res && res.success) {
            try {
              const fn = (window as any).__updateConvCard;
              const uid =
                currentUserId ||
                (window as any).__currentUserId ||
                '';
              const openId =
                currentConversationId ||
                (window as any).__currentConversationId ||
                null;
              if (typeof fn === 'function' && res.message) {
                fn(res.message, uid, openId);
              }
            } catch {}
            resolve(res.message);
          }
          else {
            void appDialog.alert(res?.error || 'Delete failed');
            resolve(null);
          }
        },
      );
    });
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    // Access token: refresh() returns accessToken for REST
    const auth = await refresh();
    const token = auth?.res?.accessToken;
    const res = await fetch('/messages/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.file?.url) {
      throw new Error(data.message || data.error || 'Upload failed');
    }
    return data.file as {
      url: string;
      type: 'image' | 'audio' | 'video' | 'file';
      originalName?: string;
      mimeType?: string;
      size?: number;
    };
  }

  async function sendMedia(conversationId: string, file: File, replyToMessageId?: string) {
    const uploaded = await uploadFile(file);
    return sendMessage(
      conversationId,
      uploaded.url,
      replyToMessageId,
      uploaded.type,
    );
  }

  function startTyping(conversationId:any) {
    if (!conversationId) return;
    if (!socket?.connected) return;
    socket.emit('typing:start', { conversationId });

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      stopTyping(conversationId);
    }, 3000);
  }

  function stopTyping(conversationId:any) {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    if (conversationId && socket?.connected) {
      socket.emit('typing:stop', { conversationId });
    }
  }

  function leaveConversation(conversationId?: any) {
    const id = conversationId || currentConversationId;
    try {
      if (id) stopTyping(id);
    } catch {}
    try {
      if (id && socket?.connected) {
        socket.emit('message:leave', { conversationId: id });
      }
    } catch {}
    if (!conversationId || String(conversationId) === String(currentConversationId)) {
      currentConversationId = null;
    }
    onMessageReceived = null;
    onTypingUpdate = null;
  }

  function setOnMessageReceived(fn:any)
 {
    onMessageReceived = fn;
  }

  function setOnTypingUpdate(fn:any) {
    onTypingUpdate = fn;
  }

  return {
    setupListeners,
    joinConversation,
    leaveConversation,
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    uploadFile,
    sendMedia,
    startTyping,
    stopTyping,
    setOnMessageReceived,
    setOnTypingUpdate,
    get currentConversationId() {
      return currentConversationId;
    },
  };
}


function ensureMsgContextStyles() {
  if (document.getElementById('msg-context-menu-style')) return;
  const link = document.createElement('link');
  link.id = 'msg-context-menu-style';
  link.rel = 'stylesheet';
  link.href = '/assets/script/message-context-menu.css';
  // fallback inline if css file not deployed
  const style = document.createElement('style');
  style.id = 'msg-context-menu-style';
  style.textContent = `
  .msg-context-menu{position:fixed;z-index:9999;min-width:160px;flex-direction:column;gap:2px;padding:6px;border-radius:12px;background:#1f1f2b;border:1px solid #333;box-shadow:0 8px 24px rgba(0,0,0,.35)}
  .msg-context-menu button{display:block;width:100%;text-align:left;border:none;background:transparent;color:#f3f4f6;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:14px}
  .msg-context-menu button:hover{background:#2d2d3d}
  .msg-body{max-width:100%;min-width:0}
  .msg-text{margin:0;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}
  .message{max-width:85%;min-width:0;box-sizing:border-box}
  .message > div,.message .msg-body{max-width:100%;min-width:0;overflow-wrap:anywhere}

  .msg-context-menu .ctx-danger{color:#f87171}
  .reply-bar{display:none;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#1a1a24;border-top:1px solid #2a2a3a}
  .reply-bar-label{font-size:12px;color:#a78bfa;font-weight:600}
  .reply-bar-preview{font-size:13px;color:#d1d5db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70vw}
  .reply-bar-close{border:none;background:transparent;color:#9ca3af;font-size:20px;cursor:pointer}
  .msg-reply-preview{font-size:12px;color:#c4b5fd;border-left:2px solid #8b5cf6;padding-left:8px;margin-bottom:4px}
  .msg-edited{color:#9ca3af;font-size:11px}
  .chat-icon-btn{border:none;background:transparent;color:#a78bfa;cursor:pointer;font-size:1.2rem;padding:0 6px;line-height:1}
  .msg-image{max-width:220px;border-radius:10px;display:block;margin:4px 0;cursor:zoom-in}
  .msg-audio{max-width:240px;margin:4px 0;width:100%}
  .msg-video{max-width:240px;border-radius:10px;margin:4px 0;display:block;background:#000}
  .msg-file{color:#c4b5fd;display:inline-block;margin:4px 0}
  #chatPage{position:relative}
  /* Voice bar: overlays above footer — does not reflow chat grid */
  .voice-record-bar{
    display:none;
    position:absolute;
    left:10px;
    right:10px;
    bottom:58px;
    z-index:6;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:14px;
    background:#161b22;
    border:1px solid rgba(97,50,219,.35);
    box-shadow:0 8px 24px rgba(0,0,0,.35);
    color:#f5f7fa;
    font-size:13px;
    box-sizing:border-box;
    pointer-events:auto;
  }
  .voice-record-bar[style*="flex"]{display:flex !important}
  .voice-record-dot{
    width:8px;height:8px;border-radius:50%;
    background:#ef4444;flex-shrink:0;
    box-shadow:0 0 0 0 rgba(239,68,68,.5);
    animation:voicePulse 1.2s ease-out infinite;
  }
  @keyframes voicePulse{
    0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}
    70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}
    100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}
  }
  .voice-record-timer{font-variant-numeric:tabular-nums;font-weight:600;color:#a78bfa;min-width:2.5rem}
  .voice-record-hint{flex:1;min-width:0;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .voice-cancel-btn{
    margin-inline-start:auto;border:none;
    background:#1f2633;color:#f5f7fa;
    border-radius:10px;padding:6px 12px;cursor:pointer;font-weight:600;font-size:12px
  }
  .voice-cancel-btn:active{opacity:.85}
  .media-lightbox{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;padding:16px}
  .media-lightbox img{max-width:95vw;max-height:90vh;border-radius:8px}
  .lightbox-close{position:absolute;top:12px;right:16px;border:none;background:transparent;color:#fff;font-size:32px;cursor:pointer}
  `;
  document.head.appendChild(style);
}


function closePeerProfile() {
  document.getElementById('peerProfileOverlay')?.remove();
  try {
    // If we had pushed overlay state, normalize without exiting app
    history.replaceState(
      { app: 'trap' },
      '',
      location.pathname + location.search,
    );
    (window as any).__armNavTrap?.();
  } catch {}
}

/** Simple peer / group profile sheet */
function showPeerProfile(opts: {
  name?: string;
  userId?: string | null;
  conversationId?: string;
  imgSrc?: string;
  isGroup?: boolean;
}) {
  closePeerProfile();
  const name = String(opts.name || 'Chat');
  const uid = opts.userId ? String(opts.userId) : '';
  const idShort =
    uid.length > 16 ? uid.slice(0, 8) + '…' + uid.slice(-6) : uid;
  let img = resolveAvatarUrl(opts.imgSrc);
  const isGroup = !!opts.isGroup;
  const overlay = document.createElement('div');
  overlay.id = 'peerProfileOverlay';
  overlay.className = 'peer-profile-overlay';
  overlay.innerHTML = `
    <div class="peer-profile-sheet" role="dialog" aria-label="Profile">
      <button type="button" class="peer-profile-close" aria-label="Close">×</button>
      <img class="peer-profile-avatar" src="${img}" alt="" />
      <h2 class="peer-profile-name">${escapeHtml(name)}</h2>
      ${
        isGroup
          ? `<p class="peer-profile-sub">Group</p>
             <div class="peer-profile-members">
               <p class="peer-profile-members-title">Members</p>
               <div class="peer-profile-members-list" id="peerProfileMembers">
                 <p class="peer-profile-members-loading">Loading…</p>
               </div>
             </div>`
          : uid
            ? `<p class="peer-profile-sub" title="${escapeHtml(uid)}">@${escapeHtml(name)}</p>
               <p class="peer-profile-bio" id="peerProfileBio"></p>
               <p class="peer-profile-id">ID: ${escapeHtml(idShort)}</p>`
            : `<p class="peer-profile-sub">Conversation</p>`
      }
      <div class="peer-profile-actions">
        ${
          !isGroup && uid
            ? `<button type="button" class="peer-profile-btn" data-act="message">Message</button>
               <button type="button" class="peer-profile-btn peer-profile-btn-call" data-act="call">Call</button>`
            : isGroup
              ? `<button type="button" class="peer-profile-btn" data-act="add-member">Add member</button>
                 <button type="button" class="peer-profile-btn" data-act="close">Close</button>`
              : `<button type="button" class="peer-profile-btn" data-act="close">Close</button>`
        }
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePeerProfile();
  });
  overlay.querySelector('.peer-profile-close')?.addEventListener('click', () =>
    closePeerProfile(),
  );
  overlay.querySelector('[data-act="close"]')?.addEventListener('click', () =>
    closePeerProfile(),
  );
  overlay.querySelector('[data-act="message"]')?.addEventListener('click', () => {
    closePeerProfile();
  });
  overlay.querySelector('[data-act="call"]')?.addEventListener('click', () => {
    closePeerProfile();
    if (uid && typeof (window as any).__startCall === 'function') {
      (window as any).__startCall(uid);
    } else if (uid) {
    }
  });
  document.body.appendChild(overlay);
  if (uid && !isGroup) {
    void (async () => {
      try {
        const rows = await fetchAllUsers();
        const peer = rows.find((r: any) => String(r.userId) === uid);
        const bio = String(peer?.bio || peer?.subtitle || '').trim();
        const el = document.getElementById('peerProfileBio');
        if (el) {
          el.textContent = bio || '';
          el.style.display = bio ? '' : 'none';
        }
        if (peer?.profilePic) {
          const av = overlay.querySelector('.peer-profile-avatar') as HTMLImageElement | null;
          if (av) av.src = resolveAvatarUrl(peer.profilePic);
        }
      } catch {}
    })();
  }

  try {
    (window as any).__navPush?.({ app: 'overlay', kind: 'profile' });
  } catch {}

  // Load live avatar/displayName for DM profiles
  if (uid && !opts.isGroup) {
    void (async () => {
      try {
        const token =
          getOnlineAccessToken();
        // Prefer list lookup (includes profilePic)
        const res = await fetch('/users/list', {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || [];
        const hit = items.find((u: any) => String(u.userId) === String(uid));
        if (!hit) return;
        const av = resolveAvatarUrl(hit.profilePic);
        const imgEl = overlay.querySelector(
          '.peer-profile-avatar',
        ) as HTMLImageElement | null;
        if (imgEl && hit.profilePic) imgEl.src = av;
        const nameEl = overlay.querySelector('.peer-profile-name');
        if (nameEl && (hit.displayName || hit.username)) {
          nameEl.textContent = hit.displayName || hit.username;
        }
      } catch {}
    })();
  }

  async function authToken(): Promise<string> {
    try {
      const r = await refresh();
      return r?.res?.accessToken || '';
    } catch {
      return getOnlineAccessToken();
    }
  }

  async function reloadGroupMembers() {
    const box = document.getElementById('peerProfileMembers');
    if (!box || !opts.conversationId) return [] as any[];
    box.innerHTML = `<p class="peer-profile-members-loading">Loading…</p>`;
    try {
      const token = await authToken();
      const res = await fetch('/conversation/members', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId: opts.conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed');
      const members = data.members || data || [];
      if (!Array.isArray(members) || !members.length) {
        box.innerHTML = `<p class="peer-profile-members-loading">No members found</p>`;
        return [];
      }
      box.innerHTML = members
        .map((m: any) => {
          const un =
            m.username ||
            m.userName ||
            m.name ||
            String(m.userId || '').slice(0, 8);
          const role = m.role && m.role !== 'member' ? ` · ${m.role}` : '';
          return `<div class="peer-profile-member">
              <span class="peer-profile-member-name">${escapeHtml(un)}</span>
              <span class="peer-profile-member-role">${escapeHtml(role)}</span>
            </div>`;
        })
        .join('');
      return members;
    } catch (e: any) {
      box.innerHTML = `<p class="peer-profile-members-loading">Could not load members</p>`;
      return [];
    }
  }

  async function openAddMemberPicker(existingIds: Set<string>) {
    let users: any[] = [];
    try {
      if (typeof fetchAllUsers === 'function') {
        users = await fetchAllUsers();
      } else {
        const token = await authToken();
        const res = await fetch('/users/list', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        users = (data.items || []).map((u: any) => ({
          userId: String(u.userId),
          username: String(u.username || u.userId),
        }));
      }
    } catch {
      void appDialog.alert('Could not load users');
      return;
    }
    users = (users || []).filter((u) => u.userId && !existingIds.has(String(u.userId)));
    const sheet = document.createElement('div');
    sheet.className = 'peer-add-member-sheet';
    sheet.innerHTML = `
      <div class="peer-add-member-head">
        <strong>Add member</strong>
        <button type="button" class="peer-profile-close" data-act="cancel-add">×</button>
      </div>
      <input type="search" class="peer-add-member-search" placeholder="Search…" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
      <div class="peer-add-member-list"></div>
    `;
    const listEl = sheet.querySelector('.peer-add-member-list') as HTMLElement;
    const render = (q: string) => {
      const qq = q.trim().toLowerCase();
      const rows = users.filter(
        (u) =>
          u.userId &&
          !existingIds.has(String(u.userId)) &&
          (!qq || String(u.username || '').toLowerCase().includes(qq)),
      );
      listEl.innerHTML = rows.length
        ? rows
            .map(
              (u) =>
                `<button type="button" class="peer-add-member-row" data-id="${escapeHtml(u.userId)}">${escapeHtml(u.username)}</button>`,
            )
            .join('')
        : `<p class="peer-profile-members-loading">No users to add</p>`;
      listEl.querySelectorAll('.peer-add-member-row').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id;
          if (!id || !opts.conversationId) return;
          try {
            (btn as HTMLButtonElement).disabled = true;
            const token = await authToken();
            const res = await fetch('/conversation/participant/add', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                conversationId: opts.conversationId,
                userId: id,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data.message || data.error || 'Add failed');
            }
            // Remove from picker list + member set; keep sheet open for more adds
            existingIds.add(String(id));
            memberIdSet.add(String(id));
            users = users.filter((u) => String(u.userId) !== String(id));
            const searchEl = sheet.querySelector(
              '.peer-add-member-search',
            ) as HTMLInputElement | null;
            render(searchEl?.value || '');
            await reloadGroupMembers();
          } catch (e: any) {
            void appDialog.alert(e?.message || 'Failed to add member');
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });
    };
    render('');
    sheet
      .querySelector('.peer-add-member-search')
      ?.addEventListener('input', (e) => {
        render(String((e.target as HTMLInputElement).value || ''));
      });
    sheet.querySelector('[data-act="cancel-add"]')?.addEventListener('click', () => {
      sheet.remove();
    });
    overlay.querySelector('.peer-profile-sheet')?.appendChild(sheet);
  }

  let memberIdSet = new Set<string>();
  if (isGroup && opts.conversationId) {
    void reloadGroupMembers().then((members) => {
      memberIdSet = new Set(
        (members || []).map((m: any) => String(m.userId || '')).filter(Boolean),
      );
    });
  }

  overlay.querySelector('[data-act="add-member"]')?.addEventListener('click', () => {
    void openAddMemberPicker(memberIdSet);
  });
}


function formatMediaTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/** Custom audio / video controls inside a message bubble */
function bindMediaPlayers(root: ParentNode) {
  root.querySelectorAll('.msg-media-audio').forEach((wrap) => {
    if ((wrap as any)._bound) return;
    (wrap as any)._bound = true;
    const audio = wrap.querySelector('.msg-audio-el') as HTMLAudioElement | null;
    const btn = wrap.querySelector('.audio-play-btn') as HTMLButtonElement | null;
    const bar = wrap.querySelector('.audio-progress-bar') as HTMLElement | null;
    const timeEl = wrap.querySelector('.audio-time') as HTMLElement | null;
    if (!audio || !btn) return;
    btn.addEventListener('click', () => {
      if (audio.paused) {
        document.querySelectorAll('audio.msg-audio-el').forEach((a) => {
          if (a !== audio) {
            try {
              (a as HTMLAudioElement).pause();
            } catch {}
          }
        });
        void audio.play();
      } else audio.pause();
    });
    audio.addEventListener('play', () => {
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      wrap.classList.add('is-playing');
    });
    audio.addEventListener('pause', () => {
      btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      wrap.classList.remove('is-playing');
    });
    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      if (bar) bar.style.width = pct + '%';
      if (timeEl)
        timeEl.textContent =
          formatMediaTime(audio.currentTime) +
          (audio.duration ? ' / ' + formatMediaTime(audio.duration) : '');
    });
    wrap.querySelector('.audio-progress')?.addEventListener('click', (e:any) => {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      if (audio.duration) audio.currentTime = ratio * audio.duration;
    });
  });

  root.querySelectorAll('.msg-media-video').forEach((wrap) => {
    if ((wrap as any)._bound) return;
    (wrap as any)._bound = true;
    const video = wrap.querySelector('video') as HTMLVideoElement | null;
    const overlay = wrap.querySelector('.video-play-overlay') as HTMLElement | null;
    const ctrlPlay = wrap.querySelector('.video-ctrl-play') as HTMLElement | null;
    const bar = wrap.querySelector('.video-progress-bar') as HTMLElement | null;
    const timeEl = wrap.querySelector('.video-time') as HTMLElement | null;
    if (!video) return;
    const setPlayIcon = (playing: boolean) => {
      const html = playing
        ? '<i class="fa-solid fa-pause"></i>'
        : '<i class="fa-solid fa-play"></i>';
      if (overlay) overlay.innerHTML = html;
      if (ctrlPlay) ctrlPlay.innerHTML = html;
    };
    const toggle = () => {
      if (video.paused) void video.play();
      else video.pause();
    };
    overlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    ctrlPlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    video.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    video.addEventListener('play', () => {
      wrap.classList.add('is-playing');
      if (overlay) overlay.style.display = 'none';
      setPlayIcon(true);
    });
    video.addEventListener('pause', () => {
      wrap.classList.remove('is-playing');
      if (overlay) overlay.style.display = '';
      setPlayIcon(false);
    });
    video.addEventListener('timeupdate', () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      if (bar) bar.style.width = pct + '%';
      if (timeEl) {
        timeEl.textContent =
          formatMediaTime(video.currentTime) +
          (video.duration ? ' / ' + formatMediaTime(video.duration) : '');
      }
    });
    wrap.querySelector('.video-progress')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, ((e as MouseEvent).clientX - rect.left) / rect.width),
      );
      if (video.duration) video.currentTime = ratio * video.duration;
    });
  });

  root.querySelectorAll('.msg-image').forEach((img) => {
    if ((img as any)._bound) return;
    (img as any)._bound = true;
    img.addEventListener('click', () => {
      const full = (img as HTMLElement).getAttribute('data-fullsrc') || (img as HTMLImageElement).src;
      const lb = document.getElementById('mediaLightbox') as HTMLElement | null;
      const lbImg = document.getElementById('lightboxImg') as HTMLImageElement | null;
      if (lb && lbImg) {
        lbImg.src = full;
        lb.style.display = 'flex';
      }
    });
  });
}

async function openChatPage(

  conversationId:any,
  peerName:any,
  peerAvatar:any,
  chatManager:any,
  currentUserId:any,
  peerUserId?:any,
  presenceUI?:any,
) {
  peerAvatar = resolveAvatarUrl(peerAvatar);
  try { document.body.classList.add('chat-open'); } catch {}
  try {
    (window as any).__currentConversationId = String(conversationId || '');
  } catch {}
  try {
    (window as any).__currentPeerAvatar = peerAvatar;
  } catch {}
  try {
    (window as any).__clearConvUnread?.(String(conversationId));
  } catch {}

  const $ = document;
  ensureMsgContextStyles();
  const container = $.querySelector('main');
  if (!container) return;

  container.querySelectorAll('#chatPage').forEach((el) => el.remove());

  const page = $.createElement('div');
  page.id = 'chatPage';
  page.innerHTML = `
    <div id="chatHeader">
      <div class="conone">
        <i class="fa-solid fa-arrow-left" id="backBtn"></i>
        <img src="${resolveAvatarUrl(peerAvatar)}" alt="" id="chatPeerAvatar">
      </div>
      <div class="contentData">
        <span id="contentName">${peerName || ''}</span>
        <span id="contentStatus">Online</span>
      </div>
      <div id="buttnCoun">
        <button type="button" id="callBtn" title="Voice call"><span><i class="fa-light fa-phone"></i></span></button>
        <button type="button" id="endCallBtn" title="End call" style="display:none"><span><i class="fa-solid fa-stop"></i></span></button>
        <button type="button"><span><i class="fa-light fa-camera"></i></span></button>
      </div>
    </div>
    <div id="chatMain">
      <div class="chatMainCon" id="messagesContainer"></div>
    </div>
    <div id="replyBar" class="reply-bar" style="display:none;">
      <div class="reply-bar-body">
        <span class="reply-bar-label">Reply</span>
        <span id="replyBarPreview" class="reply-bar-preview"></span>
      </div>
      <button type="button" id="replyBarClose" class="reply-bar-close" aria-label="Cancel reply">×</button>
    </div>
    <div id="voiceRecordBar" class="voice-record-bar" style="display:none;" aria-live="polite">
      <span class="voice-record-dot" aria-hidden="true"></span>
      <span id="voiceRecordTimer" class="voice-record-timer">0:00</span>
      <span class="voice-record-hint">Recording… release to send</span>
      <button type="button" id="voiceCancelBtn" class="voice-cancel-btn">Cancel</button>
    </div>
    <div id="chatfooter">
      <button type="button" id="attachBtn" title="Attach file" class="chat-icon-btn">+</button>
      <button type="button" id="micBtn" title="Hold to record voice" class="chat-icon-btn"><i class="fa-solid fa-microphone"></i></button>
      <input id="fileInput" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.zip,.txt" style="display:none" autocomplete="off" />
      <input id="chatInp" type="text" placeholder="Type a message..." autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
      <button id="sendButton">
        <i class="fa-regular fa-paper-plane" style="font-size:1.3rem;"></i>
      </button>
    </div>
    <div id="mediaLightbox" class="media-lightbox" style="display:none;">
      <button type="button" id="lightboxClose" class="lightbox-close">×</button>
      <img id="lightboxImg" alt="preview" />
    </div>
    <div id="msgContextMenu" class="msg-context-menu" style="display:none;" role="menu">
      <button type="button" data-action="reply">Reply</button>
      <button type="button" data-action="copy">Copy</button>
      <button type="button" data-action="edit" class="ctx-own-only">Edit</button>
      <button type="button" data-action="delete" class="ctx-own-only ctx-danger">Delete</button>
    </div>
  `;

  container.appendChild(page);
  try {
    (page as any)._peerAvatar = peerAvatar;
    const avImg = page.querySelector('#chatPeerAvatar') as HTMLImageElement | null;
    if (avImg) avImg.src = resolveAvatarUrl(peerAvatar);
  } catch {}
  // Refresh avatar from users list when we have peerUserId
  if (peerUserId) {
    void (async () => {
      try {
        const token =
          getOnlineAccessToken();
        const res = await fetch('/users/list', {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const hit = (data.items || []).find(
          (u: any) => String(u.userId) === String(peerUserId),
        );
        if (!hit?.profilePic) return;
        const url = resolveAvatarUrl(hit.profilePic);
        peerAvatar = url;
        (page as any)._peerAvatar = url;
        (window as any).__currentPeerAvatar = url;
        const avImg = page.querySelector('#chatPeerAvatar') as HTMLImageElement | null;
        if (avImg) avImg.src = url;
      } catch {}
    })();
  }
  try {
    history.pushState(
      { app: 'chat', conversationId: String(conversationId || '') },
      '',
      location.pathname + location.search,
    );
  } catch {}
  // Open peer/group profile from header
  try {
    const head = page.querySelector('#chatheader .content, #chatheader');
    const nameEl = page.querySelector('#contentName, #chatheader h4, #chatheader .name');
    const clickTarget = nameEl || head;
    clickTarget?.addEventListener('click', (e) => {
      e.stopPropagation();
      showPeerProfile({
        name: peerName,
        userId: peerUserId || null,
        conversationId,
        imgSrc:
          (page as any)._peerAvatar ||
          peerAvatar ||
          (window as any).__currentPeerAvatar,
        isGroup: !peerUserId,
      });
    });
    if (clickTarget) (clickTarget as HTMLElement).style.cursor = 'pointer';
  } catch {}
  if (presenceUI) {
    await presenceUI.onOpenChat(conversationId, peerUserId);
  }

  // Zero local unread as soon as chat is opened
  try {
    const clearFn =
      typeof clearConversationUnread === 'function'
        ? clearConversationUnread
        : (window as any).__clearConvUnread;
    clearFn?.(conversationId);
  } catch {}
  const callBtn = page.querySelector('#callBtn') as HTMLButtonElement | null;
  const endCallBtn = page.querySelector('#endCallBtn') as HTMLButtonElement | null;
  callBtn?.addEventListener('click', () => {
    const targetId = peerUserId || (page as any)._peerUserId || '';
    const starter = (window as any).__startCall;
    if (typeof starter === 'function') {
      // Always pass conversationId so server can resolve peer if needed
      starter(String(targetId || ''), String(conversationId || ''));
    } else {
      void appDialog.alert('Call client not ready');
    }
  });
  endCallBtn?.addEventListener('click', () => {
    const ender = (window as any).__endCall;
    if (typeof ender === 'function') ender();
  });
  const messagesContainer = page.querySelector('#messagesContainer') as HTMLElement;
  const typingEl = page.querySelector('#contentStatus') as HTMLElement;
  const input = page.querySelector('#chatInp') as HTMLInputElement;
  const sendBtn = page.querySelector('#sendButton') as HTMLButtonElement;
  const replyBar = page.querySelector('#replyBar') as HTMLElement;
  const replyBarPreview = page.querySelector('#replyBarPreview') as HTMLElement;
  const replyBarClose = page.querySelector('#replyBarClose') as HTMLButtonElement;
  const ctxMenu = page.querySelector('#msgContextMenu') as HTMLElement;

  let replyToMessageId: string | null = null;
  let ctxTargetMsg: any = null;
  let longPressTimer: any = null;

  function setReplyTarget(msg: any) {
    if (!msg || msg.isDeleted || msg.deletedAt || !replyBar) return;
    replyToMessageId = msg.messageId;
    if (replyBarPreview) replyBarPreview.textContent = (msg.content || '').slice(0, 120);
    replyBar.style.display = 'flex';
    input.focus();
  }

  function clearReplyTarget() {
    replyToMessageId = null;
    if (replyBarPreview) replyBarPreview.textContent = '';
    if (replyBar) replyBar.style.display = 'none';
  }

  function hideContextMenu() {
    if (ctxMenu) ctxMenu.style.display = 'none';
    ctxTargetMsg = null;
  }

  function showContextMenu(msgEl: HTMLElement, clientX: number, clientY: number) {
    const msg = (msgEl as any)._msg;
    if (!msg || !ctxMenu) return;
    ctxTargetMsg = msg;
    const isMine = msg.senderId === currentUserId;
    const isDeleted = !!(msg.isDeleted || msg.deletedAt);
    ctxMenu.querySelectorAll('.ctx-own-only').forEach((btn) => {
      (btn as HTMLElement).style.display = isMine && !isDeleted ? '' : 'none';
    });
    const replyBtn = ctxMenu.querySelector('[data-action="reply"]') as HTMLElement;
    if (replyBtn) replyBtn.style.display = isDeleted ? 'none' : '';

    ctxMenu.style.display = 'flex';
    const pad = 8;
    const rect = ctxMenu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    ctxMenu.style.left = left + 'px';
    ctxMenu.style.top = top + 'px';
  }
  if (!replyBar || !ctxMenu) {
  }
  replyBarClose?.addEventListener('click', clearReplyTarget);

  ctxMenu?.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
    if (!btn || !ctxTargetMsg) return;
    const action = btn.dataset.action;
    const msg = ctxTargetMsg;
    hideContextMenu();

    if (action === 'reply') {
      setReplyTarget(msg);
      return;
    }
    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(msg.content || '');
      } catch {
        /* ignore */
      }
      return;
    }
    if (action === 'edit') {
      if (msg.senderId !== currentUserId || msg.type !== 'text') return;
      const next = await appDialog.prompt(
        'Edit your message',
        msg.content || '',
        'Edit message',
      );
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === msg.content) return;
      const updated = await chatManager.editMessage(msg.messageId, trimmed);
      if (updated) {
        const el = messagesContainer.querySelector(
          `[data-message-id="${msg.messageId}"]`,
        ) as HTMLElement | null;
        if (el) {
          (el as any)._msg = { ...msg, ...updated };
          const textEl = el.querySelector('.msg-text');
          if (textEl) textEl.textContent = updated.content;
          let edited = el.querySelector('.msg-edited');
          if (!edited) {
            const meta = el.querySelector('.msg-meta');
            if (meta) {
              edited = document.createElement('small');
              edited.className = 'msg-edited';
              edited.textContent = ' (edited)';
              meta.insertBefore(edited, meta.firstChild);
            }
          }
        }
      }
      return;
    }
    if (action === 'delete') {
      if (msg.senderId !== currentUserId) return;
      if (!(await appDialog.confirm('Delete this message?', 'Delete message', true))) return;
      const updated = await chatManager.deleteMessage(msg.messageId);
      if (updated) {
        const el = messagesContainer.querySelector(
          `[data-message-id="${msg.messageId}"]`,
        ) as HTMLElement | null;
        if (el) {
          (el as any)._msg = { ...msg, ...updated, isDeleted: true };
          const textEl = el.querySelector('.msg-text');
          if (textEl) textEl.textContent = 'This message was deleted';
        }
      }
    }
  });

  messagesContainer.addEventListener('contextmenu', (e) => {
    const msgEl = (e.target as HTMLElement).closest('.message') as HTMLElement | null;
    if (!msgEl || !messagesContainer.contains(msgEl)) return;
    e.preventDefault();
    showContextMenu(msgEl, e.clientX, e.clientY);
  });

  messagesContainer.addEventListener('touchstart', (e) => {
    const msgEl = (e.target as HTMLElement).closest('.message') as HTMLElement | null;
    if (!msgEl) return;
    const touch:any = e.touches[0];
    longPressTimer = setTimeout(() => {
      showContextMenu(msgEl, touch.clientX, touch.clientY);
    }, 500);
  }, { passive: true });

  messagesContainer.addEventListener('touchend', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
  });
  messagesContainer.addEventListener('touchmove', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
  });

  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target as Node)) hideContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });

  // Live update when peers edit/delete
  if (socket) socket.on('message:edited', (message: any) => {
    if (!message?.messageId) return;
    if (message.conversationId && message.conversationId !== conversationId) return;
    const el = messagesContainer.querySelector(
      `[data-message-id="${message.messageId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    const prev = (el as any)._msg || {};
    (el as any)._msg = { ...prev, ...message };
    const textEl = el.querySelector('.msg-text');
    if (textEl) textEl.textContent = message.content;
  });

  if (socket) socket.on('message:deleted', (data: any) => {
    if (!data?.messageId) return;
    if (data.conversationId && data.conversationId !== conversationId) return;
    const el = messagesContainer.querySelector(
      `[data-message-id="${data.messageId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    const prev = (el as any)._msg || {};
    (el as any)._msg = { ...prev, isDeleted: true, deletedAt: data.deletedAt };
    const textEl = el.querySelector('.msg-text');
    if (textEl) textEl.textContent = 'This message was deleted';
  });

  function escapeHtml(text:any) {
    const map :any= {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (c) => map[c]);
  }

  function createMessageElement(msg:any) {
    const isMine = msg.senderId === currentUserId;
    const div = $.createElement('div');
    div.className = `message ${isMine ? 'Ma' : 'Mb'}`;
    div.dataset.messageId = msg.messageId;
    if (msg.clientMessageId) div.dataset.clientId = msg.clientMessageId;
    if (msg.pending) div.classList.add('msg-pending');
    div.dataset.senderId = msg.senderId || '';
    (div as any)._msg = msg;
    const time = msg.createdAt
      ? new Date(msg.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const status = msg.receiptStatus || (isMine ? 'sent' : '');
    const ticks = isMine
      ? (status === 'read'
          ? '<span class="msg-ticks" style="color:#3b82f6"><i class="fa-solid fa-check-double"></i></span>'
          : status === 'delivered'
            ? '<span class="msg-ticks" style="color:#9ca3af"><i class="fa-solid fa-check-double"></i></span>'
            : '<span class="msg-ticks" style="color:#9ca3af"><i class="fa-solid fa-check"></i></span>')
      : '';
    div.dataset.receiptStatus = status || '';
    const replyBlock =
      msg.replyToMessageId && msg.replyPreview
        ? `<div class="msg-reply-preview">${escapeHtml(msg.replyPreview)}</div>`
        : '';
    const edited = msg.editedAt ? ' <small class="msg-edited">(edited)</small>' : '';
    const isDeleted = !!(msg.isDeleted || msg.deletedAt);
    function mediaUrl(path: string) {
      if (!path) return '';
      if (/^https?:\/\//i.test(path) || path.startsWith('blob:')) return path;
      // same-origin relative /uploads/...
      return path.startsWith('/') ? path : '/' + path;
    }
    let mediaHtml = '';
    if (!isDeleted && msg.type && msg.type !== 'text' && msg.content) {
      const src = escapeHtml(mediaUrl(String(msg.content)));
      if (msg.type === 'image') {
        mediaHtml = `<div class="msg-media-wrap msg-media-image">
          <img class="msg-media msg-image" src="${src}" alt="image" loading="lazy" data-fullsrc="${src}" />
        </div>`;
      } else if (msg.type === 'audio') {
        mediaHtml = `<div class="msg-media-wrap msg-media-audio" data-src="${src}">
          <button type="button" class="audio-play-btn" aria-label="Play"><i class="fa-solid fa-play"></i></button>
          <div class="audio-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="audio-meta">
            <div class="audio-progress"><div class="audio-progress-bar"></div></div>
            <span class="audio-time">0:00</span>
          </div>
          <audio class="msg-audio-el" preload="metadata" src="${src}"></audio>
        </div>`;
      } else if (msg.type === 'video') {
        mediaHtml = `<div class="msg-media-wrap msg-media-video" data-src="${src}">
          <video class="msg-media msg-video" preload="metadata" src="${src}" playsinline></video>
          <button type="button" class="video-play-overlay" aria-label="Play"><i class="fa-solid fa-play"></i></button>
          <div class="video-controls">
            <button type="button" class="video-ctrl-play" aria-label="Play"><i class="fa-solid fa-play"></i></button>
            <div class="video-progress"><div class="video-progress-bar"></div></div>
            <span class="video-time">0:00</span>
          </div>
        </div>`;
      } else {
        const name = src.split('/').pop() || 'file';
        mediaHtml = `<a class="msg-media msg-file" href="${src}" target="_blank" rel="noopener">Attachment: ${escapeHtml(name)}</a>`;
      }
    }
    const bodyText = isDeleted
      ? 'This message was deleted'
      : (msg.type === 'text' || !msg.type ? msg.content : '');
    const isGroupChat = !peerUserId;
    const senderLabel =
      !isMine && isGroupChat
        ? escapeHtml(
            msg.senderName ||
              msg.username ||
              ((window as any).__getCachedUsername?.(msg.senderId)) ||
              '',
          )
        : '';
    div.innerHTML = `
      <div class="msg-bubble">
        ${senderLabel ? `<div class="msg-sender">${senderLabel}</div>` : ''}
        ${replyBlock}
        ${mediaHtml}
        ${bodyText ? `<p class="msg-text">${escapeHtml(bodyText)}</p>` : ''}
        <span class="msg-meta">${time}${edited} ${ticks}</span>
      </div>
    `;
    try {
      bindMediaPlayers(div);
    } catch {}
    // Async fill sender name if missing (group)
    if (!isMine && isGroupChat && msg.senderId && !senderLabel) {
      void (window as any).__resolveUsername?.(String(msg.senderId)).then((n: string) => {
        if (!n) return;
        (window as any).__rememberUsername?.(msg.senderId, n);
        const el = div.querySelector('.msg-sender');
        if (el) el.textContent = n;
        else {
          const bubble = div.querySelector('.msg-bubble');
          if (bubble) {
            const s = document.createElement('div');
            s.className = 'msg-sender';
            s.textContent = n;
            bubble.insertBefore(s, bubble.firstChild);
          }
        }
      });
    }
    return div;
  }

  function scrollToBottom(el:any) {
    el.scrollTop = el.scrollHeight;
  }

  const chatOffline = await detectOfflineNow();
  if (typingEl) {
    typingEl.innerHTML = chatOffline ? 'offline' : 'online';
  }

  // ONLINE only: socket listeners + join room
  if (!chatOffline && socket) {
    try {
      chatManager.setupListeners();
      await chatManager.joinConversation(conversationId);
    } catch (e) {
    }
  } else {
  }

  // Load messages + older-message observer (cursor pagination)
  let msgNextCursor: string | null = null;
  let msgHasMore = false;
  let msgLoadingOlder = false;
  let msgScrollObserver: IntersectionObserver | null = null;

  function ensureTopSentinel(): HTMLElement {
    let s = messagesContainer.querySelector('#msgTopSentinel') as HTMLElement | null;
    if (!s) {
      s = document.createElement('div');
      s.id = 'msgTopSentinel';
      s.style.cssText = 'height:1px;width:100%;flex-shrink:0;';
      messagesContainer.insertBefore(s, messagesContainer.firstChild);
    }
    return s;
  }

  async function loadOlderMessages() {
    if (msgLoadingOlder || !msgHasMore || !msgNextCursor || chatOffline) return;
    msgLoadingOlder = true;
    // pause observer so inserting at top does not retrigger
    if (msgScrollObserver) {
      try {
        msgScrollObserver.disconnect();
      } catch {}
    }
    const prevHeight = messagesContainer.scrollHeight;
    const prevTop = messagesContainer.scrollTop;
    try {
      const data = await chatManager.loadMessages(
        conversationId,
        50,
        msgNextCursor,
      );
      const older = data.messages || [];
      msgNextCursor = data.nextCursor || null;
      msgHasMore = !!data.hasMore;
      const sentinel = ensureTopSentinel();
      const frag = document.createDocumentFragment();
      const nodes: HTMLElement[] = [];
      older.forEach((msg: any) => {
        const id = msg?.messageId;
        if (id && messagesContainer.querySelector(`[data-message-id="${id}"]`)) {
          return;
        }
        nodes.push(createMessageElement(msg));
      });
      nodes.forEach((el) => frag.appendChild(el));
      // insert batch after sentinel (oldest→newest order preserved)
      messagesContainer.insertBefore(frag, sentinel.nextSibling);

      // restore scroll after layout (double rAF reduces jump)
      const restore = () => {
        const delta = messagesContainer.scrollHeight - prevHeight;
        messagesContainer.scrollTop = prevTop + delta;
      };
      restore();
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });

      if (!msgHasMore) {
        msgScrollObserver = null;
      } else {
        setupMessageScrollObserver();
      }
    } catch (e) {
      if (msgHasMore) setupMessageScrollObserver();
    } finally {
      msgLoadingOlder = false;
    }
  }

  function setupMessageScrollObserver() {
    if (chatOffline || !msgHasMore) return;
    const sentinel = ensureTopSentinel();
    if (msgScrollObserver) msgScrollObserver.disconnect();
    msgScrollObserver = new IntersectionObserver(
      (entries) => {
        if (msgLoadingOlder) return;
        if (entries.some((e) => e.isIntersecting)) {
          void loadOlderMessages();
        }
      },
      {
        root: messagesContainer,
        // smaller margin = less early fire / less jump stacking
        rootMargin: '24px 0px 0px 0px',
        threshold: 0,
      },
    );
    msgScrollObserver.observe(sentinel);
  }

  try {
    const data = chatOffline
      ? await loadMessagesOffline(String(conversationId))
      : await chatManager.loadMessages(conversationId, 50, null);
    msgNextCursor = data.nextCursor || null;
    msgHasMore = !!data.hasMore;
    (data.messages || []).forEach((msg: any) => {
      messagesContainer.appendChild(createMessageElement(msg));
    });
    scrollToBottom(messagesContainer);
    setupMessageScrollObserver();
    if (!chatOffline && socket?.connected) {
      socket.emit('message:readAll', { conversationId }, (res: any) => {
      });
      try {
        const clearFn =
          typeof clearConversationUnread === 'function'
            ? clearConversationUnread
            : (window as any).__clearConvUnread;
        clearFn?.(conversationId);
      } catch {}
    }
  } catch (err) {
    try {
      const cached = await loadMessagesOffline(String(conversationId));
      (cached.messages || []).forEach((msg: any) => {
        messagesContainer.appendChild(createMessageElement(msg));
      });
      scrollToBottom(messagesContainer);
    } catch (e2) {
    }
  }

  chatManager.setOnMessageReceived((msg: any) => {
    if (msg?.messageId) {
      const exists = messagesContainer.querySelector(
        `[data-message-id="${msg.messageId}"]`,
      );
      if (exists) return;
    }
    messagesContainer.appendChild(createMessageElement(msg));
    scrollToBottom(messagesContainer);
    if (typingEl) typingEl.innerHTML = chatOffline ? 'offline' : 'online';
    if (!chatOffline && socket && msg.senderId !== currentUserId) {
      socket.emit('message:delivered', {
        messageId: msg.messageId,
        conversationId: msg.conversationId || conversationId,
      });
      if ((window as any).__privacy?.readReceipts !== false) {
        socket.emit('message:read', {
          messageId: msg.messageId,
          conversationId: msg.conversationId || conversationId,
        });
      }
      try {
        (window as any).__clearConvUnread?.(conversationId);
      } catch {}
    }
  });

  const typingUserIds = new Set<string>();

  async function refreshTypingStatus() {
    if (!typingEl) return;
    if (typingUserIds.size === 0) {
      typingEl.innerHTML = chatOffline ? 'offline' : 'online';
      return;
    }
    const names: string[] = [];
    for (const uid of typingUserIds) {
      names.push(await ((window as any).__resolveUsername?.(uid) || Promise.resolve(String(uid).slice(0, 6))));
    }
    if (names.length === 1) {
      typingEl.innerHTML = escapeHtml(names[0]) + ' is typing…';
    } else if (names.length === 2) {
      typingEl.innerHTML =
        escapeHtml(names[0]) + ' and ' + escapeHtml(names[1]) + ' are typing…';
    } else {
      typingEl.innerHTML = names.length + ' people are typing…';
    }
  }

  chatManager.setOnTypingUpdate((data: any) => {
    if (!data?.userId || data.userId === currentUserId) return;
    if (data.isTyping) typingUserIds.add(String(data.userId));
    else typingUserIds.delete(String(data.userId));
    void refreshTypingStatus();
    // 1:1 still updates presence header when not group
    if (peerUserId && presenceUI && String(data.userId) === String(peerUserId)) {
      try {
        presenceUI.onPeerTyping(data.userId, data.isTyping);
      } catch {}
    }
  });

  input.addEventListener('input', () => {
    if (input.value.trim()) {
      chatManager.startTyping(conversationId);
    } else {
      chatManager.stopTyping(conversationId);
      typingEl.innerHTML = 'online';
    }
  });

  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chatManager.stopTyping(conversationId);
    const replyId = replyToMessageId || undefined;
    clearReplyTarget();

    const msg = await chatManager.sendMessage(conversationId, text, replyId);
    if (msg) {
      // Append if not already added via message:new
      const exists = messagesContainer.querySelector(
        `[data-message-id="${msg.messageId}"]`,
      );
      if (!exists) {
        messagesContainer.appendChild(createMessageElement(msg));
      }
      scrollToBottom(messagesContainer);
    }
  }

  sendBtn.addEventListener('click', doSend);

  const attachBtn = page.querySelector('#attachBtn') as HTMLButtonElement | null;
  const fileInput = page.querySelector('#fileInput') as HTMLInputElement | null;
  const micBtn = page.querySelector('#micBtn') as HTMLButtonElement | null;
  const voiceBar = page.querySelector('#voiceRecordBar') as HTMLElement | null;
  const voiceTimerEl = page.querySelector('#voiceRecordTimer') as HTMLElement | null;
  const voiceCancelBtn = page.querySelector('#voiceCancelBtn') as HTMLButtonElement | null;
  const lightbox = page.querySelector('#mediaLightbox') as HTMLElement | null;
  const lightboxImg = page.querySelector('#lightboxImg') as HTMLImageElement | null;
  const lightboxClose = page.querySelector('#lightboxClose') as HTMLButtonElement | null;

  async function appendOutgoing(msg: any) {
    if (!msg) return;
    const exists = messagesContainer.querySelector(
      `[data-message-id="${msg.messageId}"]`,
    );
    if (!exists) {
      messagesContainer.appendChild(createMessageElement(msg));
    }
    scrollToBottom(messagesContainer);
  }

  attachBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = '';
    try {
      const replyId = replyToMessageId || undefined;
      clearReplyTarget();
      const msg = await chatManager.sendMedia(conversationId, file, replyId);
      await appendOutgoing(msg);
    } catch (err: any) {
      void appDialog.alert(err?.message || 'Upload failed');
    }
  });

  // Image lightbox
  messagesContainer.addEventListener('click', (e) => {
    const img = (e.target as HTMLElement).closest('img.msg-image') as HTMLImageElement | null;
    if (!img || !lightbox || !lightboxImg) return;
    lightboxImg.src = img.dataset.fullsrc || img.src;
    lightbox.style.display = 'flex';
  });
  lightboxClose?.addEventListener('click', () => {
    if (lightbox) lightbox.style.display = 'none';
    if (lightboxImg) lightboxImg.src = '';
  });
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.style.display = 'none';
      if (lightboxImg) lightboxImg.src = '';
    }
  });

  // Voice recording (hold mic)
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let recordChunks: BlobPart[] = [];
  let recordStartedAt = 0;
  let recordTimer: any = null;
  let recordCancelled = false;

  function formatRecTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function stopTracks() {
    mediaStream?.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;
  }

  function clearRecordTimer() {
    if (recordTimer) clearInterval(recordTimer);
    recordTimer = null;
  }

  async function startVoiceRecord() {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    recordCancelled = false;
    recordChunks = [];
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      void appDialog.alert('Microphone permission denied');
      return;
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    mediaRecorder = mime
      ? new MediaRecorder(mediaStream, { mimeType: mime })
      : new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordChunks.push(ev.data);
    };
    mediaRecorder.onstop = async () => {
      clearRecordTimer();
      if (voiceBar) voiceBar.style.display = 'none';
      stopTracks();
      if (recordCancelled) {
        recordChunks = [];
        return;
      }
      const blobType = mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(recordChunks, { type: blobType });
      recordChunks = [];
      if (blob.size < 500) return; // too short
      const ext = blobType.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blobType });
      try {
        const replyId = replyToMessageId || undefined;
        clearReplyTarget();
        const msg = await chatManager.sendMedia(conversationId, file, replyId);
        await appendOutgoing(msg);
      } catch (err: any) {
        void appDialog.alert(err?.message || 'Voice upload failed');
      }
    };
    mediaRecorder.start(250);
    recordStartedAt = Date.now();
    if (voiceTimerEl) voiceTimerEl.textContent = '0:00';
    if (voiceBar) voiceBar.style.display = 'flex';
    recordTimer = setInterval(() => {
      if (voiceTimerEl) {
        voiceTimerEl.textContent = formatRecTime(Date.now() - recordStartedAt);
      }
    }, 250);
  }

  function endVoiceRecord(cancel: boolean) {
    recordCancelled = cancel;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      clearRecordTimer();
      if (voiceBar) voiceBar.style.display = 'none';
      stopTracks();
    }
    mediaRecorder = null;
  }

  micBtn?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startVoiceRecord();
  });
  micBtn?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startVoiceRecord();
  }, { passive: false });

  const endSend = () => endVoiceRecord(false);
  const endCancel = () => endVoiceRecord(true);
  window.addEventListener('mouseup', endSend);
  window.addEventListener('touchend', endSend);
  voiceCancelBtn?.addEventListener('click', endCancel);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSend();
  });

  page.querySelector('#backBtn')?.addEventListener('click', () => {
    try {
      if (typeof (window as any).__backFromChatButton === 'function') {
        (window as any).__backFromChatButton();
        return;
      }
    } catch {}
    // Fallback if nav helpers not ready
    try {
      chatManager.stopTyping?.(conversationId);
    } catch {}
    try {
      if (presenceUI?.onCloseChat) presenceUI.onCloseChat(conversationId);
    } catch {}
    try {
      if (socket?.connected) socket.emit('message:leave', { conversationId });
    } catch {}
    page.remove();
    (window as any).__currentConversationId = null;
    try {
      history.replaceState({ app: 'trap' }, '', location.pathname + location.search);
      (window as any).__armNavTrap?.();
    } catch {}
    try {
      if (typeof pageL === 'undefined' || pageL === 0) {
        try {
          restoreConversationListAfterChat();
        } catch {
          try {
            paintFilteredConversations();
          } catch {
            void hel?.();
          }
        }
      }
    } catch {}
  });
}


  // In-memory conversation rows for list (survives open chat when DOM cards are gone)
  if (!(window as any).__convState) {
    (window as any).__convState = new Map();
  }
  const convState: Map<string, any> = (window as any).__convState;
  const seenMsgForCard = new Set<string>();

  function updateConversationCardFromMessage(
    msg: any,
    currentUserId: string,
    openConversationId: string | null,
  ) {
    if (!msg?.conversationId) return;
    // Deleted messages must not rewrite last-message preview on the card
    if (msg.deletedAt || msg.isDeleted || msg.type === 'system') return;
    const conId = String(msg.conversationId);
    const messageId = String(msg.messageId || msg.clientMessageId || '');
    // Dedupe: same event may arrive from user room + conversation room
    if (messageId) {
      const dedupeKey = messageId + ':card';
      if (seenMsgForCard.has(dedupeKey)) return;
      seenMsgForCard.add(dedupeKey);
      if (seenMsgForCard.size > 500) {
        const first:any = seenMsgForCard.values().next().value;
        seenMsgForCard.delete(first);
      }
    }

    const text = msg.isDeleted
      ? 'Message deleted'
      : msg.type && msg.type !== 'text'
        ? `[${msg.type}]`
        : String(msg.content || '').slice(0, 120);
    const d = msg.createdAt ? new Date(msg.createdAt) : new Date();
    const LMET =
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0');

    const isMine = String(msg.senderId) === String(currentUserId);
    const chatOpen =
      !!document.getElementById('chatPage') &&
      !!openConversationId &&
      String(openConversationId) === conId;
    const isOpen = chatOpen;

    const prev = convState.get(conId) || {};
    let UNM = Number(prev.UNM || 0);
    if (!isMine && !isOpen) UNM = UNM + 1;
    if (isOpen) UNM = 0;

    convState.set(conId, {
      ...prev,
      conID: conId,
      LME: text,
      LMET,
      UNM,
      lastAt: d.toISOString(),
    });

    // Keep list memory in sync for when user returns from chat / hel()
    try {
      if (Array.isArray(conves)) {
        const ix = conves.findIndex((c: any) => String(c?.conID) === conId);
        if (ix >= 0) {
          const row = {
            ...conves[ix],
            LME: text,
            LMET,
            UNM,
          };
          conves.splice(ix, 1);
          conves.unshift(row);
        }
      }
      const pending = (window as any).__pendingConvCard;
      if (pending && String(pending.conID) === conId) {
        pending.LME = text;
        pending.LMET = LMET;
        pending.UNM = UNM;
      }
    } catch {}

    let card: HTMLElement | any = null;
    document.querySelectorAll('main > .conv').forEach((el) => {
      if (String((el as any)._conversationId) === conId) card = el as HTMLElement;
    });
    if (card) {
      const lm = card.querySelector('.LM');
      const lmt = card.querySelector('.LMT');
      const unm = card.querySelector('.UNM') as HTMLElement | null;
      if (lm) lm.textContent = text;
      if (lmt) lmt.textContent = LMET;
      if (unm) {
        if (UNM > 0) {
          unm.textContent = String(UNM);
          unm.style.visibility = 'visible';
        } else {
          unm.textContent = '0';
          unm.style.visibility = 'hidden';
        }
      }
      const parent = card.parentElement;
      if (parent && parent.firstChild !== card) {
        parent.insertBefore(card, parent.firstChild);
      }
      return;
    }

    // First message and no card yet → build card for this conversation (peer side)
    const onHomeList =
      !document.getElementById('chatPage') &&
      (typeof pageL === 'undefined' || pageL === 0);
    void (async () => {
      try {
        let mapped: any = null;
        if (typeof hydrateConversationCardFromApi === 'function') {
          mapped = await hydrateConversationCardFromApi(conId, {
            conID: conId,
            ID: isMine ? null : String(msg.senderId || ''),
            name: String(msg.senderName || msg.username || 'Chat'),
            imgSrc: '',
          });
        }
        const row = {
          conID: conId,
          ID: (mapped && mapped.ID) || (isMine ? null : String(msg.senderId || '')),
          name: (mapped && mapped.name) || String(msg.senderName || msg.username || 'Chat'),
          imgSrc: (mapped && mapped.imgSrc) || '',
          LME: text,
          LMET,
          UNM,
        };
        if (typeof upsertConversationCard === 'function') {
          upsertConversationCard(row, { forceDom: onHomeList });
        }
        if (Array.isArray(conves)) {
          const ix = conves.findIndex((c: any) => String(c?.conID) === conId);
          if (ix >= 0) conves.splice(ix, 1);
          conves.unshift(row);
        }
      } catch {}
    })();
  }

  function clearConversationUnread(conversationId: string) {
    const conId = String(conversationId);
    const prev = convState.get(conId) || { conID: conId };
    convState.set(conId, { ...prev, UNM: 0 });
    // Keep in-memory list in sync (back/hel must not restore old badge)
    try {
      if (Array.isArray(conves)) {
        const ix = conves.findIndex((c: any) => String(c?.conID) === conId);
        if (ix >= 0) {
          conves[ix] = { ...conves[ix], UNM: 0 };
        }
      }
    } catch {}
    document.querySelectorAll('main > .conv').forEach((el) => {
      if (String((el as any)._conversationId) !== conId) return;
      const unm = el.querySelector('.UNM') as HTMLElement | null;
      if (unm) {
        unm.textContent = '0';
        unm.style.visibility = 'hidden';
      }
    });
  }

  (window as any).__updateConvCard = updateConversationCardFromMessage;
  (window as any).__clearConvUnread = clearConversationUnread;

  function convGen(d: {
    ID?: number,
    name?: String;
    imgSrc?: string;
    LME?: string;
    LMET?: string;
    UNM?: number;
    conID?:string;
    pinned?:any;
    muted?:any
  }) {
    let convDiv = $.createElement("div");

    convDiv.classList = "conv";
    const unread = d.UNM && Number(d.UNM) > 0 ? String(d.UNM) : '';
    const pin = d.pinned ? '<i class="fa-solid fa-thumbtack"></i> ' : '';
    convDiv.innerHTML = `
            <img src="${d.imgSrc}" alt="userProfile">
            <div>
                <h4>${pin}${d.name}</h4>
                <p class="LM">${d.LME || ''}</p>
            </div>
            <div class="TUCon">
                <p class="LMT">${d.LMET || ''}</p>
                <p class="UNM" style="${unread ? '' : 'visibility:hidden'}">${unread || '0'}</p>
            </div>
            `;
    (convDiv as any)._conversationId = d.conID;
    try {
      if (d.conID) {
        const st = (window as any).__convState as Map<string, any>;
        if (st) {
          st.set(String(d.conID), {
            conID: d.conID,
            LME: d.LME,
            LMET: d.LMET,
            UNM: Number(d.UNM || 0),
            name: d.name,
            ID: d.ID,
          });
        }
      }
    } catch {}
    (convDiv as any)._muted = !!d.muted;
    // Store userId on element object (not as HTML attribute)
    (convDiv as any)._peerUserId = d.ID;
    (convDiv as any)._imgSrc = resolveAvatarUrl((d as any).imgSrc);
    if (typeof presenceUI !== 'undefined' && presenceUI) {
      presenceUI.bindCardPeer(convDiv, d.ID);
    }

    convDiv.addEventListener('click', () => {
      openChatPage(
        d.conID!,
        d.name,
        resolveAvatarUrl((convDiv as any)._imgSrc || (d as any).imgSrc),
        chatManager,
        currentUserId,
        d.ID,
        typeof presenceUI !== 'undefined' ? presenceUI : undefined,
      );
    });
    $.querySelector("main")?.appendChild(convDiv);
  }

  function callGen(d: {
    name?: String;
    imgSrc?: string;
    LMET?: string;
    type?: string;
    peerId?:any
  }) {
    let convDiv = $.createElement("div");
    const typeClass =
      d.type == 'm' ? 'call-missed' : d.type == 'i' ? 'call-in' : 'call-out';
    convDiv.className = `call ${typeClass}`;
    let st: string = "";
    let stI: string = "";
    switch (true) {
      case d.type == "i":
        st = "Incoming";
        stI = "fa-phone-arrow-down-left";
        break;
      case d.type == "o":
        st = "Outgoing";
        stI = "fa-phone-arrow-up-right";
        break;
      case d.type == "m":
        st = "Missed";
        stI = "fa-phone-missed";
        break;
    }
    convDiv.innerHTML = `
             <img src="${d.imgSrc || '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg'}" alt="userProfile">
             <div class="call-body">
                 <h4>${d.name}</h4>
                 <p class="ST"><i class="fa-light ${stI}"></i> ${st} · ${d.LMET || ''}</p>
             </div>
             <button type="button" class="call-redial-btn" aria-label="Call">
                 <span>
                     <i class="fa-solid fa-phone"></i>
                 </span>
             </button>
            `;
    (convDiv as any)._peerUserId = d.peerId;
    convDiv.querySelector('.call-redial-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const peer = (convDiv as any)._peerUserId;
      if (peer) startCall(String(peer));
    });
    $.querySelector("main")?.appendChild(convDiv);
  }

  let calls: Array<{
    name?: string;
    imgSrc?: string;
    LMET?: string;
    type?: string;
    peerId?: string;
  }> = [];

  async function loadCallLogs() {
    const applyItems = (items: any[]) => {
      calls = (items || []).map((it: any) => ({
        name: it.name || it.peerId || 'Unknown',
        imgSrc:
          it.imgSrc ||
          'assets/static/image/wallpaperflare.com_wallpaper (4).jpg',
        LMET: it.LMET || '',
        type: it.type || 'o',
        peerId: it.peerId,
      }));
      incoming.length = 0;
      outgoing.length = 0;
      missed.length = 0;
      calls.forEach((ele) => {
        if (ele.type == 'i') incoming.push(ele);
        else if (ele.type == 'o') outgoing.push(ele);
        else if (ele.type == 'm') missed.push(ele);
      });
    };

    const fromCache = async () => {
      const store = (window as any).__offlineStore;
      if (store?.loadCallLogs) {
        const cached = await store.loadCallLogs();
        applyItems(cached);
        return true;
      }
      return false;
    };

    try {
      const offline =
        typeof detectOfflineNow === 'function'
          ? await detectOfflineNow()
          : navigator.onLine === false;
      if (offline) {
        await fromCache();
        return;
      }

      const token =
        getOnlineAccessToken();
      if (!token) {
        await fromCache();
        return;
      }
      const res = await fetch('/calls/logs?limit=50', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      const items = data.items || [];
      applyItems(items);
      try {
        await (window as any).__offlineStore?.saveCallLogs?.(items);
      } catch {}
    } catch (e) {
      await fromCache();
    }
  }


  (window as any).__reloadCallLogs = () => {
    if (typeof pageL !== 'undefined' && pageL === 1) {
      return loadCallLogs().then(() => renderCallList(calls));
    }
    return loadCallLogs();
  };

  function renderCallList(list: typeof calls) {
    document.querySelectorAll('main > .call, main > .empty-state').forEach((e) => e.remove());
    const rows = Array.isArray(list) ? list : [];
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon"><i class="fa-solid fa-phone"></i></div>
        <h3 class="empty-state-title">No calls yet</h3>
        <p class="empty-state-sub">Your call history will show up here.</p>
      `;
      document.querySelector('main')?.appendChild(empty);
      return;
    }
    rows.forEach((ele) => callGen(ele));
  }


  let conves: any = [''];
  conves.pop();

  const chats = [
    {
      ID: 1,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 2,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 5,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 6,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 7,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 8,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
    {
      ID: 9,
      messages: [
        {
          sendBy: 'a',
          message: 'loremasdofj asldfjasdlfj asdfjaoirjewkmrlwmn jasdifjamlkva ujasmnfasfdlasu9pfjn4r poui9i askdfjsd9f',
        },
        {
          sendBy: 'b',
          message: 'asdfasdfasdfasfda;slkf'
        },
        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'a',
          message: 'asdfasdfasdfasfda;slkf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },

        {
          sendBy: 'a',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
        {
          sendBy: 'b',
          message: 'i[9poiaj fo;ja fajs f[qhjh dsfoashfsnd;fasf6as 5a4sdff4 a6546 4sd6f54a sf',
        },
      ]
    },
  ];

  function formatConvTime(iso: any) {
    if (!iso) return '';
    const up = new Date(iso);
    if (isNaN(up.getTime())) return '';
    return (
      up.getHours().toString().padStart(2, '0') +
      ':' +
      up.getMinutes().toString().padStart(2, '0')
    );
  }


  function upsertConversationCard(
    d: {
      conID: string;
      ID?: string | null;
      name?: string;
      imgSrc?: string;
      LME?: string;
      LMET?: string;
      UNM?: number;
    },
    opts?: { forceDom?: boolean },
  ) {
    if (!d?.conID) {
      return;
    }
    const row:any = {
      name: d.name || 'Chat',
      LME: d.LME || '',
      LMET: d.LMET || '',
      UNM: d.UNM ?? 0,
      type: 'p' as const,
      imgSrc:
        d.imgSrc ||
        '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg',
      ID: d.ID || null,
      conID: String(d.conID),
    };

    if (!Array.isArray(conves)) {
      (conves as any) = [];
    }
    const idx = conves.findIndex(
      (c: any) => String(c?.conID) === String(row.conID),
    );
    if (idx >= 0) conves[idx] = { ...conves[idx], ...row };
    else conves.unshift(row);

    try {
      const st = (window as any).__convState as Map<string, any>;
      if (st) {
        st.set(String(row.conID), {
          conID: row.conID,
          LME: row.LME,
          LMET: row.LMET,
          UNM: row.UNM,
          name: row.name,
          ID: row.ID,
        });
      }
    } catch {}

    // Keep pending so hel() can merge after server list
    (window as any).__pendingConvCard = row;

    const chatOpen = !!document.getElementById('chatPage');
    const onMessagesTab = typeof pageL === 'undefined' || pageL === 0;
    if (!opts?.forceDom && (chatOpen || !onMessagesTab)) {
      return;
    }

    let existing: HTMLElement | any = null;
    document.querySelectorAll('main > .conv').forEach((el) => {
      if (String((el as any)._conversationId) === String(row.conID)) {
        existing = el as HTMLElement;
      }
    });
    if (existing) {
      const lm = existing.querySelector('.LM');
      const lmt = existing.querySelector('.LMT');
      const h4 = existing.querySelector('h4');
      if (h4 && row.name) h4.textContent = String(row.name);
      if (lm) lm.textContent = row.LME || '';
      if (lmt && row.LMET) lmt.textContent = row.LMET;
      existing.parentElement?.insertBefore(
        existing,
        existing.parentElement.firstChild,
      );
      return;
    }
    convGen(row);
    const cards = document.querySelectorAll('main > .conv');
    const last = cards[cards.length - 1] as HTMLElement | undefined;
    if (last?.parentElement && last.parentElement.firstChild !== last) {
      last.parentElement.insertBefore(last, last.parentElement.firstChild);
    }
  }

  function mapConversationItem(ele: any) {
    if (!ele || typeof ele !== 'object') {
      return { name: 'Chat', LME: '', LMET: '', UNM: 0, type: 'p', imgSrc: '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg', ID: null, conID: null };
    }
    const peerId =
      ele.peerId ||
      ele.user?.userId ||
      ele.user?._id ||
      ele.conversation?.userId ||
      ele.participantId ||
      null;
    const isGroup =
      ele.type === 'group' || ele.type === 'g' || !!ele.isGroup;
    const name = isGroup
      ? String(ele.title || ele.name || 'Group')
      : (
          (ele.user &&
            (ele.user.displayName ||
              ele.user.userName ||
              ele.user.username ||
              ele.user.name)) ||
          ele.displayName ||
          ele.userName ||
          ele.username ||
          ele.name ||
          ele.title ||
          'Chat'
        );
    const avatarPath =
      (ele.user && (ele.user.profilePic || ele.user.avatar)) ||
      ele.profilePic ||
      ele.avatar ||
      ele.imgSrc ||
      '';
    const lastText =
      ele.lastMessage?.text ||
      ele.lastMessage?.content ||
      ele.lastMessageText ||
      '';
    const lastAt =
      ele.lastMessage?.at ||
      ele.lastMessage?.createdAt ||
      ele.lastMessageAt ||
      ele.updatedAt ||
      ele.conversation?.updatedAt;
    const conID =
      ele.conversationId ||
      ele.conID ||
      ele._id ||
      ele.id ||
      ele.conversation?._id ||
      ele.conversation?.conversationId ||
      ele.conversation?.id ||
      null;

    return {
      name: String(name),
      LME: lastText,
      LMET: formatConvTime(lastAt),
      UNM: ele.unreadCount ?? ele.UNM ?? 0,
      type: isGroup ? 'g' : 'p',
      imgSrc: resolveAvatarUrl(avatarPath),
      ID: peerId,
      conID: conID ? String(conID) : null,
      pinned: !!ele.pinned,
      muted: !!ele.muted,
      archived: !!ele.archived,
    };
  }

  function applyConvStateToDom() {
    try {
      const st: Map<string, any> = (window as any).__convState;
      if (!st) return;
      document.querySelectorAll('main > .conv').forEach((el) => {
        const id = String((el as any)._conversationId || '');
        const row = st.get(id);
        if (!row) return;
        const lm = el.querySelector('.LM');
        const lmt = el.querySelector('.LMT');
        const unm = el.querySelector('.UNM') as HTMLElement | null;
        if (lm && row.LME != null && row.LME !== '') lm.textContent = row.LME;
        if (lmt && row.LMET != null) lmt.textContent = row.LMET;
        if (unm && row.UNM != null) {
          const n = Number(row.UNM) || 0;
          unm.textContent = String(n);
          unm.style.visibility = n > 0 ? 'visible' : 'hidden';
        }
      });
    } catch {}
  }

  /** Paint from in-memory conves + realtime state (no boot snapshot) */
  function paintConversationListFromMemory() {
    document.querySelectorAll('main > .conv').forEach((e) => e.remove());
    const list = (conves || []).filter((c: any) => c && c.conID);
    list.forEach((c: any) => convGen(c));
    applyConvStateToDom();
  }

  async function hel() {
    // Fetch once → build memory → paint ONCE with active filter (no flicker)
    let ddd: any[] = [];
    const offline =
      typeof detectOfflineNow === 'function'
        ? await detectOfflineNow()
        : navigator.onLine === false;

    if (!offline) {
      try {
        const co = await kkk();
        ddd = co.conversations || [];
      } catch (e) {
        ddd = await loadConversationsOffline();
      }
    } else {
      ddd = await loadConversationsOffline();
      if (!ddd.length && Array.isArray((window as any).__bootConversations)) {
        ddd = (window as any).__bootConversations;
      }
    }

    (window as any).__bootConversations = null;

    // Rebuild memory only — do NOT touch DOM yet
    conves = [];
    for (let idx = 0; idx < ddd.length; idx++) {
      try {
        const d: any = mapConversationItem(ddd[idx]);
        if (!d.conID) continue;
        try {
          const st: Map<string, any> = (window as any).__convState;
          const live = st?.get(String(d.conID));
          if (live) {
            if (live.LME) d.LME = live.LME;
            if (live.LMET) d.LMET = live.LMET;
            if (live.UNM != null) d.UNM = Number(live.UNM) || 0;
          }
        } catch {}
        conves.push(d);
      } catch (e) {
      }
    }

    try {
      const pending = (window as any).__pendingConvCard;
      if (pending?.conID) {
        const exists = (conves || []).some(
          (c: any) => String(c?.conID) === String(pending.conID),
        );
        if (!exists) {
          const st = (window as any).__convState as Map<string, any> | undefined;
          const live = st?.get(String(pending.conID));
          conves.unshift({
            ...pending,
            LME: live?.LME || pending.LME || '',
            LMET: live?.LMET || pending.LMET || '',
            UNM: live?.UNM ?? pending.UNM ?? 0,
          });
        }
      }
    } catch (e) {
    }

    // Single DOM pass: filter first, then create cards
    if (typeof paintFilteredConversations === 'function') {
      paintFilteredConversations();
    } else {
      document.querySelectorAll('main > .conv, main > .empty-state').forEach((e) => e.remove());
      (conves || []).forEach((c: any) => {
        if (c?.conID) convGen(c);
      });
    }

    try {
      applyConvStateToDom();
    } catch {}

    try {
      if (presenceUI && socket && navigator.onLine !== false) {
        // Presence only for currently visible cards
        const peerIds: string[] = [];
        document.querySelectorAll('main > .conv').forEach((el: any) => {
          if (el?._peerUserId) peerIds.push(String(el._peerUserId));
        });
        if (!peerIds.length) {
          (conves || []).forEach((c: any) => {
            if (c?.ID) peerIds.push(String(c.ID));
          });
        }
        await presenceUI.refreshListPresence(peerIds);
      }
    } catch (e) {
    }
  }

  hel();

  const incoming: any[] = [];
  const outgoing: any[] = [];
  const missed: any[] = [];

  /** Active conversation list filter + search query */
  let convFilter: 'all' | 'unread' | 'personal' | 'groups' | 'channels' = 'all';
  let convSearchQ = '';

  function getConversationRows(): any[] {
    return (conves || []).filter((c: any) => c && c.conID);
  }

  function filterConversationRows(
    rows: any[],
    filter: typeof convFilter,
    q: string,
  ): any[] {
    let list = rows.slice();
    switch (filter) {
      case 'unread':
        list = list.filter((c) => Number(c.UNM || 0) > 0);
        break;
      case 'personal':
        list = list.filter((c) => c.type !== 'g' && c.type !== 'c');
        break;
      case 'groups':
        list = list.filter((c) => c.type === 'g');
        break;
      case 'channels':
        list = list.filter((c) => c.type === 'c');
        break;
      default:
        break;
    }
    const query = String(q || '').trim().toLowerCase();
    if (query) {
      list = list.filter((c) => {
        const name = String(c.name || '').toLowerCase();
        const lm = String(c.LME || '').toLowerCase();
        return name.includes(query) || lm.includes(query);
      });
    }
    return list;
  }

  function paintFilteredConversations() {
    document
      .querySelectorAll('main > .conv, main > .empty-state')
      .forEach((e) => e.remove());
    const rows = filterConversationRows(
      getConversationRows(),
      convFilter,
      convSearchQ,
    );
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-state-icon"><i class="fa-solid fa-comments"></i></div>
        <h3 class="empty-state-title">No chats found</h3>
        <p class="empty-state-sub">Try another filter or search.</p>
      `;
      document.querySelector('main')?.appendChild(empty);
      return;
    }
    rows.forEach((c) => convGen(c));
    try {
      applyConvStateToDom();
    } catch {}
  }

  function topEvent() {
    const tpI = $.querySelectorAll<HTMLElement>('#topList>li');
    tpI.forEach((element) => {
      element.addEventListener('click', () => {
        const a = $.querySelector('.activeLI') as HTMLElement | null;
        if (element === a) return;

        // Calls tab filters
        if (pageL === 1) {
          document
            .querySelectorAll(
              'main > .conv, main > .call, main > .empty-state, main > .settings-card, main > .settings-panel, main > .ai-panel, main > .contact-row, main > .contacts-wrap, #chatPage',
            )
            .forEach((e) => e.remove());
          if (a) a.className = '';
          element.className = 'activeLI';
          const label = (element.textContent || '').trim();
          if (label === 'Incoming') incoming.forEach((e) => callGen(e));
          else if (label === 'Outgoing') outgoing.forEach((e) => callGen(e));
          else if (label === 'Missed') missed.forEach((e) => callGen(e));
          else renderCallList(calls);
          return;
        }

        // Contacts tab — leave to contacts handlers
        if (pageL === 2) return;

        // Messages tab filters
        if (pageL !== 0) return;

        if (a) a.className = '';
        element.className = 'activeLI';
        const label = (element.textContent || '').trim();
        if (label === 'Unread') convFilter = 'unread';
        else if (label === 'Personal') convFilter = 'personal';
        else if (label === 'Groups') convFilter = 'groups';
        else if (label === 'Chanells' || label === 'Channels')
          convFilter = 'channels';
        else convFilter = 'all';

        // Fetch from API, then build cards already filtered (no flicker)
        void Promise.resolve(hel());
      });
    });
  }

  topEvent();

  searcheInput?.addEventListener('input', () => {
    const q = searcheInput.value || '';
    if (pageL === 2) {
      filterContactsBySearch(q);
      return;
    }
    if (pageL === 0) {
      convSearchQ = q;
      paintFilteredConversations();
    }
  });

  // search blur removed


  type ContactRow = {
    userId: string;
    username: string;
    profilePic?: string | null;
    bio?: string | null;
    subtitle?: string;
    conversationId?: string | null;
    source?: 'recent' | 'all';
  };

  let contactRows: ContactRow[] = [];
  let contactFilter: 'recent' | 'all' = 'recent';

  function contactGen(d: ContactRow) {
    const div = document.createElement('div');
    div.className = 'conv contact-card';
    const img = resolveAvatarUrl(d.profilePic || '');
    const sub = String(d.bio || d.subtitle || '').trim();
    div.innerHTML = `
      <img src="${img}" alt="userProfile">
      <div>
        <h4>${escapeHtml(d.username)}</h4>
        <p class="LM">${escapeHtml(sub)}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-inline-start:auto;padding-inline-end:8px">
        <button type="button" class="contact-chat-btn" title="Chat" style="border:none;background:transparent;color:#a78bfa;cursor:pointer;font-size:1.1rem">
          <i class="fa-solid fa-message"></i>
        </button>
        <button type="button" class="contact-call-btn" title="Call" style="border:none;background:transparent;color:#a78bfa;cursor:pointer;font-size:1.1rem">
          <i class="fa-solid fa-phone"></i>
        </button>
      </div>
    `;
    (div as any)._peerUserId = d.userId;
    (div as any)._conversationId = d.conversationId || null;
    (div as any)._username = d.username;

    const openChat = async () => {
      try {
        let conId = d.conversationId;
        let resp: any = null;
        if (!conId) {
          resp = await createConversationWithUser(d.userId);
          conId = resp?.conversationId || null;
        }
        if (!conId) {
          void appDialog.alert('Could not open chat');
          return;
        }
        // Prefer full card from conversation list API (DB-backed fields)
        try {
          const hydrated = await hydrateConversationCardFromApi(String(conId), {
            conID: String(conId),
            ID: String(d.userId),
            name: String(d.username || 'Chat'),
            imgSrc: img,
          });
          if (!hydrated) {
          }
        } catch (e) {
          upsertConversationCard({
            conID: String(conId),
            ID: String(d.userId),
            name: String(d.username || 'Chat'),
            imgSrc: img,
            LME: '',
            LMET: '',
            UNM: 0,
          });
        }
        openChatPage(
          String(conId),
          d.username,
          img,
          chatManager,
          currentUserId,
          d.userId,
          typeof presenceUI !== 'undefined' ? presenceUI : undefined,
        );
      } catch (e: any) {
        void appDialog.alert(e?.message || 'Failed to open chat');
      }
    };

    div.querySelector('.contact-chat-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void openChat();
    });
    div.querySelector('.contact-call-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      startCall(d.userId, d.conversationId || undefined);
    });
    div.addEventListener('click', () => void openChat());
    document.querySelector('main')?.appendChild(div);
  }

  function renderContactList(list: ContactRow[]) {
    document
      .querySelectorAll('main > .conv, main > .call, main > .settings-card, main > .settings-panel, main > .ai-panel, #chatPage')
      .forEach((e) => e.remove());
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'conv';
      empty.innerHTML = `<div><h4>No contacts</h4><p class="LM">Chat or call someone, or switch to All</p></div>`;
      document.querySelector('main')?.appendChild(empty);
      return;
    }
    list.forEach((c) => contactGen(c));
  }

  async function fetchAllUsers(q?: string): Promise<ContactRow[]> {
    const token =
      getOnlineAccessToken();
    if (!token) return [];
    let url = '/users/list';
    if (q && q.trim()) url += '?q=' + encodeURIComponent(q.trim());
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('users http ' + res.status);
    const data = await res.json();
    return (data.items || []).map((u: any) => {
      const bio = String(u.bio || '').trim();
      return {
        userId: String(u.userId),
        username: String(u.displayName || u.username || u.userId),
        profilePic: u.profilePic,
        bio: bio || null,
        source: 'all' as const,
        subtitle: bio || '',
      };
    });
  }


  const usernameById: Map<string, string> = (window as any).__usernameById || new Map();
  (window as any).__usernameById = usernameById;

  function rememberUsername(userId: any, username: any) {
    if (!userId || !username) return;
    usernameById.set(String(userId), String(username));
  }

  function getCachedUsername(userId: any): string {
    if (!userId) return '';
    return usernameById.get(String(userId)) || '';
  }

  async function resolveUsername(userId: string): Promise<string> {
    const id = String(userId || '');
    if (!id) return '';
    if (getCachedUsername(id)) return getCachedUsername(id);
    try {
      const users = await fetchAllUsers();
      for (const u of users || []) {
        if (u?.userId) rememberUsername(u.userId, u.username);
      }
    } catch {}
    return getCachedUsername(id) || ('User ' + id.slice(0, 6));
  }
  (window as any).__resolveUsername = resolveUsername;
  (window as any).__getCachedUsername = getCachedUsername;
  (window as any).__rememberUsername = rememberUsername;

  function buildRecentContacts(): ContactRow[] {
    const map = new Map<string, ContactRow>();
    try {
      (conves || []).forEach((c: any) => {
        const id = c?.ID || c?.peerId || c?.userId;
        if (!id || String(id) === String(currentUserId)) return;
        map.set(String(id), {
          userId: String(id),
          username: String(c.name || id),
          conversationId: c.conID || c.conversationId || null,
          profilePic: c.imgSrc,
          source: 'recent',
          subtitle: '',
          bio: null,
        });
      });
    } catch {}
    try {
      (calls || []).forEach((c: any) => {
        const id = c?.peerId;
        if (!id || String(id) === String(currentUserId)) return;
        if (map.has(String(id))) return;
        map.set(String(id), {
          userId: String(id),
          username: String(c.name || id),
          source: 'recent',
          subtitle: 'Recent call',
        });
      });
    } catch {}
    return [...map.values()];
  }

  async function loadContacts(tab: 'recent' | 'all' = contactFilter) {
    contactFilter = tab;
    try {
      if (tab === 'recent') {
        if (typeof loadCallLogs === 'function' && (!calls || !calls.length)) {
          try {
            await loadCallLogs();
          } catch {}
        }
        contactRows = buildRecentContacts();
        try {
          const all = await fetchAllUsers();
          const bioById = new Map(
            all.map((u) => [String(u.userId), String(u.bio || u.subtitle || '').trim()]),
          );
          contactRows = contactRows.map((row) => {
            const bio = bioById.get(String(row.userId)) || '';
            return { ...row, bio: bio || null, subtitle: bio };
          });
        } catch {}
      } else {
        contactRows = await fetchAllUsers();
      }
      renderContactList(contactRows);
    } catch (e) {
      contactRows = tab === 'recent' ? buildRecentContacts() : [];
      renderContactList(contactRows);
    }
  }

  function filterContactsBySearch(q: string) {
    const qq = (q || '').trim().toLowerCase();
    if (!qq) {
      renderContactList(contactRows);
      return;
    }
    renderContactList(
      contactRows.filter((c) => c.username.toLowerCase().includes(qq)),
    );
  }


  /** AI tab — uses ai-panel / ai-block (NOT .conv grid) */
  function renderAI() {
    document
      .querySelectorAll(
        'main > .conv, main > .call, main > .settings-card, main > .settings-panel, main > .ai-panel, #chatPage',
      )
      .forEach((e) => e.remove());

    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-block ai-hero">
        <div class="ai-hero-top">
          <h4>AI Assistant</h4>
          <span class="ai-badge">Soon</span>
        </div>
        <p class="ai-sub">Smart replies, summaries, and search across your chats.</p>
      </div>

      <div class="ai-block">
        <p class="ai-feature">• Summarize long conversations</p>
        <p class="ai-feature">• Suggest replies</p>
        <p class="ai-feature">• Find messages by meaning</p>
      </div>

      <div class="ai-block ai-input-block">
        <input class="ai-input" type="text" disabled placeholder="Ask anything… (coming soon)" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
        <button type="button" class="ai-send-btn" disabled>Send</button>
      </div>
    `;
    document.querySelector('main')?.appendChild(panel);
  }

  async function renderSettings() {
    document
      .querySelectorAll(
        'main > .conv, main > .call, #chatPage, main > .settings-card, main > .settings-panel, main > .ai-panel',
      )
      .forEach((e) => e.remove());

    let profile: any = {
      displayName: '',
      username: '',
      bio: '',
      profilePic: '',
      userId: currentUserId,
    };
    try {
      await fetchMyUsername();
    } catch {}
    try {
      const token =
        getOnlineAccessToken();
      const res = await fetch('/users/profile', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        profile = { ...profile, ...(data.user || data) };
      }
    } catch {}

    const displayName =
      profile.displayName ||
      profile.username ||
      (window as any).__currentUsername ||
      'Account';
    const username =
      profile.username || (window as any).__currentUsername || '';
    const pic =
      profile.profilePic ||
      '/assets/static/image/wallpaperflare.com_wallpaper (4).jpg';
    const bio = profile.bio || '';
    const uid = String(currentUserId || profile.userId || '');

    const getAccessToken = (): string =>
      getOnlineAccessToken();

    const wrap = document.createElement('div');
    wrap.className = 'settings-panel';
    wrap.innerHTML = `
      <div class="settings-home" id="settingsHome">
        <div class="settings-block settings-profile">
          <img src="${escapeHtml(pic)}" alt="" class="settings-avatar" id="settingsHomeAvatar" />
          <div class="settings-profile-text">
            <h4 class="settings-name" id="settingsHomeName">${escapeHtml(String(displayName))}</h4>
            <p class="settings-sub">@${escapeHtml(String(username || displayName))}</p>
          </div>
        </div>

        <button type="button" class="settings-nav-item" data-tab="profile">
          <span class="settings-nav-icon"><i class="fa-solid fa-user"></i></span>
          <span class="settings-nav-text">
            <strong>Edit profile</strong>
            <small>Name, bio and profile photo</small>
          </span>
          <i class="fa-solid fa-chevron-right settings-nav-chevron"></i>
        </button>

        <button type="button" class="settings-nav-item" data-tab="password">
          <span class="settings-nav-icon"><i class="fa-solid fa-lock"></i></span>
          <span class="settings-nav-text">
            <strong>Change password</strong>
            <small>Update your account password</small>
          </span>
          <i class="fa-solid fa-chevron-right settings-nav-chevron"></i>
        </button>

        <button type="button" class="settings-nav-item" data-tab="sessions">
          <span class="settings-nav-icon"><i class="fa-solid fa-mobile-screen"></i></span>
          <span class="settings-nav-text">
            <strong>Active sessions</strong>
            <small>Devices signed in to your account</small>
          </span>
          <i class="fa-solid fa-chevron-right settings-nav-chevron"></i>
        </button>

        <button type="button" class="settings-nav-item" data-tab="notifications">
          <span class="settings-nav-icon"><i class="fa-solid fa-bell"></i></span>
          <span class="settings-nav-text">
            <strong>Notifications</strong>
            <small>Push alerts when you are away</small>
          </span>
          <i class="fa-solid fa-chevron-right settings-nav-chevron"></i>
        </button>

        <button type="button" class="settings-nav-item" data-tab="privacy">
          <span class="settings-nav-icon"><i class="fa-solid fa-shield-halved"></i></span>
          <span class="settings-nav-text">
            <strong>Privacy</strong>
            <small>Last seen and read receipts</small>
          </span>
          <i class="fa-solid fa-chevron-right settings-nav-chevron"></i>
        </button>

        <div class="settings-block settings-logout-wrap">
          <button type="button" id="settingsLogoutBtn" class="settings-logout-btn">Log out</button>
          <p class="settings-sub">Ends session on this device only</p>
        </div>
      </div>

      <div class="settings-tab" id="settingsTab" hidden></div>
    `;
    document.querySelector('main')?.appendChild(wrap);
    hardenInputsAgainstAutofill(wrap);

    const home = wrap.querySelector('#settingsHome') as HTMLElement;
    const tab = wrap.querySelector('#settingsTab') as HTMLElement;

    const showHome = () => {
      const d=wrap.querySelector('#settingsHome') as HTMLFormElement
        d.style.display='flex'
      tab.hidden = true;
      tab.innerHTML = '';
      home.hidden = false;
    };

    const showTab = (title: string, bodyHtml: string) => {
      home.hidden = true;
      tab.hidden = false;
      tab.innerHTML = `
        <div class="settings-tab-head">
          <button type="button" class="settings-tab-back" id="settingsTabBack" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <h3 class="settings-tab-title">${escapeHtml(title)}</h3>
        </div>
        <div class="settings-tab-body">${bodyHtml}</div>
      `;
      tab.querySelector('#settingsTabBack')?.addEventListener('click', showHome);
    };

    const openProfileTab = () => {
      showTab(
        'Edit profile',
        `
        <div class="settings-form">
          <div class="settings-avatar-edit">
            <img src="${escapeHtml(pic)}" alt="" id="settingsAvatarImg" class="settings-avatar-lg" />
            <label class="settings-file-btn" for="settingsAvatarInp">
              <i class="fa-solid fa-camera"></i> Change photo
            </label>
            <input id="settingsAvatarInp" type="file" accept="image/*" class="settings-file-input" autocomplete="off" />
          </div>
          <label class="settings-label">Display name</label>
          <input id="settingsDisplayInp" class="settings-input" type="text" maxlength="40" value="${escapeHtml(String(displayName))}" autocorrect="off" autocapitalize="off" spellcheck="false"  name="no-autofill" autocomplete="one-time-code" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
          <label class="settings-label">Bio</label>
          <textarea id="settingsBioInp" class="settings-input settings-textarea" maxlength="160" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">${escapeHtml(String(bio))}</textarea>
          <button type="button" id="settingsSaveBtn" class="settings-save-btn">Save changes</button>
          <p id="settingsSaveMsg" class="settings-msg" hidden></p>
        </div>
      `,
      );

      const fileInp = tab.querySelector('#settingsAvatarInp') as HTMLInputElement | null;
      fileInp?.addEventListener('change', () => {
        const f = fileInp.files?.[0];
        const img = tab.querySelector('#settingsAvatarImg') as HTMLImageElement | null;
        if (f && img) img.src = URL.createObjectURL(f);
      });

      tab.querySelector('#settingsSaveBtn')?.addEventListener('click', async () => {
        const msg = tab.querySelector('#settingsSaveMsg') as HTMLElement | null;
        const btn = tab.querySelector('#settingsSaveBtn') as HTMLButtonElement | null;
        const dn =
          (tab.querySelector('#settingsDisplayInp') as HTMLInputElement | null)?.value?.trim() ||
          '';
        const bioVal =
          (tab.querySelector('#settingsBioInp') as HTMLTextAreaElement | null)?.value || '';
        if (!dn) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'Display name required';
          }
          return;
        }
        if (btn) btn.disabled = true;
        try {
          const fd = new FormData();
          fd.append('displayName', dn);
          fd.append('bio', bioVal);
          const f = fileInp?.files?.[0];
          if (f) fd.append('avatar', f);
          const token = getAccessToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const res = await fetch('/users/profile', {
            method: 'PATCH',
            headers,
            body: fd,
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
                'Save failed',
            );
          }
          const u = data.user || data;
          if (u.displayName) {
            (window as any).__currentUsername = u.displayName;
            profile.displayName = u.displayName;
            const homeName = wrap.querySelector('#settingsHomeName');
            if (homeName) homeName.textContent = u.displayName;
          }
          if (u.profilePic) {
            profile.profilePic = u.profilePic;
            applySelfAvatar(u.profilePic);
          }
          if (u.bio != null) profile.bio = u.bio;
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'Saved';
          }
        } catch (e: any) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = e?.message || 'Save failed';
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    };

    const openPasswordTab = () => {
      showTab(
        'Change password',
        `
        <div class="settings-form">
          <label class="settings-label">Current password</label>
          <input id="settingsCurPass" class="settings-input" type="password" autocorrect="off" autocapitalize="off" spellcheck="false"  name="not-password" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
          <label class="settings-label">New password</label>
          <input id="settingsNewPass" class="settings-input" type="password" autocorrect="off" autocapitalize="off" spellcheck="false"  name="not-password" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
          <label class="settings-label">Confirm new password</label>
          <input id="settingsNewPass2" class="settings-input" type="password" autocorrect="off" autocapitalize="off" spellcheck="false"  name="not-password" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
          <button type="button" id="settingsPassBtn" class="settings-save-btn">Update password</button>
          <p id="settingsPassMsg" class="settings-msg" hidden></p>
        </div>
      `,
      );

      tab.querySelector('#settingsPassBtn')?.addEventListener('click', async () => {
        const msg = tab.querySelector('#settingsPassMsg') as HTMLElement | null;
        const btn = tab.querySelector('#settingsPassBtn') as HTMLButtonElement | null;
        const cur =
          (tab.querySelector('#settingsCurPass') as HTMLInputElement | null)?.value || '';
        const neu =
          (tab.querySelector('#settingsNewPass') as HTMLInputElement | null)?.value || '';
        const neu2 =
          (tab.querySelector('#settingsNewPass2') as HTMLInputElement | null)?.value || '';
        if (!cur || !neu) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'Fill current and new password';
          }
          return;
        }
        if (neu.length < 8) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'New password must be at least 8 characters';
          }
          return;
        }
        if (neu !== neu2) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'New passwords do not match';
          }
          return;
        }
        if (btn) btn.disabled = true;
        try {
          const token = getAccessToken();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const res = await fetch('/users/password', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              currentPassword: cur,
              newPassword: neu,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
                'Password update failed',
            );
          }
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'Password updated';
          }
          ['#settingsCurPass', '#settingsNewPass', '#settingsNewPass2'].forEach((sel) => {
            const el = tab.querySelector(sel) as HTMLInputElement | null;
            if (el) el.value = '';
          });
        } catch (e: any) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = e?.message || 'Password update failed';
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    };

    const openSessionsTab = async () => {
      showTab(
        'Active sessions',
        `
        <div class="settings-form">
          <p class="settings-sub" id="settingsSessionsHint">Loading devices…</p>
          <div id="settingsSessionsList" class="settings-sessions-list"></div>
          <button type="button" id="settingsLogoutAllBtn" class="settings-save-btn settings-danger-btn">
            Log out all devices
          </button>
          <p id="settingsSessionsMsg" class="settings-msg" hidden></p>
        </div>
      `,
      );

      const listEl = tab.querySelector('#settingsSessionsList') as HTMLElement | null;
      const hint = tab.querySelector('#settingsSessionsHint') as HTMLElement | null;
      const msg = tab.querySelector('#settingsSessionsMsg') as HTMLElement | null;

      const loadSessions = async () => {
        try {
          const token = getAccessToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const res = await fetch('/auth/session', {
            headers,
            credentials: 'include',
            cache: 'no-store',
          });
          const data = await res.json().catch(() => ([]));
          if (!res.ok) throw new Error(data.message || 'Failed to load sessions');
          const rows = Array.isArray(data)
            ? data
            : data.sessions || data.items || data.data || [];
          if (hint) {
            hint.textContent = rows.length
              ? `${rows.length} active session(s)`
              : 'No active sessions found';
          }
          if (!listEl) return;
          if (!rows.length) {
            listEl.innerHTML = `<p class="settings-sub">Nothing here yet.</p>`;
            return;
          }
          listEl.innerHTML = rows
            .map((s: any, i: number) => {
              const id = String(s._id || s.sessionId || s.id || i);
              const device = s.device || s.userAgent || s.ua || 'Unknown device';
              const created =
                s.createdAt || s.lastActiveAt || s.updatedAt
                  ? new Date(s.createdAt || s.lastActiveAt || s.updatedAt).toLocaleString()
                  : '';
              const revoked = s.revokedAt ? ' (revoked)' : '';
              return `<div class="settings-session-row" data-id="${escapeHtml(id)}">
                <div>
                  <strong>${escapeHtml(String(device).slice(0, 80))}</strong>
                  <small>${escapeHtml(created)}${revoked}</small>
                </div>
                ${
                  s.revokedAt
                    ? ''
                    : `<button type="button" class="settings-session-revoke" data-id="${escapeHtml(id)}">Revoke</button>`
                }
              </div>`;
            })
            .join('');

          listEl.querySelectorAll('.settings-session-revoke').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = (btn as HTMLElement).dataset.id;
              if (!id) return;
              try {
                const token = getAccessToken();
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                };
                if (token) headers['Authorization'] = 'Bearer ' + token;
                const res = await fetch('/auth/logout-session', {
                  method: 'POST',
                  headers,
                  credentials: 'include',
                  body: JSON.stringify({ sessionId: id }),
                });
                const d = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(d.message || 'Revoke failed');
                await loadSessions();
              } catch (e: any) {
                if (msg) {
                  msg.hidden = false;
                  msg.textContent = e?.message || 'Revoke failed';
                }
              }
            });
          });
        } catch (e: any) {
          if (hint) hint.textContent = e?.message || 'Could not load sessions';
        }
      };

      void loadSessions();

      tab.querySelector('#settingsLogoutAllBtn')?.addEventListener('click', async () => {
        if (msg) {
          msg.hidden = false;
          msg.textContent = 'Signing out all devices…';
        }
        try {
          const token = getAccessToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = 'Bearer ' + token;
          const res = await fetch('/auth/logout-all', {
            method: 'POST',
            headers,
            credentials: 'include',
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.message || 'Failed');
          // This device is also logged out
          location.replace('/login.html');
        } catch (e: any) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = e?.message || 'Failed';
          }
        }
      });
    };


    const openPrivacyTab = () => {
      const lastSeenOn = localStorage.getItem('chat_privacy_last_seen') !== '0';
      const receiptsOn = localStorage.getItem('chat_privacy_read_receipts') !== '0';
      showTab(
        'Privacy',
        `
        <div class="settings-form">
          <button type="button" class="settings-switch-row" id="privacyLastSeenBtn">
            <span class="settings-switch-label">
              <strong>Last seen</strong>
              <small>Show when you were last online</small>
            </span>
            <span class="settings-switch ${lastSeenOn ? 'on' : ''}" id="privacyLastSeenToggle"></span>
          </button>
          <button type="button" class="settings-switch-row" id="privacyReceiptsBtn">
            <span class="settings-switch-label">
              <strong>Read receipts</strong>
              <small>Send seen ticks on messages you open</small>
            </span>
            <span class="settings-switch ${receiptsOn ? 'on' : ''}" id="privacyReceiptsToggle"></span>
          </button>
          <p class="settings-sub">Preferences are saved on this device.</p>
        </div>
      `,
      );

      const bindToggle = (
        btnId: string,
        toggleId: string,
        key: string,
      ) => {
        tab.querySelector('#' + btnId)?.addEventListener('click', () => {
          const el = tab.querySelector('#' + toggleId) as HTMLElement | null;
          const next = !(el && el.classList.contains('on'));
          if (el) el.classList.toggle('on', next);
          localStorage.setItem(key, next ? '1' : '0');
          (window as any).__privacy = {
            ...((window as any).__privacy || {}),
            lastSeen: localStorage.getItem('chat_privacy_last_seen') !== '0',
            readReceipts:
              localStorage.getItem('chat_privacy_read_receipts') !== '0',
          };
        });
      };
      bindToggle('privacyLastSeenBtn', 'privacyLastSeenToggle', 'chat_privacy_last_seen');
      bindToggle(
        'privacyReceiptsBtn',
        'privacyReceiptsToggle',
        'chat_privacy_read_receipts',
      );
      (window as any).__privacy = {
        lastSeen: lastSeenOn,
        readReceipts: receiptsOn,
      };
    };

    const openNotificationsTab = () => {
      const supported =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator;
      const perm =
        supported && Notification.permission
          ? Notification.permission
          : 'unsupported';
      const enabled = localStorage.getItem('chat_push_enabled') === '1';

      showTab(
        'Notifications',
        `
        <div class="settings-form">
          <p class="settings-sub">Browser permission: <strong id="pushPermLabel">${escapeHtml(String(perm))}</strong></p>
          <button type="button" class="settings-switch-row" id="settingsPushRow">
            <span class="settings-switch-label">
              <strong>Push notifications</strong>
              <small>Alerts when you are away</small>
            </span>
            <span class="settings-switch ${enabled ? 'on' : ''}" id="settingsPushToggle"></span>
          </button>
          <p id="settingsPushMsg" class="settings-msg" hidden></p>
        </div>
      `,
      );

      tab.querySelector('#settingsPushRow')?.addEventListener('click', async () => {
        const msg = tab.querySelector('#settingsPushMsg') as HTMLElement | null;
        const toggle = tab.querySelector('#settingsPushToggle') as HTMLElement | null;
        const currentlyOn = toggle?.classList.contains('on');
        try {
          if (currentlyOn) {
            localStorage.setItem('chat_push_enabled', '0');
            toggle?.classList.remove('on');
            if (msg) {
              msg.hidden = false;
              msg.textContent = 'Push disabled on this device';
            }
          } else {
            if (!supported) throw new Error('Push not supported in this browser');
            const nextPerm = await Notification.requestPermission();
            const label = tab.querySelector('#pushPermLabel');
            if (label) label.textContent = nextPerm;
            if (nextPerm !== 'granted') throw new Error('Permission not granted');
            if (typeof (window as any).registerPush === 'function') {
              await (window as any).registerPush();
            } else if (typeof (window as any).__registerPush === 'function') {
              await (window as any).__registerPush();
            }
            localStorage.setItem('chat_push_enabled', '1');
            toggle?.classList.add('on');
            if (msg) {
              msg.hidden = false;
              msg.textContent = 'Push enabled';
            }
          }
        } catch (e: any) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = e?.message || 'Could not update push';
          }
        }
      });
    };

    wrap.querySelectorAll('.settings-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.tab;
        const d=wrap.querySelector('#settingsHome') as HTMLFormElement
        d.style.display='none'
                if (key === 'profile') openProfileTab();
        else if (key === 'password') openPasswordTab();
        else if (key === 'sessions') void openSessionsTab();
        else if (key === 'notifications') openNotificationsTab();
        else if (key === 'privacy') openPrivacyTab();
      });
    });

    wrap.querySelector('#settingsLogoutBtn')?.addEventListener('click', async () => {
      const refreshTok =
        (window as any).__authMemory?.refreshToken ||
        localStorage.getItem('refreshToken') ||
        '';
      const accessTok = getAccessToken();
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(accessTok ? { Authorization: 'Bearer ' + accessTok } : {}),
          },
          body: JSON.stringify({ refreshToken: refreshTok }),
        });
      } catch {}
      try {
        socket?.disconnect?.();
      } catch {}
      aToken = '';
      try {
        if (typeof (window as any).__markLoggedOut === 'function') {
          (window as any).__markLoggedOut();
        }
      } catch {}
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('chat_has_session');
        localStorage.removeItem('chat_user_cache');
        localStorage.removeItem('chat_cache_conversations');
        sessionStorage.clear();
      } catch {}
      try {
        (window as any).__authMemory = null;
        (window as any).__sessionReady = false;
      } catch {}
      location.replace('/login.html');
    });
  }


  bottomListSVG.forEach((element) => {
    element.addEventListener("click", () => {
      try { clearMainPanels(); } catch {}
      if (element.style.color != "rgb(97, 50, 219)") {
        element.style.color = "rgb(97, 50, 219)";
        bottomListSVG.forEach((elem) => {
          if (elem.style.color == "rgb(97, 50, 219)") {
            elem.style.color = "#f5f7fa";
          }
        });
        element.style.color = "rgb(97, 50, 219)";
      }
      let main = $.querySelectorAll<HTMLElement>("main>.conv,main>.call,main>.empty-state,main>.settings-card,main>.settings-panel,main>.ai-panel,main>.contact-row,main>.contacts-wrap,#chatPage");
      let topUl = $.getElementById("topList") as HTMLElement;
      switch (true) {
        case element.className == "fa-regular fa-phone":
          pageL = 1;
          main.forEach((e) => {
            e.remove();
          });
          topUl.innerHTML = `<li class="activeLI">All</li>
                <li>Incoming</li>
                <li>Outgoing</li>
                <li>Missed</li>`;
          void loadCallLogs().then(() => {
            renderCallList(calls);
            topEvent();
          });

          let ad = $.querySelector("button") as HTMLElement;
          ad?.addEventListener("click", () => {
            let clId = $.createElement("input");
            clId.setAttribute("autocomplete", "off");
            clId.setAttribute("autocorrect", "off");
            clId.setAttribute("autocapitalize", "off");
            clId.setAttribute("spellcheck", "false");
            clId.style.zIndex = "10";
            clId.style.position = "fixed";
            clId.style.top = "50%";
            clId.style.left = "50%";
            $.querySelector("main")?.appendChild(clId);

            clId.addEventListener("change", () => {
              let n = Number(clId.value);
              if (n != undefined && !isNaN(n)) {
                startCall(n);
                clId.remove();
              }
            });
          });
          break;

        case element.className == "fa-regular fa-message":
          pageL = 0;
          main.forEach((e) => {
            e.remove();
          });
          topUl.innerHTML = `<li class="activeLI">All</li>
                <li>Unread</li>
                <li>Personal</li>
                <li>Groups</li>
                <li>Chanells</li>`;
          convFilter = 'all';
          convSearchQ = '';
          try {
            if (searcheInput) searcheInput.value = '';
          } catch {}
          void Promise.resolve(hel()).then(() => {
            try {
              topEvent();
            } catch {}
          });
          break;

        case element.className == "fa-regular fa-address-book":
          pageL = 2;
          main.forEach((e) => {
            e.remove();
          });
          topUl.innerHTML = `<li class="activeLI">Recent</li>
                <li>All</li>`;
          void loadContacts('recent');
          // top filters for contacts
          setTimeout(() => {
            const tpI = document.querySelectorAll<HTMLElement>('#topList>li');
            tpI.forEach((li) => {
              li.addEventListener('click', () => {
                document.querySelector('#topList .activeLI')?.classList.remove('activeLI');
                li.className = 'activeLI';
                const tab = li.textContent?.trim() === 'All' ? 'all' : 'recent';
                void loadContacts(tab as 'recent' | 'all');
              });
            });
          }, 0);
          break;

        case element.className == "fa-regular fa-gear":
          pageL = 4;
          main.forEach((e) => {
            e.remove();
          });
          topUl.innerHTML = `<li class="activeLI">Settings</li>`;
          renderSettings();
          break;

        case element.className == "fa-regular fa-microchip-ai":
          pageL = 3;
          main.forEach((e) => {
            e.remove();
          });
          topUl.innerHTML = `<li class="activeLI">Assistant</li>`;
          renderAI();
          break;
      }
    });
  });
}

initi();
