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