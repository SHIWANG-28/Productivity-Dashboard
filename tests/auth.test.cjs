const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
const SESSION_KEY = 'productivityDemoSession';
const TTL = 8 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 1, 8);

function setup({ session = null, blockedStorage = false } = {}) {
    const elements = new Map();
    const storage = new Map(session === null ? [] : [[SESSION_KEY, session]]);
    const pages = [{ style: { display: 'none' } }, { style: { display: 'block' } }];
    const events = {};
    let now = NOW;
    let focused = null;
    function query(selector) {
        if (!elements.has(selector)) elements.set(selector, {
            value: '', textContent: '', hidden: false, type: '', disabled: false,
            attributes: {}, listeners: {}, clicks: 0,
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, fn) { this.listeners[name] = fn; },
            focus() { focused = selector; },
            click() { this.clicks++; this.listeners.click?.(); }
        });
        return elements.get(selector);
    }
    query('.login-form').reset = () => {
        query('#login-email').value = '';
        query('#login-password').value = '';
    };
    const document = {
        hidden: false, title: '', querySelector: query, querySelectorAll: () => pages,
        addEventListener(name, fn) { events[name] = fn; }
    };
    vm.runInNewContext(source, {
        document, Date: { now: () => now }, window: { scrollTo() {} },
        sessionStorage: {
            getItem(key) {
                if (blockedStorage) throw new Error('Storage denied');
                return storage.get(key) ?? null;
            },
            setItem(key, value) {
                if (blockedStorage) throw new Error('Storage denied');
                storage.set(key, value);
            },
            removeItem(key) {
                if (blockedStorage) throw new Error('Storage denied');
                storage.delete(key);
            }
        }
    });
    return {
        query, storage, pages, document,
        get focused() { return focused; },
        submit(email = '', password = '') {
            query('#login-email').value = email;
            query('#login-password').value = password;
            query('.login-form').listeners.submit({ preventDefault() {} });
        },
        signIn() { this.submit('demo@focus.test', 'Focus@123'); },
        advance(ms) { now += ms; events.visibilitychange(); }
    };
}

test('the login screen appears first and the dashboard stays hidden', () => {
    const app = setup();
    assert.equal(app.query('#main').hidden, true);
    assert.equal(app.query('.login-view').hidden, false);
    assert.equal(app.document.title, 'Login | Productivity Dashboard');
});

test('empty fields show accessible errors and focus the first field', () => {
    const app = setup();
    app.submit();
    assert.equal(app.query('#login-email').attributes['aria-invalid'], 'true');
    assert.equal(app.query('#login-password').attributes['aria-invalid'], 'true');
    assert.equal(app.query('#login-email-error').hidden, false);
    assert.equal(app.focused, '#login-email');
    assert.equal(app.query('#main').hidden, true);
});

test('an invalid email is rejected before credentials are checked', () => {
    const app = setup();
    app.submit('invalid-email', 'Focus@123');
    assert.match(app.query('#login-email-error').textContent, /valid email/);
    assert.equal(app.storage.has(SESSION_KEY), false);
});

test('other credentials are rejected with guidance to use the demo account', () => {
    const app = setup();
    app.submit('someone@example.com', 'OtherPassword');
    assert.match(app.query('.login-error').textContent, /demo account/);
    assert.equal(app.query('.login-error').hidden, false);
    assert.equal(app.query('#main').hidden, true);
    assert.equal(app.storage.has(SESSION_KEY), false);
});

test('Fill details populates the demo fields and password visibility can be toggled', () => {
    const app = setup();
    app.query('.fill-demo').click();
    assert.equal(app.query('#login-email').value, 'demo@focus.test');
    assert.equal(app.query('#login-password').value, 'Focus@123');
    assert.equal(app.focused, '.login-submit');
    app.query('.toggle-password').click();
    assert.equal(app.query('#login-password').type, 'text');
    assert.equal(app.query('.toggle-password').attributes['aria-pressed'], 'true');
    app.query('.toggle-password').click();
    assert.equal(app.query('#login-password').type, 'password');
});

test('successful demo login saves only session metadata and clears the form', () => {
    const app = setup();
    app.submit(' DEMO@FOCUS.TEST ', 'Focus@123');
    assert.equal(app.query('#main').hidden, false);
    assert.equal(app.query('.login-view').hidden, true);
    assert.equal(app.document.title, 'Productivity Dashboard');
    const session = JSON.parse(app.storage.get(SESSION_KEY));
    assert.equal(session.expiresAt, NOW + TTL);
    assert.deepEqual(Object.keys(session).sort(), ['createdAt', 'email', 'expiresAt', 'mode']);
    assert.equal(app.query('#login-password').value, '');
    assert.equal(app.focused, '.dashboard-header h1');
});

test('a valid demo session restores the dashboard after refresh', () => {
    const app = setup({ session: JSON.stringify({
        mode: 'demo', email: 'demo@focus.test', createdAt: NOW - 1000, expiresAt: NOW - 1000 + TTL
    }) });
    assert.equal(app.query('#main').hidden, false);
    assert.equal(app.query('.login-view').hidden, true);
});

test('malformed, expired, and invalid session records keep the login screen visible', () => {
    for (const session of [
        'invalid JSON',
        JSON.stringify({ mode: 'demo', email: 'demo@focus.test', createdAt: NOW - TTL, expiresAt: NOW }),
        JSON.stringify({ mode: 'demo', email: 'demo@focus.test', createdAt: NOW + 1000, expiresAt: NOW + 1000 + TTL }),
        JSON.stringify({ mode: 'demo', email: 'someone@example.com', createdAt: NOW, expiresAt: NOW + TTL })
    ]) {
        const app = setup({ session });
        assert.equal(app.query('#main').hidden, true);
    }
});

test('logout removes the demo session, resets the timer, and returns to login', () => {
    const app = setup();
    app.signIn();
    app.query('.logout-button').click();
    assert.equal(app.storage.has(SESSION_KEY), false);
    assert.equal(app.query('#main').hidden, true);
    assert.equal(app.query('.login-view').hidden, false);
    assert.equal(app.query('.reset-timer').clicks, 1);
    assert.ok(app.pages.every(page => page.style.display === 'none'));
    assert.equal(app.query('.dashboard-home').hidden, false);
    assert.equal(app.focused, '#login-email');
});

test('blocked session storage reports a recoverable error without entering the dashboard', () => {
    const app = setup({ blockedStorage: true });
    app.signIn();
    assert.equal(app.query('#main').hidden, true);
    assert.match(app.query('.login-error').textContent, /browser storage/);
    assert.equal(app.query('.login-submit').disabled, false);
});

test('the login theme button uses the same theme switch as the dashboard', () => {
    const app = setup();
    app.query('.login-theme-button').click();
    assert.equal(app.query('.change-theme').clicks, 1);
});

test('returning to the tab after a demo session expires shows login again', () => {
    const app = setup();
    app.signIn();
    app.advance(TTL + 1);
    assert.equal(app.query('#main').hidden, true);
    assert.equal(app.query('.login-view').hidden, false);
});
