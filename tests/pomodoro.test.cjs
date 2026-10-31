const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const timerSource = source.slice(source.indexOf('function pomodoroTimer()'));

function setupTimer() {
    const elements = new Map();
    const intervals = new Map();
    let nextIntervalId = 0;

    for (const selector of [
        '.pomo-timer h1',
        '.pomo-timer .start-timer',
        '.pomo-timer .pause-timer',
        '.pomo-timer .reset-timer',
        '.pomodoro-timer-fullpage .session'
    ]) {
        elements.set(selector, {
            textContent: '',
            style: {},
            listeners: {},
            addEventListener(event, handler) {
                this.listeners[event] = handler;
            }
        });
    }

    vm.runInNewContext(timerSource, {
        document: { querySelector: (selector) => elements.get(selector) || null },
        setInterval(callback, delay) {
            const id = ++nextIntervalId;
            intervals.set(id, { callback, delay });
            return id;
        },
        clearInterval(id) {
            intervals.delete(id);
        }
    });

    return {
        intervals,
        timer: elements.get('.pomo-timer h1'),
        session: elements.get('.pomodoro-timer-fullpage .session'),
        click(button) {
            elements.get(`.pomo-timer .${button}-timer`).listeners.click();
        },
        tick(seconds = 1) {
            for (let second = 0; second < seconds; second++) {
                for (const interval of [...intervals.values()]) interval.callback();
            }
        }
    };
}

test('the timer session selector matches the HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /<section class="fullElem pomodoro-timer-fullpage">[\s\S]*?<h4 class="session">Work Session<\/h4>/);
});

test('starts idle at 25:00 in a work session', () => {
    const app = setupTimer();
    assert.equal(app.timer.textContent, '25:00');
    assert.equal(app.session.textContent, 'Work Session');
    assert.equal(app.session.style.backgroundColor, 'var(--green)');
    assert.equal(app.intervals.size, 0);
});

test('counts down once per second and formats minutes and seconds', () => {
    const app = setupTimer();
    app.click('start');
    assert.equal([...app.intervals.values()][0].delay, 1000);
    app.tick();
    assert.equal(app.timer.textContent, '24:59');
    app.tick(60);
    assert.equal(app.timer.textContent, '23:59');
});

test('repeated Start clicks keep one timer and preserve progress', () => {
    const app = setupTimer();
    app.click('start');
    app.tick(10);
    app.click('start');
    assert.equal(app.intervals.size, 1);
    assert.equal(app.timer.textContent, '24:50');
    app.tick();
    assert.equal(app.timer.textContent, '24:49');
});

test('Pause stops the timer and Start resumes the remaining time', () => {
    const app = setupTimer();
    app.click('start');
    app.tick(2);
    app.click('pause');
    app.tick(20);
    assert.equal(app.intervals.size, 0);
    assert.equal(app.timer.textContent, '24:58');
    app.click('start');
    app.tick();
    assert.equal(app.timer.textContent, '24:57');
});

test('finishing work prepares a five-minute break and stops', () => {
    const app = setupTimer();
    app.click('start');
    app.tick(1499);
    assert.equal(app.timer.textContent, '00:01');
    app.tick();
    assert.equal(app.timer.textContent, '05:00');
    assert.equal(app.session.textContent, 'Break');
    assert.equal(app.session.style.backgroundColor, 'var(--blue)');
    assert.equal(app.intervals.size, 0);
});

test('finishing a break prepares the next work session and stops', () => {
    const app = setupTimer();
    app.click('start');
    app.tick(1500);
    app.click('start');
    app.tick(299);
    assert.equal(app.timer.textContent, '00:01');
    app.tick();
    assert.equal(app.timer.textContent, '25:00');
    assert.equal(app.session.textContent, 'Work Session');
    assert.equal(app.session.style.backgroundColor, 'var(--green)');
    assert.equal(app.intervals.size, 0);
});

for (const phase of ['work', 'break']) {
    test(`Reset during ${phase} stops the timer and restores a work session`, () => {
        const app = setupTimer();
        app.click('start');
        if (phase === 'break') {
            app.tick(1500);
            app.click('start');
        }
        app.tick(10);
        app.click('reset');
        app.tick(10);
        assert.equal(app.timer.textContent, '25:00');
        assert.equal(app.session.textContent, 'Work Session');
        assert.equal(app.session.style.backgroundColor, 'var(--green)');
        assert.equal(app.intervals.size, 0);
        app.click('start');
        app.tick();
        assert.equal(app.timer.textContent, '24:59');
    });
}
