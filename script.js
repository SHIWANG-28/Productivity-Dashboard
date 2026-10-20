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
}else{
    console.error('task list is empty')
}




function renderTask(){
    var allTask = document.querySelector('.allTask')

    var sum = ''
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
