// ==========================================
// server.js — Servidor votación SEPA + opacidad barra
// ==========================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { pool } = require("./db");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// ==============================
// PREGUNTAS
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
// ESTADO
// ==============================
let currentQuestionId = null;
let isOpen = false;
let currentSessionId = null;

// NUEVO → Estado de opacidad de barra
let barTransparent = false;

// ==============================
// TEMPORIZADOR 15 minutos
// ==============================
const TOTAL_TIME = 15 * 60;
let timeRemaining = TOTAL_TIME;
let timerInterval = null;

function startTimer() {
  stopTimer();
  timeRemaining = TOTAL_TIME;

  timerInterval = setInterval(async () => {
    timeRemaining--;

    io.emit("timer", { timeRemaining });

    if (timeRemaining <= 0) {
      stopTimer();
      isOpen = false;

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

      io.emit("state", await buildState());
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ==============================
// BUILD STATE
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
      console.error("Error leyendo BD:", e.message);
    }
  }

  return {
    currentQuestionId,
    isOpen,
    timeRemaining,

    // NUEVO
    barTransparent,

    question: q
      ? { id: q.id, text: q.text, optionA: q.optionA, optionB: q.optionB }
      : null,

    votesA,
    votesB,
  };
}

// ==============================
// SOCKET.IO
// ==============================
io.on("connection", async (socket) => {
  socket.emit("state", await buildState());
  socket.emit("timer", { timeRemaining });

  // VOTO
  socket.on("vote", async (data) => {
    if (!currentQuestionId || !isOpen || !currentSessionId) return;

    const option = data?.option;
    const userId = data?.userId;

    if (!["A", "B"].includes(option)) return;
    if (!userId) return;

    try {
      await pool.query(
        `insert into votes (session_id, user_id, option)
         values ($1, $2, $3)
         on conflict (session_id, user_id)
         do update set option = excluded.option, voted_at = now()`,
        [currentSessionId, userId, option]
      );
    } catch (e) {
      console.error("Error guardando voto:", e.message);
    }

    io.emit("state", await buildState());
  });

  // CAMBIAR PREGUNTA
  socket.on("admin:setQuestion", async (data) => {
    const qid = data?.questionId;
    if (!questions.some((q) => q.id === qid)) return;

    currentQuestionId = qid;
    isOpen = false;
    stopTimer();
    timeRemaining = TOTAL_TIME;
    currentSessionId = null;

    io.emit("state", await buildState());
    io.emit("timer", { timeRemaining });
  });

  // ABRIR VOTACIÓN
  socket.on("admin:openVoting", async () => {
    if (!currentQuestionId) return;

    try {
      const { rows } = await pool.query(
        "insert into sessions (question_id) values ($1) returning id",
        [currentQuestionId]
      );
      currentSessionId = rows[0].id;
    } catch (e) {
      console.error("Error creando sesión:", e.message);
      return;
    }

    isOpen = true;
    startTimer();

    io.emit("state", await buildState());
    io.emit("timer", { timeRemaining });
  });

  // CERRAR VOTACIÓN
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

  // NUEVO → TOGGLE OPACIDAD
  socket.on("admin:toggleBarOpacity", async () => {
    barTransparent = !barTransparent;
    io.emit("barOpacity", { transparent: barTransparent });
    io.emit("state", await buildState());
  });
});

// ==============================
// INICIAR SERVIDOR
// ==============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
