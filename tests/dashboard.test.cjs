const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const homeSource = source.slice(0, source.indexOf('function openFeature()'));
const flush = () => new Promise(setImmediate);
const sampleWeather = {
    current: { temperature_2m: 24.6, relative_humidity_2m: 62, is_day: 1,
        precipitation: 0.2, weather_code: 61, wind_speed_10m: 11.8 }
};

function element() {
    return {
        textContent: '', value: '', disabled: false, dataset: {}, attributes: {}, listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this.listeners[name] = listener; }
    };
}

function setupHome({ settings = {}, storageBlocked = false, fetchResponse } = {}) {
    const elements = new Map();
    const storage = new Map(Object.entries(settings));
    const intervals = [];
    const requests = [];
    const root = { dataset: {} };
    let now = new Date(2026, 9, 31, 23, 59, 59).getTime();
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    function query(selector) {
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
    }
    query('.city-search').querySelector = (selector) => query(`.city-search ${selector}`);
    vm.runInNewContext(homeSource, {
        document: { documentElement: root, querySelector: query, addEventListener() {} },
        Date: ClockDate, Intl, URLSearchParams, AbortController, setTimeout, clearTimeout,
        localStorage: {
            getItem(key) {
                if (storageBlocked) throw new Error('Storage denied');
                return storage.get(key) ?? null;
            },
            setItem(key, value) {
                if (storageBlocked) throw new Error('Storage denied');
                storage.set(key, value);
            }
        },
        setInterval(callback, delay) { intervals.push({ callback, delay }); },
        async fetch(url) {
            requests.push(new URL(url));
            if (fetchResponse) return fetchResponse(new URL(url));
            return { ok: true, json: async () => sampleWeather };
        }
    });
    return {
        query, root, storage, intervals, requests,
        clickTheme() { query('.change-theme').listeners.click(); },
        async searchCity(value) {
            query('.city-search input').value = value;
            query('.city-search').listeners.submit({ preventDefault() {} });
            await flush();
        },
        tick() {
            now += 1000;
            intervals.find((interval) => interval.delay === 1000).callback();
        }
    };
}

test('Change theme cycles through all five palettes and saves the selection', async () => {
    const app = setupHome();
    assert.equal(app.root.dataset.theme, 'espresso');
    for (const theme of ['sage', 'midnight', 'lavender', 'rose', 'espresso']) {
        app.clickTheme();
        assert.equal(app.root.dataset.theme, theme);
        assert.equal(JSON.parse(app.storage.get('dashboardTheme')), theme);
        assert.ok(app.query('.change-theme').attributes['aria-label'].includes('Next:'));
    }
    await flush();
});

test('restores the selected theme after reload and recovers from invalid saved settings', async () => {
    assert.equal(setupHome({ settings: { dashboardTheme: '"lavender"' } }).root.dataset.theme, 'lavender');
    assert.equal(setupHome({ settings: { dashboardTheme: '"unknown"', dashboardCity: 'invalid JSON' } }).root.dataset.theme, 'espresso');
    await flush();
});

test('theme switching and weather still work when browser storage is blocked', async () => {
    const app = setupHome({ storageBlocked: true });
    app.clickTheme();
    assert.equal(app.root.dataset.theme, 'sage');
    await flush();
    assert.equal(app.query('.temperature-value').textContent, 25);
});

test('the live clock updates seconds, AM/PM, weekday, and date across midnight', async () => {
    const app = setupHome();
    assert.equal(app.query('.live-time').textContent, '11:59:59');
    assert.equal(app.query('.clock-period').textContent, 'PM');
    assert.match(app.query('.live-date').textContent, /Saturday, 31 October 2026/);
    app.tick();
    assert.equal(app.query('.live-time').textContent, '12:00:00');
    assert.equal(app.query('.clock-period').textContent, 'AM');
    assert.match(app.query('.live-date').textContent, /Sunday, 1 November 2026/);
    await flush();
});

test('loads real weather fields with explicit units and schedules a 15-minute refresh', async () => {
    const app = setupHome();
    await flush();
    assert.equal(app.requests[0].hostname, 'api.open-meteo.com');
    assert.equal(app.requests[0].searchParams.get('latitude'), '23.2599');
    assert.equal(app.requests[0].searchParams.get('wind_speed_unit'), 'kmh');
    assert.equal(app.query('.temperature-value').textContent, 25);
    assert.equal(app.query('.weather-condition').textContent, 'Light rain');
    assert.equal(app.query('.weather-humidity').textContent, '62%');
    assert.equal(app.query('.weather-wind').textContent, '12 km/h');
    assert.equal(app.query('.weather-rain').textContent, '0.2 mm');
    assert.equal(app.query('.weather-icon use').attributes.href, '#icon-rain');
    assert.ok(app.intervals.some((interval) => interval.delay === 900000));
    assert.equal(app.query('.city-search button').disabled, false);
});

test('searches a city, fetches its weather, and restores that location after reload', async () => {
    const app = setupHome({ fetchResponse(url) {
        const data = url.hostname.startsWith('geocoding-')
            ? { results: [{ name: 'Jaipur', admin1: 'Rajasthan', latitude: 26.9196, longitude: 75.7878 }] }
            : sampleWeather;
        return { ok: true, json: async () => data };
    } });
    await flush();
    await app.searchCity(' Jaipur, India ');
    assert.equal(app.requests[1].searchParams.get('name'), 'Jaipur, India');
    assert.equal(app.requests[2].searchParams.get('latitude'), '26.9196');
    assert.equal(app.query('.weather-location').textContent, 'Jaipur, Rajasthan');
    assert.equal(app.query('.city-search input').value, '');
    const restored = setupHome({ settings: { dashboardCity: app.storage.get('dashboardCity') } });
    assert.equal(restored.requests[0].searchParams.get('latitude'), '26.9196');
    await flush();
});

test('a city that is not found preserves the current location and reports the problem', async () => {
    const app = setupHome({ fetchResponse(url) {
        return { ok: true, json: async () => url.hostname.startsWith('geocoding-') ? {} : sampleWeather };
    } });
    await flush();
    await app.searchCity('Unknownville');
    assert.equal(app.query('.weather-location').textContent, 'Bhopal, Madhya Pradesh');
    assert.equal(app.query('.temperature-value').textContent, 25);
    assert.match(app.query('.weather-message').textContent, /City not found/);
    assert.equal(app.query('.city-search button').disabled, false);
});

test('an unavailable weather service reports an error without inventing weather data', async () => {
    const app = setupHome({ fetchResponse: () => ({ ok: false }) });
    await flush();
    assert.equal(app.query('.temperature-value').textContent, '');
    assert.equal(app.query('.weather-condition').textContent, 'Weather unavailable');
    assert.match(app.query('.weather-message').textContent, /unavailable/);
    assert.equal(app.query('.city-search').attributes['aria-busy'], 'false');
    app.clickTheme();
    assert.equal(app.root.dataset.theme, 'sage');
});

test('rejects malformed weather data and invalid saved coordinates', async () => {
    const app = setupHome({
        settings: { dashboardCity: JSON.stringify({ name: 'Invalid', latitude: 999, longitude: 0 }) },
        fetchResponse: () => ({ ok: true, json: async () => ({ current: { temperature_2m: null } }) })
    });
    await flush();
    assert.equal(app.requests[0].searchParams.get('latitude'), '23.2599');
    assert.equal(app.query('.weather-condition').textContent, 'Weather unavailable');
});

test('uses a moon icon for a clear night and displays zero values correctly', async () => {
    const app = setupHome({ fetchResponse: () => ({ ok: true, json: async () => ({
        current: { temperature_2m: 0, relative_humidity_2m: 0, wind_speed_10m: 0,
            precipitation: 0, weather_code: 0, is_day: 0 }
    }) }) });
    await flush();
    assert.equal(app.query('.weather-icon use').attributes.href, '#icon-moon');
    assert.equal(app.query('.temperature-value').textContent, 0);
    assert.equal(app.query('.weather-wind').textContent, '0 km/h');
    assert.equal(app.query('.weather-rain').textContent, '0.0 mm');
});

test('all four tools open and Back restores the dashboard and keyboard focus', () => {
    const cards = Array.from({ length: 4 }, (_, index) => ({
        ...element(), dataset: { feature: index }, focus() { this.focused = true; }
    }));
    const pages = cards.map(() => ({ style: {} }));
    const backs = cards.map((card) => ({ ...element(), dataset: card.dataset }));
    const home = { hidden: false };
    vm.runInNewContext(source.slice(source.indexOf('function openFeature()'), source.indexOf('function todoList()')), {
        document: {
            querySelector: () => home,
            querySelectorAll: (selector) => ({ '.elem': cards, '.fullElem': pages, '.fullElem .back': backs })[selector]
        },
        window: { scrollTo() {} }
    });
    cards.forEach((card, index) => {
        card.listeners.click();
        assert.equal(home.hidden, true);
        assert.equal(pages[index].style.display, 'block');
        backs[index].listeners.click();
        assert.equal(pages[index].style.display, 'none');
        assert.equal(home.hidden, false);
        assert.equal(card.focused, true);
    });
});
