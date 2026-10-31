// This static project uses a demo sign-in flow, not server authentication.
// Only demo session metadata is saved; passwords are never stored.
function loginPage() {
    const DEMO_EMAIL = 'demo@focus.test';
    const DEMO_PASSWORD = 'Focus@123';
    const SESSION_KEY = 'productivityDemoSession';
    const SESSION_DURATION = 8 * 60 * 60 * 1000;
    const dashboard = document.querySelector('#main');
    const loginView = document.querySelector('.login-view');
    const form = document.querySelector('.login-form');
    const email = document.querySelector('#login-email');
    const password = document.querySelector('#login-password');
    const emailError = document.querySelector('#login-email-error');
    const passwordError = document.querySelector('#login-password-error');
    const formError = document.querySelector('.login-error');
    const status = document.querySelector('.login-status');
    const submit = document.querySelector('.login-submit');
    const togglePassword = document.querySelector('.toggle-password');

    function setError(input, messageElement, message) {
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        messageElement.textContent = message;
        messageElement.hidden = !message;
    }

    function clearErrors() {
        setError(email, emailError, '');
        setError(password, passwordError, '');
        formError.textContent = '';
        formError.hidden = true;
        status.textContent = '';
    }

    function hidePassword() {
        password.type = 'password';
        togglePassword.textContent = 'Show';
        togglePassword.setAttribute('aria-label', 'Show password');
        togglePassword.setAttribute('aria-pressed', 'false');
    }

    function readSession() {
        try {
            const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
            const now = Date.now();
            if (session?.mode === 'demo' && session.email === DEMO_EMAIL
                && Number.isFinite(session.createdAt) && Number.isFinite(session.expiresAt)
                && session.createdAt <= now && session.expiresAt > now
                && session.expiresAt === session.createdAt + SESSION_DURATION) return session;
        } catch {
            // Sign-in remains available if a saved session cannot be read.
        }
        return null;
    }

    function showDashboard(focusHeading = false) {
        loginView.hidden = true;
        dashboard.hidden = false;
        document.title = 'Productivity Dashboard';
        form.reset();
        clearErrors();
        hidePassword();
        if (focusHeading) {
            window.scrollTo(0, 0);
            document.querySelector('.dashboard-header h1').focus();
        }
    }

    function showLogin(focusEmail = false) {
        dashboard.hidden = true;
        loginView.hidden = false;
        document.title = 'Login | Productivity Dashboard';
        form.reset();
        clearErrors();
        hidePassword();
        if (focusEmail) {
            window.scrollTo(0, 0);
            email.focus();
        }
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErrors();
        const emailValue = email.value.trim().toLowerCase();
        const passwordValue = password.value;
        let valid = true;

        if (!emailValue) {
            setError(email, emailError, 'Enter your email address.');
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            setError(email, emailError, 'Enter a valid email address.');
            valid = false;
        }
        if (!passwordValue) {
            setError(password, passwordError, 'Enter the demo password.');
            valid = false;
        }
        if (!valid) {
            (emailError.hidden ? password : email).focus();
            return;
        }
        if (emailValue !== DEMO_EMAIL || passwordValue !== DEMO_PASSWORD) {
            formError.textContent = 'Use the demo account below. Click “Fill details” to try it.';
            formError.hidden = false;
            password.focus();
            return;
        }

        submit.disabled = true;
        try {
            const createdAt = Date.now();
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                mode: 'demo', email: DEMO_EMAIL, createdAt,
                expiresAt: createdAt + SESSION_DURATION
            }));
            showDashboard(true);
        } catch {
            formError.textContent = 'Allow browser storage to start the demo session, then try again.';
            formError.hidden = false;
        } finally {
            submit.disabled = false;
        }
    });

    email.addEventListener('input', clearErrors);
    password.addEventListener('input', clearErrors);
    togglePassword.addEventListener('click', function () {
        const show = password.type === 'password';
        password.type = show ? 'text' : 'password';
        togglePassword.textContent = show ? 'Hide' : 'Show';
        togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        togglePassword.setAttribute('aria-pressed', String(show));
    });

    document.querySelector('.fill-demo').addEventListener('click', function () {
        email.value = DEMO_EMAIL;
        password.value = DEMO_PASSWORD;
        clearErrors();
        status.textContent = 'Demo details filled. You are ready to sign in.';
        submit.focus();
    });

    document.querySelector('.login-theme-button').addEventListener('click', function () {
        document.querySelector('.change-theme').click();
    });

    document.querySelector('.logout-button').addEventListener('click', function () {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch {
            // The visible demo session can still be closed if storage is blocked.
        }
        document.querySelector('.reset-timer').click();
        document.querySelectorAll('.fullElem').forEach((page) => { page.style.display = 'none'; });
        document.querySelector('.dashboard-home').hidden = false;
        showLogin(true);
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && !dashboard.hidden && !readSession()) showLogin();
    });

    if (readSession()) showDashboard();
    else showLogin();
}
loginPage();
