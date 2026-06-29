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
    animating: false, sound: true,
  };

  // ---------- sound (synthesized, no asset files) ----------
  let actx = null;
  function audio() {
    if (!S.sound) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur, type, gain) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.value = 0; o.connect(g); g.connect(a.destination);
    const t = a.currentTime;
    g.gain.linearRampToValueAtTime(gain || 0.08, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const g = a.createGain(); g.gain.value = gain || 0.05;
    src.connect(g); g.connect(a.destination); src.start();
  }
  const sfx = {
    dice() { noise(0.18, 0.06); },
    move() { tone(330, 0.08, "triangle", 0.05); },
    hit() { tone(150, 0.16, "sawtooth", 0.07); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sine", 0.08), i * 110)); },
    lose() { tone(196, 0.4, "sine", 0.06); },
  };

  // ---------- persistence ----------
  const KEY = "bg_save_v1";
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({
      board: S.board, player: S.player, phase: S.phase, level: S.level,
      teach: S.teach, tier: S.tier, cube: S.cube, cubeOwner: S.cubeOwner, stats: S.stats,
      sound: S.sound,
    })); } catch (e) {}
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d) return false;
      Object.assign(S, { board: d.board, player: d.player, level: d.level || "medium",
        teach: !!d.teach, tier: d.tier || "intermediate", cube: d.cube || 1,
        cubeOwner: d.cubeOwner ?? null, stats: d.stats || S.stats, sound: d.sound !== false });
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

    // highlights for current human move (suppressed mid-animation)
    if (S.phase === "move" && S.player === WHITE && !S.animating) {
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
    $("teachBtn").classList.toggle("on", S.teach);
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
  function dieEl(v, used, settle) {
    const d = document.createElement("div");
    d.className = "die" + (S.player === BLACK ? " brown" : "") + (used ? " used" : "") + (settle ? " settle" : "");
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      if (PIPS[v].includes(i)) { const pip = document.createElement("div"); pip.className = "pip"; cell.appendChild(pip); }
      d.appendChild(cell);
    }
    return d;
  }
  // Render an arbitrary pair of faces (used by the tumble animation).
  function renderDiceFaces(vals, settle) {
    const row = $("dice"); row.innerHTML = "";
    vals.forEach((v) => row.appendChild(dieEl(v, false, settle)));
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
    const busy = S.animating;
    $("rollBtn").disabled = busy || !(S.phase === "roll" && S.player === WHITE && !over);
    $("undoBtn").disabled = busy || !(S.phase === "move" && S.player === WHITE && S.movesSoFar.length > 0);
    const canDouble = !busy && S.phase === "roll" && S.player === WHITE && !over &&
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
    const el = $("homeStats"); if (!el) return;
    const pr = S.stats.lossN ? (1000 * S.stats.lossSum / S.stats.lossN).toFixed(0) : "—";
    el.textContent = `Record ${S.stats.wins}–${S.stats.losses}` +
      (S.stats.lossN ? ` · avg error ${pr} (lower is better)` : "");
  }

  // ---------- animation ----------
  const rd6 = () => 1 + Math.floor(Math.random() * 6);

  function elementFor(point, player) {
    if (point === 25) return player === WHITE ? $("bar-bottom") : $("bar-top");
    if (point === 0) return player === WHITE ? $("tray-bottom") : $("tray-top");
    return document.querySelector(`.point[data-point="${point}"]`);
  }
  // The screen rect of the exposed (top-of-stack) checker at a point.
  function topCheckerRect(point, player) {
    const host = elementFor(point, player);
    if (!host) return null;
    if (point === 0) return host.getBoundingClientRect();
    const cs = host.querySelectorAll(".checker");
    return (cs.length ? cs[cs.length - 1] : host).getBoundingClientRect();
  }

  // Fly a clone checker from one rect to another, then call done().
  function flyChecker(from, to, player, done) {
    if (!from || !to) { done && done(); return; }
    const size = Math.min(from.width || 24, 30);
    const f = document.createElement("div");
    f.className = "checker " + (player === WHITE ? "w" : "b") + " flying";
    f.style.width = size + "px"; f.style.height = size + "px";
    f.style.left = from.left + (from.width - size) / 2 + "px";
    f.style.top = from.top + (from.height ? 0 : 0) + "px";
    document.body.appendChild(f);
    f.getBoundingClientRect(); // reflow so the transition runs
    const dx = (to.left + (to.width - size) / 2) - (from.left + (from.width - size) / 2);
    const dy = to.top - from.top;
    f.style.transform = `translate(${dx}px, ${dy}px)`;
    let done_ = false;
    const finish = () => { if (done_) return; done_ = true; f.remove(); done && done(); };
    f.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 340); // fallback if transitionend is missed
  }

  // Apply one move to the real board, render, and animate the slide.
  function commitAndAnimate(move, player, done) {
    const srcRect = topCheckerRect(move.from, player);
    const willHit = move.to >= 1 && move.to <= 24 && E.count(S.board, move.to, -player) === 1;
    const hitRect = willHit ? topCheckerRect(move.to, -player) : null;

    S.board = E.applyMove(S.board, move, player);
    render();

    let arrived = null, dstRect;
    if (move.to === 0) {
      dstRect = elementFor(0, player).getBoundingClientRect();
    } else {
      const cs = document.querySelectorAll(`.point[data-point="${move.to}"] .checker`);
      arrived = cs[cs.length - 1] || null;
      dstRect = arrived ? arrived.getBoundingClientRect() : topCheckerRect(move.to, player);
      if (arrived) arrived.style.visibility = "hidden"; // hide until the fly lands
    }

    if (hitRect) {
      const barRect = elementFor(25, -player).getBoundingClientRect();
      flyChecker(hitRect, barRect, -player, null);
      sfx.hit(); vibrate(18);
    } else { sfx.move(); vibrate(8); }

    flyChecker(srcRect, dstRect, player, () => {
      if (arrived) {
        arrived.style.visibility = "visible";
        arrived.classList.add("land");
        setTimeout(() => arrived && arrived.classList.remove("land"), 200);
      }
      done && done();
    });
  }

  // Animate a full play (sequence of moves) one step at a time.
  function animatePlay(moves, player, done) {
    let i = 0;
    (function next() {
      if (i >= moves.length) { done(); return; }
      commitAndAnimate(moves[i++], player, () => setTimeout(next, 80));
    })();
  }

  // Tumble the dice for ~0.4s, then settle on the real values, then done().
  function rollDiceAnimated(done) {
    S.dice = [rd6(), rd6()];
    sfx.dice(); vibrate(15);
    const row = $("dice"); row.classList.add("rolling");
    let ticks = 0;
    const iv = setInterval(() => {
      renderDiceFaces([rd6(), rd6()], false);
      if (++ticks >= 7) {
        clearInterval(iv);
        row.classList.remove("rolling");
        renderDiceFaces([S.dice[0], S.dice[1]], true); // settle pop on real faces
        done();
      }
    }, 55);
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
    if (S.phase !== "move" || S.player !== WHITE || S.animating) return;
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
    if (S.animating) return;
    S.movesSoFar.push(move);
    S.selected = null;
    S.animating = true;
    commitAndAnimate(move, WHITE, () => {
      S.animating = false;
      if (turnComplete()) finishHumanTurn();
      else render();
    });
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
    if (S.phase !== "roll" || S.player !== WHITE || S.animating) return;
    S.animating = true;
    renderControls(); // disable buttons during the roll
    rollDiceAnimated(() => {
      S.animating = false;
      S.plays = E.legalPlays(S.board, S.dice[0], S.dice[1], WHITE);
      S.movesSoFar = []; S.selected = null; S.turnStart = S.board; S.lastReview = null;
      S.analysis = S.teach ? Teach.analyze(S.board, S.dice[0], S.dice[1], WHITE) : null;
      if (S.plays.length === 1 && S.plays[0].moves.length === 0) {
        // no legal move — forfeit
        S.phase = "aiturn"; S.player = BLACK; render();
        $("msg").textContent = "No legal move — you forfeit the turn.";
        setTimeout(() => { S.dice = null; aiTurn(); }, 1100);
        return;
      }
      S.phase = "move"; render();
    });
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
    S.animating = true;
    renderStatus();
    rollDiceAnimated(() => {
      // choose runs synchronously (tens of ms); let the dice settle first
      setTimeout(() => {
        const play = AI.choosePlay(S.board, S.dice[0], S.dice[1], BLACK, S.level);
        if (!play || !play.moves.length) {
          S.animating = false;
          if (checkGameOver()) return;
          S.player = WHITE; S.phase = "roll"; S.dice = null; save(); render();
          return;
        }
        animatePlay(play.moves, BLACK, () => {
          S.animating = false;
          if (checkGameOver()) return;
          S.player = WHITE; S.phase = "roll"; S.dice = null; save(); render();
        });
      }, 180);
    });
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
    S.animating = true;
    rollDiceAnimated(() => {
      setTimeout(() => {
        const play = AI.choosePlay(S.board, S.dice[0], S.dice[1], BLACK, S.level);
        const finishUp = () => {
          S.animating = false;
          if (checkGameOver()) return;
          S.player = WHITE; S.phase = "roll"; S.dice = null; save(); render();
        };
        if (play && play.moves.length) animatePlay(play.moves, BLACK, finishUp);
        else finishUp();
      }, 180);
    });
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
    S.phase = "over"; S.dice = null; S.animating = false; save(); render();
    if (winnerSide === WHITE) sfx.win(); else sfx.lose();
    const head = winnerSide === WHITE ? "You win! 🎉" : "Opponent wins";
    const detail = conceded ? `Cube conceded · ${pts} point${pts > 1 ? "s" : ""}.`
      : `${label(E.winType(S.board))} × cube ${S.cube} = ${pts} point${pts > 1 ? "s" : ""}.`;
    showModal(head, [
      { text: "Play again", cls: "primary", on: () => { closeModal(); newGame(); } },
      { text: "Menu", on: () => { closeModal(); showScreen("home"); } },
    ], detail);
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

  // ---------- screens & menu ----------
  const STARTKEY = E.keyB(E.startingBoard());
  function gameInProgress() { return E.winner(S.board) === null && E.keyB(S.board) !== STARTKEY; }

  function showScreen(name) {
    $("home").classList.toggle("active", name === "home");
    $("game").classList.toggle("active", name === "game");
    if (name === "home") syncHome();
    else render();
  }

  function syncHome() {
    document.querySelectorAll("#homeLevel button").forEach((b) =>
      b.classList.toggle("on", b.dataset.level === S.level));
    $("homeTeach").checked = S.teach;
    $("homeTier").value = S.tier;
    $("homeSound").checked = S.sound;
    $("tierRow").style.display = S.teach ? "flex" : "none";
    $("resumeBtn").style.display = gameInProgress() ? "block" : "none";
    renderStats();
  }

  function setTeach(on) {
    S.teach = on; S.lastReview = null;
    if (on && S.phase === "move" && S.dice) S.analysis = Teach.analyze(S.turnStart, S.dice[0], S.dice[1], WHITE);
    if (!on) S.analysis = null;
    save();
    if ($("game").classList.contains("active")) render();
  }

  function openGameMenu() {
    showModal("Menu", [
      { text: "Continue", cls: "primary", on: () => closeModal() },
      { text: "New game", on: () => { closeModal(); newGame(); } },
      { text: "End game", on: () => { closeModal(); newGame(); showScreen("home"); } },
    ]);
  }

  function wire() {
    // in-game controls
    $("rollBtn").onclick = rollDice;
    $("undoBtn").onclick = undo;
    $("doubleBtn").onclick = humanDouble;
    $("cube").onclick = humanDouble;
    $("homeBtn").onclick = openGameMenu;
    $("teachBtn").onclick = () => { setTeach(!S.teach); };

    // home-screen controls
    document.querySelectorAll("#homeLevel button").forEach((b) => {
      b.onclick = () => { S.level = b.dataset.level; save(); syncHome(); };
    });
    $("homeTeach").onchange = (e) => { setTeach(e.target.checked); syncHome(); };
    $("homeTier").onchange = (e) => { S.tier = e.target.value; save(); };
    $("homeSound").onchange = (e) => { S.sound = e.target.checked; if (S.sound) sfx.move(); save(); };
    $("playBtn").onclick = () => { newGame(); showScreen("game"); };
    $("resumeBtn").onclick = () => { showScreen("game"); };
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildBoard(); wire();
    load();
    showScreen("home");
  });
})();
