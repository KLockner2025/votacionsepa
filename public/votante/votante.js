const socket = io();

const pregunta = document.getElementById("pregunta");
const estado = document.getElementById("estado");
const btnA = document.getElementById("btnA");
const btnB = document.getElementById("btnB");

// Identificador fijo de este votante (por navegador)
let voterId = localStorage.getItem("voterId");
if (!voterId) {
    voterId = "vtr-" + Math.random().toString(36).slice(2);
    localStorage.setItem("voterId", voterId);
}

// Guardamos cuál es la opción seleccionada por este usuario
let selectedOption = null;
// Para saber cuándo cambia de pregunta
let lastQuestionId = null;

function actualizarSeleccionVisual() {
    // Quitamos selección de ambos
    btnA.classList.remove("selected");
    btnB.classList.remove("selected");

    // Añadimos selección al que toque
    if (selectedOption === "A") {
        btnA.classList.add("selected");
    } else if (selectedOption === "B") {
        btnB.classList.add("selected");
    }
}

function votar(opcion) {
    // Guardamos la opción localmente
    selectedOption = opcion;
    actualizarSeleccionVisual();

    // Enviamos el voto al servidor con nuestro identificador fijo
    socket.emit("vote", { option: opcion, userId: voterId });
}

// Escuchar estado global enviado por el servidor
socket.on("state", (state) => {
    const q = state.question;

    // Si no hay pregunta activa
    if (!q) {
        pregunta.innerText = "Esperando pregunta...";
        btnA.disabled = true;
        btnB.disabled = true;
        estado.innerText = "Votación cerrada";

        // limpiamos selección
        selectedOption = null;
        actualizarSeleccionVisual();
        return;
    }

    // Si ha cambiado de pregunta (de CASO 1 a CASO 2, por ejemplo), reseteamos selección
    if (lastQuestionId !== q.id) {
        lastQuestionId = q.id;
        selectedOption = null;
        actualizarSeleccionVisual();
    }

    // Actualizar textos
    pregunta.innerText = q.text;
    btnA.innerText = q.optionA;
    btnB.innerText = q.optionB;

    // Estado de la votación
    if (state.isOpen) {
        estado.innerText = "Votación abierta";
        btnA.disabled = false;
        btnB.disabled = false;
    } else {
        estado.innerText = "Votación cerrada";
        btnA.disabled = true;
        btnB.disabled = true;
        // aunque se cierre, mantenemos visualmente qué opción tenía el usuario
        actualizarSeleccionVisual();
    }
});
