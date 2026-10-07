"use strict";
/**
 * Login / Register page
 * After success: store tokens, optional push, redirect to main app.
 */
let accessToken = '';
const $ = document;
const main = $.querySelector('main');
const header = $.querySelector('header');
const footer = $.querySelector('footer');
function ensureErrorEl() {
    let el = $.getElementById('formError');
    if (!el && main) {
        el = $.createElement('div');
        el.id = 'formError';
        el.className = 'form-error';
        el.hidden = true;
        main.insertBefore(el, main.firstChild);
    }
    return el;
}
function showError(message) {
    const el = ensureErrorEl();
    if (!message) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = message;
}
function clearError() {
    showError('');
}
function persistTokens(access, refresh) {
    if (typeof window.__persistSession === 'function') {
        window.__persistSession({ accessToken: access, refreshToken: refresh }, undefined);
    }
    else {
        try {
            localStorage.setItem('accessToken', access);
            if (refresh)
                localStorage.setItem('refreshToken', refresh);
            localStorage.setItem('chat_has_session', '1');
        }
        catch {
            /* */
        }
    }
    if (typeof window.__markLoggedIn === 'function') {
        window.__markLoggedIn({
            accessToken: access,
            refreshToken: refresh,
        });
    }
}
async function tryRegisterPush(token) {
    const fn = typeof window.__registerPush === 'function'
        ? window.__registerPush
        : null;
    if (!fn || !token)
        return;
    try {
        await fn(token);
    }
    catch (e) {
    }
}
async function doLogin(userName, password) {
    const loginResponse = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            userName,
            password,
            device: 'web',
        }),
    });
    const data = await loginResponse.json().catch(() => ({}));
    if (!loginResponse.ok) {
        throw new Error(data.message || data.error || `Login failed (${loginResponse.status})`);
    }
    const access = data.accessToken || data.access_token || data.tokens?.accessToken || '';
    const refresh = data.refreshToken || data.refresh_token || data.tokens?.refreshToken || '';
    if (!access) {
        throw new Error('No access token in login response');
    }
    accessToken = access;
    persistTokens(access, refresh);
    await tryRegisterPush(access);
    window.location.href = '/';
}
function login() {
    const signinButton = $.querySelector('#signinCon>button');
    const userNameInp = $.querySelector('#userNameInp');
    const passwordInp = $.querySelector('#passwordInp');
    if (!signinButton || !userNameInp || !passwordInp) {
        return;
    }
    const fresh = signinButton.cloneNode(true);
    signinButton.parentNode?.replaceChild(fresh, signinButton);
    const submit = async () => {
        clearError();
        const userName = userNameInp.value.trim();
        const password = passwordInp.value;
        if (!userName || !password) {
            showError('Username and password are required');
            return;
        }
        try {
            fresh.disabled = true;
            fresh.textContent = 'Signing in…';
            await doLogin(userName, password);
        }
        catch (err) {
            showError(err?.message || 'Network error');
        }
        finally {
            fresh.disabled = false;
            fresh.textContent = 'Sign In';
        }
    };
    fresh.addEventListener('click', () => void submit());
    passwordInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            void submit();
    });
    userNameInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            passwordInp.focus();
    });
}
function register() {
    const subCon = $.querySelector('#SubCon');
    const dataCon = $.querySelector('#dataCon');
    if (!subCon || !dataCon) {
        return;
    }
    let step = 1;
    let draft = {
        displayName: '',
        username: '',
        password: '',
    };
    let usernameCheckTimer = null;
    const setUsernameStatus = (text, ok) => {
        const statusEl = $.querySelector('#usernameStatus');
        if (!statusEl)
            return;
        if (!text) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            return;
        }
        statusEl.hidden = false;
        statusEl.textContent = text;
        statusEl.className =
            'username-status ' +
                (ok === true ? 'ok' : ok === false ? 'bad' : 'pending');
    };
    const bindUsernameCheck = (userInp) => {
        userInp.addEventListener('input', () => {
            const raw = userInp.value.trim();
            if (!raw) {
                setUsernameStatus('', null);
                return;
            }
            if (!/^[a-zA-Z0-9_]{3,24}$/.test(raw)) {
                setUsernameStatus('3–24 chars: letters, numbers, underscore', false);
                return;
            }
            setUsernameStatus('Checking…', null);
            if (usernameCheckTimer)
                clearTimeout(usernameCheckTimer);
            usernameCheckTimer = setTimeout(async () => {
                try {
                    const res = await fetch('/users/check-username?u=' + encodeURIComponent(raw));
                    const data = await res.json();
                    if (data.available)
                        setUsernameStatus('Username is available', true);
                    else
                        setUsernameStatus('Username is taken', false);
                }
                catch {
                    setUsernameStatus('Could not check username', null);
                }
            }, 350);
        });
    };
    const showStep1 = () => {
        step = 1;
        setUsernameStatus('', null);
        dataCon.innerHTML = `
      <input type="text" id="displayNameInp" placeholder="Display name" autocomplete="off" maxlength="40" value="${draft.displayName.replace(/"/g, '&quot;')}" />
      <input type="text" id="userNameInp" placeholder="Username (unique)" autocomplete="off" maxlength="24" value="${draft.username.replace(/"/g, '&quot;')}" />
      <input type="password" id="passInp" placeholder="Password (min 8)" autocomplete="off" />
      <input type="password" id="passAgainInp" placeholder="Confirm password" autocomplete="off" />
    `;
        subCon.className = '';
        subCon.innerHTML = `<button type="button" class="primary" id="regNextBtn">Continue</button>`;
        const hint = $.querySelector('.hint');
        if (hint)
            hint.textContent = 'Step 1 of 2 — username is unique and used to log in';
        const header = $.querySelector('header');
        if (header)
            header.innerHTML = `<h1>Create account</h1><p>Name, username & password</p>`;
        const userInp = $.getElementById('userNameInp');
        if (userInp)
            bindUsernameCheck(userInp);
        $.getElementById('regNextBtn')?.addEventListener('click', () => {
            clearError();
            const displayName = $.getElementById('displayNameInp')?.value?.trim() || '';
            const username = $.getElementById('userNameInp')?.value?.trim() || '';
            const password = $.getElementById('passInp')?.value || '';
            const password2 = $.getElementById('passAgainInp')?.value || '';
            if (!displayName)
                return showError('Display name is required');
            if (!username || !password)
                return showError('Username and password are required');
            if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
                return showError('Username: 3–24 characters, letters, numbers, underscore');
            }
            if (password.length < 8)
                return showError('Password must be at least 8 characters');
            if (password !== password2)
                return showError('Passwords do not match');
            draft = { displayName, username, password };
            showStep2();
        });
    };
    const showStep2 = () => {
        step = 2;
        setUsernameStatus('', null);
        dataCon.innerHTML = `
      <div class="avatar-picker">
        <img id="avatarPreview" class="avatar-picker-preview" src="/assets/static/image/wallpaperflare.com_wallpaper (4).jpg" alt="" />
        <label for="avatarInp">Add profile photo</label>
        <input type="file" id="avatarInp" accept="image/*" />
      </div>
      <textarea id="bioInp" placeholder="Bio (optional)" maxlength="160" rows="3"></textarea>
    `;
        subCon.className = 'has-back';
        subCon.innerHTML = `
      <button type="button" class="secondary" id="regBackBtn">Back</button>
      <button type="button" class="primary" id="regCreateBtn">Create account</button>
    `;
        const hint = $.querySelector('.hint');
        if (hint)
            hint.textContent = 'Step 2 of 2 — photo and bio are optional';
        const header = $.querySelector('header');
        if (header)
            header.innerHTML = `<h1>Your profile</h1><p>Photo & bio (optional)</p>`;
        const avatarInp = $.getElementById('avatarInp');
        const avatarPreview = $.getElementById('avatarPreview');
        avatarInp?.addEventListener('change', () => {
            const f = avatarInp.files?.[0];
            if (!f || !avatarPreview)
                return;
            avatarPreview.src = URL.createObjectURL(f);
        });
        $.getElementById('regBackBtn')?.addEventListener('click', () => {
            clearError();
            showStep1();
        });
        $.getElementById('regCreateBtn')?.addEventListener('click', () => void submitRegister());
    };
    const submitRegister = async () => {
        clearError();
        const bio = $.getElementById('bioInp')?.value?.trim() || '';
        const avatarInp = $.getElementById('avatarInp');
        const file = avatarInp?.files?.[0];
        const btn = $.getElementById('regCreateBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Creating…';
        }
        try {
            const fd = new FormData();
            fd.append('username', draft.username);
            fd.append('displayName', draft.displayName);
            fd.append('password', draft.password);
            if (bio)
                fd.append('bio', bio);
            if (file)
                fd.append('avatar', file);
            const res = await fetch('/users/register', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
                    data.error ||
                    'Registration failed';
                throw new Error(typeof msg === 'string' ? msg : 'Registration failed');
            }
            const toggle = $.getElementById('authToggle');
            if (toggle) {
                toggle.textContent = 'Login';
                toggle.click();
                setTimeout(() => {
                    const u = $.getElementById('userNameInp');
                    if (u)
                        u.value = draft.username;
                    clearError();
                    const hint = $.getElementById('formError');
                    if (hint) {
                        hint.hidden = false;
                        hint.style.background = 'rgba(34, 197, 94, 0.12)';
                        hint.style.borderColor = 'rgba(34, 197, 94, 0.35)';
                        hint.style.color = '#86efac';
                        hint.textContent = 'Account created — sign in with your username';
                    }
                }, 50);
            }
        }
        catch (e) {
            showError(e?.message || 'Registration failed');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Create account';
            }
        }
    };
    // initial step 1 bindings
    const userInp0 = $.getElementById('userNameInp');
    if (userInp0)
        bindUsernameCheck(userInp0);
    $.getElementById('regNextBtn')?.addEventListener('click', () => {
        clearError();
        const displayName = $.getElementById('displayNameInp')?.value?.trim() || '';
        const username = $.getElementById('userNameInp')?.value?.trim() || '';
        const password = $.getElementById('passInp')?.value || '';
        const password2 = $.getElementById('passAgainInp')?.value || '';
        if (!displayName)
            return showError('Display name is required');
        if (!username || !password)
            return showError('Username and password are required');
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
            return showError('Username: 3–24 characters, letters, numbers, underscore');
        }
        if (password.length < 8)
            return showError('Password must be at least 8 characters');
        if (password !== password2)
            return showError('Passwords do not match');
        draft = { displayName, username, password };
        showStep2();
    });
}
function bindAuthToggle() {
    const span = $.getElementById('authToggle') ||
        footer.querySelector('p>span');
    if (!span)
        return;
    const fresh = span.cloneNode(true);
    if (span.id)
        fresh.id = span.id;
    span.parentNode?.replaceChild(fresh, span);
    fresh.addEventListener('click', () => {
        clearError();
        const mode = (fresh.textContent || '').trim().toLowerCase();
        if (mode === 'login') {
            main.setAttribute('id', 'login');
            main.innerHTML = `
        <div id="formError" class="form-error" hidden></div>
        <div id="DataCon">
          <input type="text" id="userNameInp" placeholder="Username" autocomplete="off" />
          <input type="password" id="passwordInp" placeholder="Password" autocomplete="off" />
        </div>
        <div id="forgotCon">
          <p>Forgot password?</p>
        </div>
        <div id="signinCon">
          <button type="button">Sign In</button>
        </div>
        <div id="orCon">
          <p>Or continue with</p>
          <div>
            <button type="button" disabled title="Coming soon"><span><i class="fa-brands fa-google"></i></span></button>
            <button type="button" disabled title="Coming soon"><span><i class="fa-brands fa-facebook"></i></span></button>
            <button type="button" disabled title="Coming soon"><span><i class="fa-brands fa-telegram"></i></span></button>
          </div>
        </div>`;
            header.innerHTML = `<h1>Welcome back</h1><p>Sign in to continue</p>`;
            footer.innerHTML = `<p>Don't have an account? <span id="authToggle">Register</span></p>`;
            login();
            bindAuthToggle();
        }
        else {
            main.setAttribute('id', 'signUp');
            main.innerHTML = `
        <div id="formError" class="form-error" hidden></div>
        <div id="dataCon">
          <input type="text" id="displayNameInp" placeholder="Display name" autocomplete="off" maxlength="40" />
          <input type="text" id="userNameInp" placeholder="Username (unique)" autocomplete="off" maxlength="24" />
          <input type="password" id="passInp" placeholder="Password (min 8)" autocomplete="off" />
          <input type="password" id="passAgainInp" placeholder="Confirm password" autocomplete="off" />
        </div>
        <div id="SubCon">
          <button type="button" class="primary" id="regNextBtn">Continue</button>
        </div>
        <p id="usernameStatus" class="username-status" hidden></p>
        <p class="hint">Step 1 of 2 — username is unique and used to log in</p>`;
            header.innerHTML = `<h1>Create account</h1><p>Name, username & password</p>`;
            footer.innerHTML = `<p>Already have an account? <span id="authToggle">Login</span></p>`;
            register();
            bindAuthToggle();
        }
    });
}
login();
bindAuthToggle();
