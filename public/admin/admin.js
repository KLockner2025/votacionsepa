// Conectar con Socket.IO
const socket = io();

// Funciones del admin
function setQuestion(id) {
    socket.emit("admin:setQuestion", { questionId: id });
}

function openVoting() {
    socket.emit("admin:openVoting");
}

function closeVoting() {
    socket.emit("admin:closeVoting");
}

function toggleBar() {
    socket.emit("admin:toggleBarOpacity");
}

// ESCUCHAR ESTADO
socket.on("state", (state) => {
    const q = state.question;

    document.getElementById("estadoPregunta").innerText =
        q ? `Pregunta actual: CASO ${q.id}` : "Pregunta actual: ninguna";

    document.getElementById("estadoVotacion").innerText =
        state.isOpen ? "Votación: ABIERTA" : "Votación: CERRADA";

    document.getElementById("resultados").innerText =
        `Votos A: ${state.votesA} | Votos B: ${state.votesB}`;

    // NUEVO → Mostrar estado de barra
    document.getElementById("estadoBarra").innerText =
        state.barTransparent ? "Barra: TRANSPARENTE" : "Barra: OPACA";
});
