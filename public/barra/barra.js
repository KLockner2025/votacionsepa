// Conectar al servidor
const socket = io();

// Elementos del DOM
const pregunta = document.getElementById("pregunta");
const timer = document.getElementById("timer");
const segA = document.getElementById("A");
const segB = document.getElementById("B");
const opA = document.getElementById("opA");
const opB = document.getElementById("opB");
const status = document.getElementById("status");
const container = document.getElementById("container");

// Estado inicial opacidad
container.classList.add("opacity-normal");

// ------------------------------
// ESTADO GENERAL
// ------------------------------
socket.on("state", (state) => {
    const q = state.question;

    if (!q) {
        pregunta.innerText = "Esperando pregunta...";
        segA.style.width = "50%";
        segB.style.width = "50%";
        segA.innerText = "0%";
        segB.innerText = "0%";
        return;
    }

    pregunta.innerText = q.text;

    opA.innerText = q.optionA;
    opB.innerText = q.optionB;
    status.innerText = state.isOpen ? "Votación abierta" : "Votación cerrada";

    const total = state.votesA + state.votesB;
    let pctA = total === 0 ? 50 : (state.votesA / total) * 100;
    let pctB = 100 - pctA;

    segA.style.width = pctA + "%";
    segB.style.width = pctB + "%";
    segA.innerText = Math.round(pctA) + "%";
    segB.innerText = Math.round(pctB) + "%";

    // NUEVO: ajustar opacidad según estado global
    if (state.barTransparent) {
        container.classList.remove("opacity-normal");
        container.classList.add("opacity-transparent");
    } else {
        container.classList.remove("opacity-transparent");
        container.classList.add("opacity-normal");
    }
});

// ------------------------------
// TEMPORIZADOR
// ------------------------------
socket.on("timer", ({ timeRemaining }) => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timer.innerText =
        minutes.toString().padStart(2, '0') + ":" +
        seconds.toString().padStart(2, '0');

    if (timeRemaining > 0 && timeRemaining <= 60) {
        timer.classList.add("danger");
        timer.classList.add("blink");
    } else if (timeRemaining === 0) {
        timer.classList.add("danger");
        timer.classList.remove("blink");
    } else {
        timer.classList.remove("danger");
        timer.classList.remove("blink");
    }
});

// ------------------------------
// EVENTO DIRECTO DE OPACIDAD
// ------------------------------
socket.on("barOpacity", ({ transparent }) => {
    if (transparent) {
        container.classList.remove("opacity-normal");
        container.classList.add("opacity-transparent");
    } else {
        container.classList.remove("opacity-transparent");
        container.classList.add("opacity-normal");
    }
});
