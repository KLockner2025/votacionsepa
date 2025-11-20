// Conectar con Socket.IO
const socket = io();

// --- Funciones del admin ---

function setQuestion(id) {
    socket.emit("admin:setQuestion", { questionId: id });
}

function openVoting() {
    socket.emit("admin:openVoting");
}

function closeVoting() {
    socket.emit("admin:closeVoting");
}

function startTimer() {
    socket.emit("admin:startTimer");
}

function toggleBar() {
    socket.emit("admin:toggleBarOpacity");
}

// --- Escuchar el estado general ---
socket.on("state", (state) => {
    const q = state.question;

    // Pregunta
    document.getElementById("estadoPregunta").innerText =
        q ? `Pregunta actual: CASO ${q.id}` : "Pregunta actual: ninguna";

    // Votación abierta/cerrada
    document.getElementById("estadoVotacion").innerText =
        state.isOpen ? "Votación: ABIERTA" : "Votación: CERRADA";

    // Resultados
    document.getElementById("resultados").innerText =
        `Votos A: ${state.votesA} | Votos B: ${state.votesB}`;

    // Estado barra
    document.getElementById("estadoBarra").innerText =
        state.barTransparent ? "Barra: TRANSPARENTE" : "Barra: VISIBLE";

    // Estado temporizador
    if (state.timerRunning) {
        document.getElementById("estadoTemporizador").innerText =
            "Temporizador: 🔥 ACTIVO";
        document.getElementById("estadoTemporizador").style.color = "#d9534f";
    } else {
        document.getElementById("estadoTemporizador").innerText =
            "Temporizador: ⏸ DETENIDO";
        document.getElementById("estadoTemporizador").style.color = "#444";
    }
});

// --- Escuchar timer en tiempo real (opcional para futuro) ---
socket.on("timer", ({ timeRemaining, timerRunning }) => {
    // Aquí no mostramos nada en admin por ahora,
    // pero se puede añadir si lo quieres visible arriba.
});
