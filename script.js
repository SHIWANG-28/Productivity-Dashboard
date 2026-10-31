function dashboardHome() {
    const themes = [
        { id: 'espresso', name: 'Espresso' },
        { id: 'sage', name: 'Sage' },
        { id: 'midnight', name: 'Midnight' },
        { id: 'lavender', name: 'Lavender' },
        { id: 'rose', name: 'Rose' }
    ];
    const themeButton = document.querySelector('.change-theme');
    const themeName = document.querySelector('.theme-name');

    function readSetting(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch {
            return fallback;
        }
    }

    function saveSetting(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // The dashboard still works when browser storage is unavailable.
        }
    }

    const savedTheme = readSetting('dashboardTheme', 'espresso');
    let themeIndex = Math.max(0, themes.findIndex((theme) => theme.id === savedTheme));

    function applyTheme() {
        const theme = themes[themeIndex];
        const nextTheme = themes[(themeIndex + 1) % themes.length];
        document.documentElement.dataset.theme = theme.id;
        themeName.textContent = theme.name;
        const loginThemeButton = document.querySelector('.login-theme-button');
        if (loginThemeButton) loginThemeButton.setAttribute('aria-label', `Change theme. Current: ${theme.name}. Next: ${nextTheme.name}.`);
        themeButton.setAttribute('aria-label', `Change theme. Current: ${theme.name}. Next: ${nextTheme.name}.`);
        themeButton.title = `${theme.name} theme · Try ${nextTheme.name}`;
    }

    applyTheme();
    themeButton.addEventListener('click', function () {
        themeIndex = (themeIndex + 1) % themes.length;
        applyTheme();
        saveSetting('dashboardTheme', themes[themeIndex].id);
    });

    const dateElement = document.querySelector('.live-date');
    const timeElement = document.querySelector('.live-time');
    const periodElement = document.querySelector('.clock-period');
    const dateFormat = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const timeFormat = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    function updateClock() {
        const now = new Date();
        const parts = timeFormat.formatToParts(now);
        dateElement.textContent = dateFormat.format(now);
        timeElement.textContent = parts.filter((part) => ['hour', 'minute', 'second'].includes(part.type))
            .map((part) => part.value).join(':');
        timeElement.dateTime = now.toISOString();
        periodElement.textContent = parts.find((part) => part.type === 'dayPeriod').value;
    }

    updateClock();
    setInterval(updateClock, 1000);

    const defaultCity = { name: 'Bhopal, Madhya Pradesh', latitude: 23.2599, longitude: 77.4126 };
    const savedCity = readSetting('dashboardCity', defaultCity);
    let city = savedCity && typeof savedCity.name === 'string' && savedCity.name.trim()
        && Number.isFinite(savedCity.latitude) && Math.abs(savedCity.latitude) <= 90
        && Number.isFinite(savedCity.longitude) && Math.abs(savedCity.longitude) <= 180
        ? savedCity : defaultCity;
    const cityForm = document.querySelector('.city-search');
    const cityInput = cityForm.querySelector('input');
    const cityButton = cityForm.querySelector('button');
    const locationElement = document.querySelector('.weather-location');
    const temperatureElement = document.querySelector('.temperature-value');
    const conditionElement = document.querySelector('.weather-condition');
    const humidityElement = document.querySelector('.weather-humidity');
    const windElement = document.querySelector('.weather-wind');
    const rainElement = document.querySelector('.weather-rain');
    const weatherIcon = document.querySelector('.weather-icon use');
    const updatedElement = document.querySelector('.weather-updated');
    const weatherMessage = document.querySelector('.weather-message');
    let loadingWeather = false;
    let hasWeather = false;
    let lastWeatherUpdate = 0;
    locationElement.textContent = city.name;

    async function fetchJSON(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('Weather service unavailable. Please try again.');
            return await response.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    function describeWeather(code, isDay) {
        const conditions = {
            0: ['Clear sky', 'sun'], 1: ['Mostly clear', 'sun'],
            2: ['Partly cloudy', 'cloud'], 3: ['Overcast', 'cloud'],
            45: ['Foggy', 'cloud'], 48: ['Freezing fog', 'cloud'],
            51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
            56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
            61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
            66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
            71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'],
            77: ['Snow grains', 'snow'], 80: ['Light showers', 'rain'],
            81: ['Rain showers', 'rain'], 82: ['Heavy showers', 'rain'],
            85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'],
            95: ['Thunderstorm', 'storm'], 96: ['Thunderstorm with hail', 'storm'],
            99: ['Thunderstorm with hail', 'storm']
        };
        const [label, icon] = conditions[code] || ['Current conditions', 'cloud'];
        return { label, icon: (code === 0 || code === 1) && isDay === 0 ? 'moon' : icon };
    }

    async function updateWeather(search = '') {
        if (loadingWeather) return;
        loadingWeather = true;
        cityButton.disabled = true;
        cityForm.setAttribute('aria-busy', 'true');
        weatherMessage.textContent = search ? 'Finding your city...' : 'Updating weather...';

        try {
            let nextCity = city;
            if (search) {
                const query = new URLSearchParams({ name: search, count: '1', language: 'en', format: 'json' });
                const places = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?${query}`);
                const place = places.results?.[0];
                if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
                    throw new Error('City not found. Try a name like "Delhi, India".');
                }
                nextCity = {
                    name: [place.name, place.admin1 || place.country].filter(Boolean).join(', '),
                    latitude: place.latitude,
                    longitude: place.longitude
                };
            }

            const query = new URLSearchParams({
                latitude: String(nextCity.latitude), longitude: String(nextCity.longitude),
                current: 'temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m',
                temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
                timezone: 'auto', forecast_days: '1'
            });
            const data = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${query}`);
            const current = data.current;
            if (!current || !Number.isFinite(current.temperature_2m)) {
                throw new Error('Weather data is unavailable. Please try again.');
            }

            const weather = describeWeather(current.weather_code, current.is_day);
            temperatureElement.textContent = Math.round(current.temperature_2m);
            conditionElement.textContent = weather.label;
            humidityElement.textContent = Number.isFinite(current.relative_humidity_2m) ? `${Math.round(current.relative_humidity_2m)}%` : '--';
            windElement.textContent = Number.isFinite(current.wind_speed_10m) ? `${Math.round(current.wind_speed_10m)} km/h` : '--';
            rainElement.textContent = Number.isFinite(current.precipitation) ? `${current.precipitation.toFixed(1)} mm` : '--';
            weatherIcon.setAttribute('href', `#icon-${weather.icon}`);
            locationElement.textContent = nextCity.name;
            updatedElement.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
            weatherMessage.textContent = '';
            city = nextCity;
            hasWeather = true;
            lastWeatherUpdate = Date.now();
            saveSetting('dashboardCity', city);
            if (search) cityInput.value = '';
        } catch (error) {
            weatherMessage.textContent = error.name === 'AbortError'
                ? 'Weather request timed out. Please try again.'
                : error instanceof TypeError ? 'Weather is offline. Check your connection and try again.' : error.message;
            if (!hasWeather) {
                conditionElement.textContent = 'Weather unavailable';
                updatedElement.textContent = 'Search a city to try again';
            }
        } finally {
            loadingWeather = false;
            cityButton.disabled = false;
            cityForm.setAttribute('aria-busy', 'false');
        }
    }

    cityForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const search = cityInput.value.trim();
        if (search.length >= 2) updateWeather(search);
    });

    updateWeather();
    setInterval(() => updateWeather(), 15 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            updateClock();
            if (Date.now() - lastWeatherUpdate >= 15 * 60 * 1000) updateWeather();
        }
    });
}
dashboardHome();

function openFeature(){
    var allElem = document.querySelectorAll(".elem");
    var fullElemPage = document.querySelectorAll(".fullElem");
    var fullElemPageBackButton = document.querySelectorAll(".fullElem .back");
    var dashboard = document.querySelector('.dashboard-home');

    allElem.forEach((elem) => {
        elem.addEventListener('click', () => {
            dashboard.hidden = true;
            fullElemPage[elem.dataset.feature].style.display = "block";
            window.scrollTo(0, 0);
       })
    })
    fullElemPageBackButton.forEach((back) => {
        back.addEventListener('click', () => {
            fullElemPage[back.dataset.feature].style.display = "none";
            dashboard.hidden = false;
            allElem[back.dataset.feature].focus();
       })
   })  
}
openFeature();

function todoList(){
    var currentTask = []
if(localStorage.getItem('currentTask')){
    currentTask = JSON.parse(localStorage.getItem('currentTask'))
}




function renderTask(){
    let allTask = document.querySelector('.allTask')

    let sum = ''
    currentTask.forEach(function(elem,idx){
        sum = sum+`<div class="task">
                        <h5>${elem.task} <span class=${elem.imp}>imp</span></h5>
                        <button type="button" data-task-index="${idx}" class="${elem.completed ? 'completed' : ''}">${elem.completed ? 'Delete Task' : 'Mark as Done'}</button>
                        </div>`
    })

    allTask.innerHTML = sum
    localStorage.setItem('currentTask',JSON.stringify(currentTask))
}
renderTask()

let form = document.querySelector(".addTask form");
let taskInput = document.querySelector('.addTask form input[type="text"]');
let taskCheckbox = document.querySelector('.addTask form input[type="checkbox"]');
let taskDetailsInput = document.querySelector('.addTask form textarea');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    currentTask.push(
        {
            task: taskInput.value,
            details: taskDetailsInput.value,
            imp: taskCheckbox.checked,
            completed: false
        }
    )
    renderTask()
    taskInput.value=''
    taskDetailsInput.value=''
    taskCheckbox.checked = false
    console.log(currentTask)

})
var allTask = document.querySelector('.allTask')

allTask.addEventListener('click', function(event){
    var btn = event.target.closest('button[data-task-index]')
    if (!btn) return

    var taskIndex = Number(btn.dataset.taskIndex)
    if (currentTask[taskIndex].completed) {
        currentTask.splice(taskIndex, 1)
    } else {
        currentTask[taskIndex].completed = true
    }
    renderTask()
})

}
todoList()


// -----DAILY PLANNER----

function dailyPlanner() {
    var dayPlanData = JSON.parse(localStorage.getItem('dayPlanData')) || {};
    var dayPlanner = document.querySelector('.day-planner');

    var hours = Array.from({ length: 18 }, function (elem, idx) {
        return `${6 + idx}:00 - ${7 + idx}:00`;
    });

    var wholeDaySum = '';
    hours.forEach(function (elem, idx) {
        wholeDaySum = wholeDaySum + `
            <div class="day-planner-time">
                <p>${elem}</p>
                <input id="${idx}" type="text" placeholder="....">
            </div>`;
    });

    dayPlanner.innerHTML = wholeDaySum;

    var dayPlannerInput = document.querySelectorAll('.day-planner input');

    dayPlannerInput.forEach((elem) => {
        elem.value = dayPlanData[elem.id] || '';

        elem.addEventListener('input', function () {
            dayPlanData[elem.id] = elem.value;
            localStorage.setItem('dayPlanData', JSON.stringify(dayPlanData));
        });
    });

    var clearPlannerBtn = document.querySelector('.clear-planner');

    clearPlannerBtn.addEventListener('click', function () {
        dayPlanData = {};
        dayPlannerInput.forEach(function (elem) {
            elem.value = '';
        });
        localStorage.removeItem('dayPlanData');
    });
}

dailyPlanner();

async function fetchQuote(){
    const quoteElement = document.querySelector('.motivation2 h2');
    const authorElement = document.querySelector('.quote-author');
    quoteElement.textContent = 'Loading quote...';
    authorElement.textContent = '';

    try {
        const response = await fetch('https://dummyjson.com/quotes/random');

        if (!response.ok) {
            throw new Error(`Quote API returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data || typeof data.quote !== 'string' || !data.quote.trim()) {
            throw new Error('Quote API returned an invalid quote');
        }

        quoteElement.textContent = data.quote;
        const author = typeof data.author === 'string' ? data.author.trim() : '';
        authorElement.textContent = `— ${author || 'Unknown author'}`;
        console.log(data);
    } catch (error) {
        console.error('Could not fetch quote:', error);
        quoteElement.textContent = 'Unable to load a quote. Please refresh to try again.';
        authorElement.textContent = '';
    }
}
fetchQuote();


// ----------------Pomodoro Timer -------------------

function pomodoroTimer() {
    const timer = document.querySelector('.pomo-timer h1');
    const startBtn = document.querySelector('.pomo-timer .start-timer');
    const pauseBtn = document.querySelector('.pomo-timer .pause-timer');
    const resetBtn = document.querySelector('.pomo-timer .reset-timer');
    const session = document.querySelector('.pomodoro-timer-fullpage .session');
    let isWorkSession = true;
    let timerInterval = null;
    let totalSeconds = 25 * 60;

    function updateTimer() {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        session.textContent = isWorkSession ? 'Work Session' : 'Break';
        session.style.backgroundColor = isWorkSession ? 'var(--green)' : 'var(--blue)';
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function startTimer() {
        if (timerInterval !== null) return;

        timerInterval = setInterval(function () {
            totalSeconds--;

            if (totalSeconds === 0) {
                pauseTimer();
                isWorkSession = !isWorkSession;
                totalSeconds = isWorkSession ? 25 * 60 : 5 * 60;
            }

            updateTimer();
        }, 1000);
    }

    function resetTimer() {
        pauseTimer();
        isWorkSession = true;
        totalSeconds = 25 * 60;
        updateTimer();
    }

    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);
    updateTimer();
}
pomodoroTimer();
