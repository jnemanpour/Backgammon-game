// ui.js — touch UI, turn flow, cube, Teach Me overlay, and persistence.
(function () {
  "use strict";
  const E = window.Engine, AI = window.AI, Teach = window.Teach;
  const WHITE = E.WHITE, BLACK = E.BLACK; // human = WHITE, AI = BLACK
  const $ = (id) => document.getElementById(id);
  const vibrate = (ms) => navigator.vibrate && navigator.vibrate(ms);

  const QUADS = { "q-tl": [13, 14, 15, 16, 17, 18], "q-tr": [19, 20, 21, 22, 23, 24],
                  "q-bl": [12, 11, 10, 9, 8, 7], "q-br": [6, 5, 4, 3, 2, 1] };

  const S = {
    board: E.startingBoard(), player: WHITE, phase: "roll",
    dice: null, plays: [], movesSoFar: [], selected: null, turnStart: null,
    level: "medium", teach: false, tier: "intermediate",
    analysis: null, lastReview: null,
    cube: 1, cubeOwner: null, // null = center, WHITE/BLACK = owner
    stats: { wins: 0, losses: 0, lossSum: 0, lossN: 0 },
  };

  // ---------- persistence ----------
  const KEY = "bg_save_v1";
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({
      board: S.board, player: S.player, phase: S.phase, level: S.level,
      teach: S.teach, tier: S.tier, cube: S.cube, cubeOwner: S.cubeOwner, stats: S.stats,
    })); } catch (e) {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d) return false;
      Object.assign(S, { board: d.board, player: d.player, level: d.level || "medium",
        teach: !!d.teach, tier: d.tier || "intermediate", cube: d.cube || 1,
        cubeOwner: d.cubeOwner ?? null, stats: d.stats || S.stats });
      // Always resume at a clean roll decision for whoever was on move.
      S.phase = E.winner(S.board) ? "over" : "roll";
      return true;
    } catch (e) { return false; }
  }

  // ---------- board DOM ----------
  function buildBoard() {
    for (const qid in QUADS) {
      const q = $(qid); q.innerHTML = "";
      for (const p of QUADS[qid]) {
        const pt = document.createElement("div");
        pt.className = "point"; pt.dataset.point = p;
        pt.innerHTML = `<span class="label">${p}</span><div class="checkers"></div>`;
        pt.addEventListener("click", () => onPointTap(p));
        q.appendChild(pt);
      }
    }
    $("bar-bottom").addEventListener("click", () => onPointTap(25)); // white enters from bar
    $("tray-bottom").addEventListener("click", () => onPointTap(0)); // white bears off
  }

  function checkerEl(side, label) {
    const c = document.createElement("div");
    c.className = "checker " + side;
    if (label) c.textContent = label;
    return c;
  }
  function renderStack(container, n, side) {
    container.innerHTML = "";
    const shown = Math.min(n, 5);
    for (let i = 0; i < shown; i++) {
      const top = i === shown - 1 && n > 5;
      container.appendChild(checkerEl(side, top ? String(n) : ""));
    }
  }

  function render() {
    const b = S.board;
    // points
    for (let p = 1; p <= 24; p++) {
      const el = document.querySelector(`.point[data-point="${p}"]`);
      const checkers = el.querySelector(".checkers");
      const w = E.count(b, p, WHITE), bl = E.count(b, p, BLACK);
      renderStack(checkers, w || bl, w ? "w" : "b");
      el.classList.remove("src", "dst", "sel", "bestghost");
    }
    // bar
    renderStack($("bar-bottom").querySelector(".checkers") || mkBarCheckers("bar-bottom"), b.barW, "w");
    renderStack($("bar-top").querySelector(".checkers") || mkBarCheckers("bar-top"), b.barB, "b");
    $("bar-bottom").classList.remove("src");
    // trays
    $("tray-bottom").querySelector(".count").textContent = "✓ " + b.offW;
    $("tray-top").querySelector(".count").textContent = "✓ " + b.offB;
    $("tray-bottom").classList.remove("dst");

    // highlights for current human move
    if (S.phase === "move" && S.player === WHITE) {
      const nm = nextMoves();
      if (S.selected === null) {
        const srcs = new Set(nm.map((m) => m.from));
        srcs.forEach((s) => markSource(s));
      } else {
        markSelected(S.selected);
        nm.filter((m) => m.from === S.selected).forEach((m) => markDest(m.to));
      }
    }
    // teach: ghost the best play's destinations pre-move
    if (S.teach && S.phase === "move" && S.player === WHITE && S.analysis && S.movesSoFar.length === 0) {
      for (const m of S.analysis.best.play.moves) {
        if (m.to >= 1 && m.to <= 24) {
          const el = document.querySelector(`.point[data-point="${m.to}"]`);
          if (el) el.classList.add("bestghost");
        }
      }
    }

    renderDice();
    renderCube();
    renderStatus();
    renderControls();
    renderTeach();
    renderStats();
  }

  function mkBarCheckers(id) {
    const el = $(id); let c = el.querySelector(".checkers");
    if (!c) { c = document.createElement("div"); c.className = "checkers"; el.appendChild(c); }
    return c;
  }
  function markSource(s) { (s === 25 ? $("bar-bottom") : document.querySelector(`.point[data-point="${s}"]`)).classList.add("src"); }
  function markSelected(s) { (s === 25 ? $("bar-bottom") : document.querySelector(`.point[data-point="${s}"]`)).classList.add("sel"); }
  function markDest(t) { (t === 0 ? $("tray-bottom") : document.querySelector(`.point[data-point="${t}"]`)).classList.add("dst"); }

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieEl(v, used) {
    const d = document.createElement("div");
    d.className = "die" + (used ? " used" : "");
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      if (PIPS[v].includes(i)) { const pip = document.createElement("div"); pip.className = "pip"; cell.appendChild(pip); }
      d.appendChild(cell);
    }
    return d;
  }
  function renderDice() {
    const row = $("dice"); row.innerHTML = "";
    if (!S.dice) return;
    const all = S.dice[0] === S.dice[1] ? [S.dice[0], S.dice[0], S.dice[0], S.dice[0]] : [S.dice[0], S.dice[1]];
    // mark used dice for the human mid-move
    const usedVals = S.player === WHITE ? S.movesSoFar.map((m) => m.die) : [];
    const usedCount = {};
    usedVals.forEach((v) => (usedCount[v] = (usedCount[v] || 0) + 1));
    const remain = {};
    all.forEach((v) => (remain[v] = (remain[v] || 0) + 1));
    all.forEach((v) => {
      const isUsed = usedCount[v] > 0;
      if (isUsed) usedCount[v]--;
      row.appendChild(dieEl(v, isUsed));
    });
  }
  function renderCube() {
    const c = $("cube"); c.textContent = S.cube;
    c.title = S.cubeOwner === null ? "cube (center)" : S.cubeOwner === WHITE ? "you own the cube" : "opponent owns the cube";
  }
  function renderStatus() {
    const w = E.winner(S.board);
    let msg;
    if (w === WHITE) msg = "You win — " + label(E.winType(S.board)) + "!";
    else if (w === BLACK) msg = "Opponent wins — " + label(E.winType(S.board)) + ".";
    else if (S.phase === "roll") msg = S.player === WHITE ? "Your turn — roll." : "Opponent to roll…";
    else if (S.phase === "move") msg = "Your move — tap a checker.";
    else if (S.phase === "aiturn") msg = "Opponent thinking…";
    else msg = "";
    $("msg").textContent = msg;
    $("pips").textContent = `you ${E.pipCount(S.board, WHITE)} · opp ${E.pipCount(S.board, BLACK)}`;
  }
  const label = (t) => (t === "single" ? "single" : t === "gammon" ? "gammon (2×)" : "backgammon (3×)");

  function renderControls() {
    const over = !!E.winner(S.board);
    $("rollBtn").disabled = !(S.phase === "roll" && S.player === WHITE && !over);
    $("undoBtn").disabled = !(S.phase === "move" && S.player === WHITE && S.movesSoFar.length > 0);
    const canDouble = S.phase === "roll" && S.player === WHITE && !over &&
      AI.LEVELS[S.level].cube && (S.cubeOwner === null || S.cubeOwner === WHITE);
    $("doubleBtn").disabled = !canDouble;
  }

  function renderTeach() {
    const panel = $("teachPanel");
    if (!S.teach || !S.lastReview) { panel.style.display = "none"; return; }
    panel.style.display = "block";
    const r = S.lastReview;
    panel.querySelector(".verdict").className = "verdict " + r.verdict;
    panel.querySelector(".verdict").textContent = "Your move: " + Teach.VERDICT_LABEL[r.verdict];
    panel.querySelector(".why").textContent = Teach.phrase(r, S.tier);
  }
  function renderStats() {
    const pr = S.stats.lossN ? (1000 * S.stats.lossSum / S.stats.lossN).toFixed(0) : "—";
    $("stats").textContent = `Record ${S.stats.wins}–${S.stats.losses}` +
      (S.teach ? ` · avg error ${pr} (lower is better)` : "");
  }

  // ---------- consistent-play tracking ----------
  function consistent() {
    return S.plays.filter((p) => p.moves.length >= S.movesSoFar.length &&
      S.movesSoFar.every((m, i) => p.moves[i].from === m.from && p.moves[i].to === m.to));
  }
  function nextMoves() {
    const idx = S.movesSoFar.length, seen = new Set(), res = [];
    for (const p of consistent()) if (p.moves.length > idx) {
      const m = p.moves[idx], k = m.from + ">" + m.to;
      if (!seen.has(k)) { seen.add(k); res.push(m); }
    }
    return res;
  }
  const turnComplete = () => S.plays.length > 0 && S.movesSoFar.length === S.plays[0].moves.length;

  // ---------- human interaction ----------
  function onPointTap(p) {
    if (S.phase !== "move" || S.player !== WHITE) return;
    const nm = nextMoves();
    if (S.selected === null) {
      if (nm.some((m) => m.from === p)) { S.selected = p; render(); }
      return;
    }
    // a source is already selected
    const move = nm.find((m) => m.from === S.selected && m.to === p);
    if (move) { applyHuman(move); return; }
    if (nm.some((m) => m.from === p)) { S.selected = p; render(); return; } // reselect
    S.selected = null; render();
  }

  function applyHuman(move) {
    S.movesSoFar.push(move);
    S.board = E.applyMove(S.board, move, WHITE);
    S.selected = null;
    vibrate(8);
    if (turnComplete()) finishHumanTurn();
    else render();
  }

  function finishHumanTurn() {
    // snap to the canonical resulting board of the matching play
    const match = S.plays.find((p) => Teach.samePlay(p, { moves: S.movesSoFar }));
    if (match) S.board = match.result;
    if (S.teach && S.analysis) {
      S.lastReview = Teach.review(S.analysis, { moves: S.movesSoFar, result: S.board }, S.turnStart, WHITE);
      S.stats.lossSum += S.lastReview.loss; S.stats.lossN++;
    }
    S.plays = []; S.movesSoFar = []; S.analysis = null;
    if (checkGameOver()) return;
    S.player = BLACK; S.phase = "aiturn"; save(); render();
    setTimeout(aiTurn, 650);
  }

  function rollDice() {
    if (S.phase !== "roll" || S.player !== WHITE) return;
    S.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    vibrate(12);
    S.plays = E.legalPlays(S.board, S.dice[0], S.dice[1], WHITE);
    S.movesSoFar = []; S.selected = null; S.turnStart = S.board; S.lastReview = null;
    S.analysis = S.teach ? Teach.analyze(S.board, S.dice[0], S.dice[1], WHITE) : null;
    if (S.plays.length === 1 && S.plays[0].moves.length === 0) {
      // no legal move — forfeit
      S.phase = "aiturn"; S.player = BLACK; render();
      $("msg").textContent = "No legal move — you forfeit the turn.";
      setTimeout(() => { S.dice = null; aiTurn(); }, 1000);
      return;
    }
    S.phase = "move"; render();
  }

  function undo() {
    if (S.phase !== "move") return;
    S.board = S.turnStart; S.movesSoFar = []; S.selected = null; render();
  }

  // ---------- AI ----------
  function aiTurn() {
    if (E.winner(S.board)) return;
    // cube: AI may double before rolling
    if (AI.LEVELS[S.level].cube && (S.cubeOwner === null || S.cubeOwner === BLACK) &&
        AI.shouldDouble(S.board, BLACK, S.level)) {
      offerDoubleToHuman();
      return;
    }
    S.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    render();
    setTimeout(() => {
      const play = AI.choosePlay(S.board, S.dice[0], S.dice[1], BLACK, S.level);
      if (play && play.moves.length) { S.board = play.result; vibrate(6); }
      if (checkGameOver()) return;
      S.player = WHITE; S.phase = "roll"; S.dice = null; save(); render();
    }, 700);
  }

  // ---------- cube ----------
  function humanDouble() {
    if (S.phase !== "roll" || S.player !== WHITE) return;
    const proposed = S.cube * 2;
    if (AI.shouldTake(S.board, BLACK, S.level)) {
      S.cube = proposed; S.cubeOwner = BLACK; // opponent took, now owns cube
      flash(`Opponent takes. Cube at ${S.cube}.`);
      render();
    } else {
      flash("Opponent passes — you win this game.");
      endGame(WHITE, /*conceded*/ true);
    }
  }
  function offerDoubleToHuman() {
    showModal(`Opponent doubles to ${S.cube * 2}.`, [
      { text: "Take", cls: "primary", on: () => { S.cube *= 2; S.cubeOwner = WHITE; closeModal(); aiAfterCube(); } },
      { text: "Pass", on: () => { closeModal(); endGame(BLACK, true); } },
    ]);
  }
  function aiAfterCube() {
    S.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    render();
    setTimeout(() => {
      const play = AI.choosePlay(S.board, S.dice[0], S.dice[1], BLACK, S.level);
      if (play && play.moves.length) S.board = play.result;
      if (checkGameOver()) return;
      S.player = WHITE; S.phase = "roll"; S.dice = null; save(); render();
    }, 700);
  }

  // ---------- game over ----------
  function checkGameOver() {
    const w = E.winner(S.board);
    if (!w) return false;
    endGame(w, false);
    return true;
  }
  function endGame(winnerSide, conceded) {
    const mult = conceded ? 1 : { single: 1, gammon: 2, backgammon: 3 }[E.winType(S.board) || "single"];
    const pts = S.cube * mult;
    if (winnerSide === WHITE) S.stats.wins++; else S.stats.losses++;
    S.phase = "over"; S.dice = null; save(); render();
    const head = winnerSide === WHITE ? "You win! 🎉" : "Opponent wins";
    const detail = conceded ? `Cube conceded · ${pts} point${pts > 1 ? "s" : ""}.`
      : `${label(E.winType(S.board))} × cube ${S.cube} = ${pts} point${pts > 1 ? "s" : ""}.`;
    showModal(head, [{ text: "New game", cls: "primary", on: () => { closeModal(); newGame(); } }], detail);
  }

  // ---------- modal ----------
  function showModal(title, buttons, detail) {
    closeModal();
    const m = document.createElement("div"); m.className = "modal"; m.id = "modal";
    const card = document.createElement("div"); card.className = "card";
    card.innerHTML = `<h2>${title}</h2>${detail ? `<p>${detail}</p>` : ""}<div class="row"></div>`;
    buttons.forEach((b) => {
      const btn = document.createElement("button"); btn.textContent = b.text;
      if (b.cls === "primary") btn.style.background = "#1c7c4a", btn.style.color = "#fff";
      else btn.style.background = "#2a3a47", btn.style.color = "#e8edf2";
      btn.onclick = b.on; card.querySelector(".row").appendChild(btn);
    });
    m.appendChild(card); document.body.appendChild(m);
  }
  const closeModal = () => { const m = $("modal"); if (m) m.remove(); };
  function flash(text) { $("msg").textContent = text; }

  // ---------- lifecycle ----------
  function newGame() {
    S.board = E.startingBoard(); S.player = WHITE; S.phase = "roll";
    S.dice = null; S.plays = []; S.movesSoFar = []; S.selected = null;
    S.cube = 1; S.cubeOwner = null; S.lastReview = null; S.analysis = null;
    save(); render();
  }

  function wire() {
    $("rollBtn").onclick = rollDice;
    $("undoBtn").onclick = undo;
    $("doubleBtn").onclick = humanDouble;
    $("newBtn").onclick = () => { if (confirm("Start a new game?")) newGame(); };
    $("cube").onclick = humanDouble;
    $("levelSel").onchange = (e) => { S.level = e.target.value; save(); render(); };
    $("teachChk").onchange = (e) => { S.teach = e.target.checked; S.lastReview = null;
      if (S.teach && S.phase === "move") S.analysis = Teach.analyze(S.turnStart, S.dice[0], S.dice[1], WHITE);
      save(); render(); };
    $("tierSel").onchange = (e) => { S.tier = e.target.value; save(); render(); };
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildBoard(); wire();
    load();
    $("levelSel").value = S.level; $("teachChk").checked = S.teach; $("tierSel").value = S.tier;
    render();
  });
})();
