// engine.js — backgammon rules engine (browser + Node).
// A faithful port of Sources/BackgammonEngine (validated by dev/oracle).
//
// Conventions: points[1..24] from White's view, index 0 unused.
//   +n = n White checkers, -n = n Black checkers. White (= +1) moves high->low
//   and bears off past 1; Black (= -1) mirrors. All generation runs on a
//   normalized board (mover positive) and is de-normalized on the way out.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.Engine = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const WHITE = 1, BLACK = -1;

  function startingBoard() {
    const pts = new Array(25).fill(0);
    const setup = { 1: -2, 6: 5, 8: 3, 12: -5, 13: 5, 17: -3, 19: -5, 24: 2 };
    for (const k in setup) pts[+k] = setup[k];
    return { points: pts, barW: 0, barB: 0, offW: 0, offB: 0 };
  }

  const clone = (b) => ({ points: b.points.slice(), barW: b.barW, barB: b.barB, offW: b.offW, offB: b.offB });
  const bar = (b, pl) => (pl === WHITE ? b.barW : b.barB);
  const off = (b, pl) => (pl === WHITE ? b.offW : b.offB);
  const owns = (b, p, pl) => (pl === WHITE ? b.points[p] > 0 : b.points[p] < 0);
  const count = (b, p, pl) => { const v = b.points[p]; return pl === WHITE ? (v > 0 ? v : 0) : (v < 0 ? -v : 0); };

  function checkerCount(b, pl) {
    let c = bar(b, pl) + off(b, pl);
    for (let p = 1; p <= 24; p++) c += count(b, p, pl);
    return c;
  }

  function mirrored(b) {
    const np = new Array(25).fill(0);
    for (let p = 1; p <= 24; p++) np[p] = -b.points[25 - p];
    return { points: np, barW: b.barB, barB: b.barW, offW: b.offB, offB: b.offW };
  }
  const normalized = (b, pl) => (pl === WHITE ? b : mirrored(b));

  function winner(b) { if (b.offW === 15) return WHITE; if (b.offB === 15) return BLACK; return null; }

  function winType(b) {
    const w = winner(b);
    if (w === null) return null;
    const loser = -w;
    if (off(b, loser) > 0) return "single";
    if (bar(b, loser) > 0) return "backgammon";
    const home = w === WHITE ? [1, 6] : [19, 24];
    for (let p = home[0]; p <= home[1]; p++) if (owns(b, p, loser)) return "backgammon";
    return "gammon";
  }

  function pipCount(b, pl) {
    let pips = bar(b, pl) * 25;
    for (let p = 1; p <= 24; p++) if (owns(b, p, pl)) {
      const dist = pl === WHITE ? p : 25 - p;
      pips += count(b, p, pl) * dist;
    }
    return pips;
  }

  // --- normalized helpers (mover positive) ---
  const canLand = (b, p) => b.points[p] >= -1;
  function allHome(b) {
    if (b.barW > 0) return false;
    for (let p = 7; p <= 24; p++) if (b.points[p] > 0) return false;
    return true;
  }
  function noneHigher(b, p) {
    if (p >= 6) return true;
    for (let q = p + 1; q <= 6; q++) if (b.points[q] > 0) return false;
    return true;
  }

  function singleStepMoves(b, die) {
    const moves = [];
    if (b.barW > 0) {
      const entry = 25 - die;
      if (canLand(b, entry)) moves.push({ from: 25, to: entry, die });
      return moves;
    }
    for (let p = 24; p >= 1; p--) if (b.points[p] > 0) {
      const dest = p - die;
      if (dest >= 1 && canLand(b, dest)) moves.push({ from: p, to: dest, die });
    }
    if (allHome(b)) {
      for (let p = 1; p <= 6; p++) if (b.points[p] > 0) {
        if (p === die) moves.push({ from: p, to: 0, die });
        else if (die > p && noneHigher(b, p)) moves.push({ from: p, to: 0, die });
      }
    }
    return moves;
  }

  // Apply a single move on a NORMALIZED board (mover positive).
  function applyNorm(m, b) {
    const nb = clone(b);
    if (m.from === 25) nb.barW--; else nb.points[m.from]--;
    if (m.to === 0) nb.offW++;
    else {
      if (nb.points[m.to] < 0) { nb.points[m.to] = 0; nb.barB++; }
      nb.points[m.to]++;
    }
    return nb;
  }

  // Apply a single move on a REAL board for `pl` (used by UI/AI step-by-step).
  function applyMove(b, m, pl) {
    const nb = clone(b);
    if (m.from === 25) { if (pl === WHITE) nb.barW--; else nb.barB--; }
    else nb.points[m.from] -= pl;
    if (m.to === 0) { if (pl === WHITE) nb.offW++; else nb.offB++; }
    else {
      if (nb.points[m.to] === -pl) { nb.points[m.to] = 0; if (pl === WHITE) nb.barB++; else nb.barW++; }
      nb.points[m.to] += pl;
    }
    return nb;
  }

  const keyB = (b) => b.points.join(",") + "|" + b.barW + "," + b.barB + "|" + b.offW + "," + b.offB;

  function explore(b, remaining, acc, out, state) {
    if (acc.length > state.max) state.max = acc.length;
    if (acc.length > 0) {
      const k = acc.map((m) => m.from + ">" + m.to + ":" + m.die).join(";") + "#" + keyB(b);
      out.set(k, { moves: acc.slice(), result: b });
    }
    if (remaining.length === 0) return;
    const die = remaining[0], rest = remaining.slice(1);
    for (const mv of singleStepMoves(b, die)) explore(applyNorm(mv, b), rest, acc.concat([mv]), out, state);
  }

  const flip = (x) => (x === 0 || x === 25 ? x : 25 - x);
  function denorm(play, pl) {
    if (pl === WHITE) return play;
    const moves = play.moves.map((m) => ({ from: flip(m.from), to: flip(m.to), die: m.die }));
    return { moves, result: normalized(play.result, pl) };
  }

  function legalPlays(b, d1, d2, pl) {
    const norm = normalized(b, pl);
    const isDouble = d1 === d2;
    const orderings = isDouble ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
    const out = new Map();
    const state = { max: 0 };
    for (const seq of orderings) explore(norm, seq, [], out, state);
    let best = [...out.values()].filter((p) => p.moves.length === state.max);
    if (state.max === 1 && !isDouble) {
      const larger = Math.max(d1, d2);
      const wl = best.filter((p) => p.moves[0].die === larger);
      if (wl.length) best = wl;
    }
    if (best.length === 0) best = [{ moves: [], result: norm }];
    return best.map((p) => denorm(p, pl));
  }

  // Distinct legal plays by *resulting board* (collapses the many move orders
  // that reach the same position — essential for fast search on doubles).
  function uniquePlays(b, d1, d2, pl) {
    const all = legalPlays(b, d1, d2, pl);
    const seen = new Map();
    for (const p of all) { const k = keyB(p.result); if (!seen.has(k)) seen.set(k, p); }
    return [...seen.values()];
  }

  // All 21 distinct rolls with their /36 weight.
  const allRolls = (() => {
    const r = [];
    for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) r.push({ d1: a, d2: b, prob: a === b ? 1 : 2 });
    return r;
  })();

  return {
    WHITE, BLACK,
    startingBoard, clone, bar, off, owns, count, checkerCount,
    mirrored, normalized, winner, winType, pipCount,
    singleStepMoves, applyNorm, applyMove, legalPlays, uniquePlays, keyB, allRolls,
  };
});

