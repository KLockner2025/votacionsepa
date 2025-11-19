//
// server.js
// Servidor backend de votación en vivo con temporizador + PostgreSQL
//

// ==============================
// 1. IMPORTAR LIBRERÍAS
// ==============================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { pool } = require("./db"); // requiere DATABASE_URL y SSL activo

// ==============================
// 2. CREAR SERVIDOR
// ==============================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==============================
// 3. SERVIR ARCHIVOS ESTÁTICOS
// ==============================
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

// ==============================
// 4. DEFINIR LAS 2 PREGUNTAS (estáticas)
// ==============================
const questions = [
  {
    id: 1,
    text: "Elige: ¿Tú qué harías en este caso?",
    optionA: "Opción A - Implante inmediato",
    optionB: "Opción B - Implante diferido",
  },
  {
    id: 2,
    text: "Elige: ¿Tú qué harías en este caso?",
    optionA: "Opción A - Implante inmediato",
    optionB: "Opción B - Implante diferido",
  },
];

// ==============================
// 5. ESTADO DE LA VOTACIÓN
// ==============================
let currentQuestionId = null;   // pregunta activa
let isOpen = false;             // si la votación está abierta
let currentSessionId = null;    // id de la sesión en BD

// ==============================
// 6. TEMPORIZADOR (15 minutos)
// ==============================
const TOTAL_TIME = 15 * 60; // 15 minutos en segundos
let timeRemaining = TOTAL_TIME;
let timerInterval = null;

// iniciar temporizador
function startTimer() {
  stopTimer(); // por si acaso
  timeRemaining = TOTAL_TIME;

  timerInterval = setInterval(() => {
    timeRemaining--;

    // mandar tiempo a todos
    io.emit("timer", { timeRemaining });

    if (timeRemaining <= 0) {
      stopTimer();
      isOpen = false;

      // Cerrar sesión en BD si existe y emitir estado
      (async () => {
        if (currentSessionId) {
          try {
            await pool.query(
              "update sessions set closed_at = now() where id = $1",
              [currentSessionId]
            );
          } catch (e) {
            console.error("Error cerrando sesión por timeout:", e.message);
          }
        }
        const s = await buildState();
        io.emit("state", s);
      })();
    }
  }, 1000);
}

// detener temporizador
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ==============================
// 7. FUNCIÓN PARA CONSTRUIR EL ESTADO (lee BD si hay sesión)
// ==============================
async function buildState() {
  const q = questions.find((q) => q.id === currentQuestionId) || null;

  let votesA = 0;
  let votesB = 0;

  if (currentSessionId) {
    try {
      const { rows } = await pool.query(
        `select
           coalesce(sum(case when option='A' then 1 else 0 end),0)::int as votes_a,
           coalesce(sum(case when option='B' then 1 else 0 end),0)::int as votes_b
         from votes
         where session_id = $1`,
        [currentSessionId]
      );
      votesA = rows[0]?.votes_a ?? 0;
      votesB = rows[0]?.votes_b ?? 0;
    } catch (e) {
      console.error("Error leyendo conteo de BD:", e.message);
    }
  }

  return {
    currentQuestionId,
    isOpen,
    timeRemaining,
    question: q
      ? { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB }
      : null,
    votesA,
    votesB,
  };
}

// ==============================
// 8. SOCKET.IO
// ==============================
io.on("connection", async (socket) => {
  console.log("Cliente conectado:", socket.id);

  // Enviar estado actual y tiempo
  socket.emit("state", await buildState());
  socket.emit("timer", { timeRemaining });

  // ---------------------------
  // VOTO DEL PÚBLICO
  // ---------------------------
  socket.on("vote", async (data) => {
    if (!currentQuestionId) return;
    if (!isOpen) return;

    const option = data?.option;
    const userId = data?.userId; // identificador persistente del navegador

    // validaciones básicas
    if (option !== "A" && option !== "B") return;
    if (!userId) return;
    if (!currentSessionId) return; // solo votamos si hay sesión abierta

    // UPSERT del voto en BD
    try {
      await pool.query(
        `insert into votes (session_id, user_id, option)
         values ($1, $2, $3)
         on conflict (session_id, user_id) do update
           set option = excluded.option,
               voted_at = now()`,
        [currentSessionId, userId, option]
      );
    } catch (e) {
      console.error("Error guardando voto:", e.message);
      return;
    }

    io.emit("state", await buildState());
  });

  // ---------------------------
  // ADMIN CAMBIA PREGUNTA
  // ---------------------------
  socket.on("admin:setQuestion", async (data) => {
    const qid = data?.questionId;
    const exists = questions.some((q) => q.id === qid);
    if (!exists) return;

    currentQuestionId = qid;
    isOpen = false;

    // reiniciar timer y limpiar sesión activa (crearemos otra al abrir)
    stopTimer();
    timeRemaining = TOTAL_TIME;
    currentSessionId = null;

    io.emit("state", await buildState());
    io.emit("timer", { timeRemaining });
  });

  // ---------------------------
  // ADMIN ABRE VOTACIÓN
  // ---------------------------
  socket.on("admin:openVoting", async () => {
    if (!currentQuestionId) return;

    // Crear sesión en BD
    try {
      const { rows } = await pool.query(
        "insert into sessions (question_id) values ($1) returning id",
        [currentQuestionId]
      );
      currentSessionId = rows[0].id;
    } catch (e) {
      console.error("Error creando sesión:", e.message);
      return; // si falla, no abrimos la votación
    }

    isOpen = true;
    startTimer();

    io.emit("state", await buildState());
    io.emit("timer", { timeRemaining });
  });

  // ---------------------------
  // ADMIN CIERRA VOTACIÓN
  // ---------------------------
  socket.on("admin:closeVoting", async () => {
    if (!currentQuestionId) return;

    isOpen = false;
    stopTimer();

    if (currentSessionId) {
      try {
        await pool.query(
          "update sessions set closed_at = now() where id = $1",
          [currentSessionId]
        );
      } catch (e) {
        console.error("Error cerrando sesión:", e.message);
      }
    }

    io.emit("state", await buildState());
  });
});

// ==============================
// 9. ARRANCAR SERVIDOR
// ==============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
