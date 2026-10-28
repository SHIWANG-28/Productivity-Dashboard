function openFeature(){
    var allElem = document.querySelectorAll(".elem");
    var fullElemPage = document.querySelectorAll(".fullElem");
    var fullElemPageBackButton = document.querySelectorAll(".fullElem .back");

    allElem.forEach((elem) => {
        elem.addEventListener('click', () => {
            fullElemPage[elem.id].style.display = "block";
       })
    })
    fullElemPageBackButton.forEach((back) => {
        back.addEventListener('click', () => {
            fullElemPage[back.id].style.display = "none";
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
