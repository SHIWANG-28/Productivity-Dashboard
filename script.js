var allElem = document.querySelectorAll(".elem");
var allfullElem = document.querySelectorAll(".fullElem");
allElem.forEach((elem) => {
    elem.addEventListener('click', () => {
        allfullElem[elem.id].style.display = "block";
    })
})