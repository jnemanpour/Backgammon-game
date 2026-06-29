// ai.js — opponent brain and the analysis used by Teach Me.
//
// Honest note: this is a hand-crafted *positional* evaluator, not Tesauro's
// pubeval (whose exact weight vectors aren't reproduced here) nor a trained
// neural net. It plays a reasonable game and, crucially, ranks every legal
// play by an equity-like score — which is exactly what Teach Me needs. The
// native app would swap this for pubeval / a TD-Gammon net behind the same API.
(function (root, factory) {
  const mod = factory(typeof require === "function" ? require("./engine.js") : root.Engine);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.AI = mod;
})(typeof self !== "undefined" ? self : this, function (E) {
  "use strict";
  const { WHITE, BLACK } = E;

  // Pip count on a normalized board for the mover (+) or opponent (-).
  function pipNorm(b, sign) {
    let pips = (sign > 0 ? b.barW : b.barB) * 25;
    for (let p = 1; p <= 24; p++) {
      const v = b.points[p];
      if (sign > 0 && v > 0) pips += p * v;
      if (sign < 0 && v < 0) pips += (25 - p) * -v;
    }
    return pips;
  }

  // Approximate count (/36) of opponent rolls that hit the mover's blot on `p`.
  // Geometric estimate (direct + simple combos + doubles); fast enough for the
  // inner loop. Teach Me uses the engine-exact version below for its claims.
  function cheapShots(b, p) {
    const opp = [];
    for (let q = 1; q < p; q++) if (b.points[q] < 0) opp.push(q);
    const barOpp = b.barB > 0;
    const blocked = (i) => i >= 1 && i <= 24 && b.points[i] >= 2;
    let hits = 0;
    for (let a = 1; a <= 6; a++) for (let c = 1; c <= 6; c++) {
      let hit = false;
      for (const q of opp) { const d = p - q; if (d === a || d === c) hit = true; }
      if (barOpp && (p === a || p === c)) hit = true;
      if (!hit) {
        for (const q of opp) {
          const d = p - q;
          if (d === a + c && (!blocked(q + a) || !blocked(q + c))) hit = true;
        }
        if (a === c) for (const q of opp) {
          const d = p - q;
          if (d > 0 && d % a === 0 && d / a <= 4) {
            let ok = true;
            for (let k = 1; k < d / a; k++) if (blocked(q + a * k)) ok = false;
            if (ok) hit = true;
          }
        }
      }
      if (hit) hits++;
    }
    return hits / 36;
  }

  // Eval cache (cleared at the start of each top-level ranking) so repeated
  // reply positions across the 21 opponent rolls aren't re-scored.
  let evalCache = new Map();
  function evaluate(board, player) {
    const ck = E.keyB(board) + ":" + player;
    const hit = evalCache.get(ck);
    if (hit !== undefined) return hit;
    const v = evaluateRaw(board, player);
    evalCache.set(ck, v);
    return v;
  }

  // Positional equity estimate for `player` (higher is better).
  function evaluateRaw(board, player) {
    const w = E.winner(board);
    if (w === player) return 100;
    if (w === -player) return -100;
    const b = E.normalized(board, player); // mover is positive
    let s = 0;

    const pm = pipNorm(b, +1), po = pipNorm(b, -1);
    s += (po - pm) * 0.10;                 // the race
    s += (b.offW - b.offB) * 0.5;          // bearing-off progress
    s += -b.barW * 1.2 + b.barB * 0.9;     // checkers on the bar

    // Home-board / blocking points (golden 5, bar 7, then 4, others).
    for (let p = 1; p <= 6; p++) if (b.points[p] >= 2) s += p === 5 ? 0.9 : p === 4 ? 0.7 : 0.45;
    if (b.points[7] >= 2) s += 0.6;        // bar point

    // Advanced anchors in the opponent's home (golden anchor = 20).
    for (let p = 19; p <= 24; p++) if (b.points[p] <= -2) {} // (opp anchors, ignored here)
    for (let p = 19; p <= 24; p++) if (b.points[p] >= 2) s += p === 20 ? 0.7 : 0.4;

    // Blots: penalize by how exposed they are.
    for (let p = 1; p <= 24; p++) if (b.points[p] === 1) s -= 0.25 + 1.2 * cheapShots(b, p);

    // Trapped back checkers, stacking, and burying.
    let back = 0;
    for (let p = 19; p <= 24; p++) if (b.points[p] > 0) back += b.points[p];
    s -= back * 0.12;
    for (let p = 1; p <= 24; p++) if (b.points[p] > 4) s -= (b.points[p] - 4) * 0.12;
    s -= Math.max(0, b.points[1] - 2) * 0.10 + Math.max(0, b.points[2] - 2) * 0.05;

    return s;
  }

  // 1-ply: average over the opponent's 21 rolls, opponent replying greedily.
  // Opponent replies are deduped by resulting board for speed.
  function score1ply(resultBoard, player) {
    if (E.winner(resultBoard) !== null) return evaluate(resultBoard, player);
    let total = 0, wsum = 0;
    for (const r of E.allRolls) {
      const oppPlays = E.uniquePlays(resultBoard, r.d1, r.d2, -player);
      let bestOpp = -Infinity;
      for (const pl of oppPlays) { const v = evaluate(pl.result, -player); if (v > bestOpp) bestOpp = v; }
      if (bestOpp === -Infinity) bestOpp = evaluate(resultBoard, -player);
      total += r.prob * -bestOpp;
      wsum += r.prob;
    }
    return total / wsum;
  }

  function scorePlay(play, player, plies) {
    return plies >= 1 ? score1ply(play.result, player) : evaluate(play.result, player);
  }

  // How many candidates get the (expensive) 1-ply treatment. The best play is
  // virtually always within the top few by 0-ply, so this bounds cost sharply.
  const ONE_PLY_CANDIDATES = 8;

  // Rank legal plays (best first). Candidates are deduped by resulting board;
  // for 1-ply we pre-sort by 0-ply and only deep-search the top-K. Used by the
  // AI and by Teach Me.
  function rankPlays(board, d1, d2, player, plies) {
    evalCache = new Map(); // fresh cache per top-level decision
    const unique = E.uniquePlays(board, d1, d2, player);
    const scored = unique.map((p) => ({ play: p, base: evaluate(p.result, player), score: 0 }));
    if (plies >= 1) {
      scored.sort((a, b) => b.base - a.base);
      const k = Math.min(ONE_PLY_CANDIDATES, scored.length);
      for (let i = 0; i < scored.length; i++) {
        scored[i].score = i < k ? score1ply(scored[i].play.result, player)
                                : scored[i].base - 1e-6; // keep un-searched tail below
      }
    } else {
      for (const s of scored) s.score = s.base;
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => ({ play: s.play, score: s.score }));
  }

  const LEVELS = {
    easy: { name: "Easy", plies: 0, blunderRate: 0.35, severity: 6, cube: false },
    medium: { name: "Medium", plies: 0, blunderRate: 0.15, severity: 3, cube: true },
    hard: { name: "Hard", plies: 1, blunderRate: 0.04, severity: 2, cube: true },
    expert: { name: "Expert", plies: 1, blunderRate: 0.0, severity: 1, cube: true },
  };

  // Choose a play for the AI at a difficulty (with realistic, bounded blunders).
  function choosePlay(board, d1, d2, player, level, rng) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const ranked = rankPlays(board, d1, d2, player, cfg.plies);
    if (ranked.length <= 1) return ranked[0] ? ranked[0].play : { moves: [], result: board };
    const r = rng ? rng() : Math.random();
    if (r < cfg.blunderRate) {
      const n = Math.min(cfg.severity, ranked.length);
      return ranked[(rng ? Math.floor(rng() * n) : Math.floor(Math.random() * n))].play;
    }
    return ranked[0].play;
  }

  // Map an equity estimate to a pseudo win-probability (for cube logic / display).
  const winProb = (board, player) => 1 / (1 + Math.exp(-evaluate(board, player) * 0.5));

  // Cube: should `player` offer a double now? (basic doubling window)
  function shouldDouble(board, player, level) {
    const cfg = LEVELS[level] || LEVELS.medium;
    if (!cfg.cube) return false;
    const wp = winProb(board, player);
    return wp >= 0.68 && wp <= 0.88; // double in the window; "too good" plays on
  }
  // Cube: should `player` take a double just offered to them?
  function shouldTake(board, player, level) {
    const cfg = LEVELS[level] || LEVELS.medium;
    if (!cfg.cube) return true;
    return winProb(board, player) >= 0.25; // 25% take point
  }

  return { evaluate, score1ply, scorePlay, rankPlays, choosePlay, winProb, shouldDouble, shouldTake, cheapShots, LEVELS };
});
