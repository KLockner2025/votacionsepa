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

// Cuando llega el estado del servidor
socket.on("state", (state) => {

    const q = state.question;

    // Si no hay pregunta activa
    if (!q) {
        pregunta.innerText = "Esperando pregunta...";
        segA.style.width = "50%";
        segB.style.width = "50%";
        segA.innerText = "0%";
        segB.innerText = "0%";
        return;
    }

    // Mostrar texto de la pregunta
    pregunta.innerText = q.text;

    // Mostrar opciones
    opA.innerText = q.optionA;
    opB.innerText = q.optionB;

    // Estado de votación
    status.innerText = state.isOpen ? "Votación abierta" : "Votación cerrada";

    // Cálculo porcentajes
    const total = state.votesA + state.votesB;

    let pctA = total === 0 ? 50 : (state.votesA / total) * 100;
    let pctB = 100 - pctA;

    // Ajustar barra
    segA.style.width = pctA + "%";
    segB.style.width = pctB + "%";

    // Texto en la barra
    segA.innerText = Math.round(pctA) + "%";
    segB.innerText = Math.round(pctB) + "%";
});

// ESCUCHAR TEMPORIZADOR
// ESCUCHAR TEMPORIZADOR
socket.on("timer", ({ timeRemaining }) => {
    // Convertir a mm:ss
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timer.innerText =
        minutes.toString().padStart(2, '0') + ":" +
        seconds.toString().padStart(2, '0');

    // Último minuto → rojo + parpadeo
    if (timeRemaining > 0 && timeRemaining <= 60) {
        timer.classList.add("danger");
        timer.classList.add("blink");
    } else if (timeRemaining === 0) {
        // En 00:00: mantenemos rojo pero sin parpadeo, y nos quedamos así
        timer.classList.add("danger");
        timer.classList.remove("blink");
    } else {
        // Más de 60s: estilo normal
        timer.classList.remove("danger");
        timer.classList.remove("blink");
    }
});
