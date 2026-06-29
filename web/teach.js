// teach.js — "Teach Me" analysis built on the same evaluator the AI uses.
// Surfaces the best play, classifies the player's choice, and generates the
// "why" from a before/after diff of the board (mapped to strategy concepts).
(function (root, factory) {
  const mod = factory(
    typeof require === "function" ? require("./engine.js") : root.Engine,
    typeof require === "function" ? require("./ai.js") : root.AI
  );
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.Teach = mod;
})(typeof self !== "undefined" ? self : this, function (E, AI) {
  "use strict";

  // Teach always analyses at the strongest affordable depth (1-ply), even when
  // the player is on Easy — the lesson must be correct.
  const TEACH_PLIES = 1;

  // Engine-exact: how many of 36 rolls let `hitter` hit a blot on `point`.
  function exactHitRolls(board, point, hitter) {
    const victim = -hitter;
    const before = E.count(board, point, victim);
    if (before !== 1) return 0;
    let n = 0;
    for (const r of E.allRolls) {
      const plays = E.legalPlays(board, r.d1, r.d2, hitter);
      if (plays.some((p) => E.count(p.result, point, victim) < before)) n += r.prob;
    }
    return n; // out of 36
  }

  // Concept helpers operate in the player's normalized frame (home = 1..6, etc).
  const madePoint = (after, before, p) => after.points[p] >= 2 && before.points[p] < 2;
  function blots(b) { let n = 0; for (let p = 1; p <= 24; p++) if (b.points[p] === 1) n++; return n; }
  function backCheckers(b) { let n = 0; for (let p = 19; p <= 24; p++) if (b.points[p] > 0) n += b.points[p]; return n; }

  function reasonsFor(bestPlay, chosenPlay, board, player) {
    const before = E.normalized(board, player);
    const after = E.normalized(bestPlay.result, player);
    const reasons = [];

    if (madePoint(after, before, 5)) reasons.push("Makes your 5-point (the ‘golden point’) — your most valuable blocking point.");
    if (madePoint(after, before, 7)) reasons.push("Makes the bar-point, building a wall in front of the opponent’s back checkers.");
    if (madePoint(after, before, 4)) reasons.push("Makes your 4-point, strengthening your home board.");
    for (const p of [3, 6]) if (madePoint(after, before, p)) reasons.push(`Makes your ${p}-point.`);
    if (after.points[20] >= 2 && before.points[20] < 2) reasons.push("Secures the golden anchor (opponent’s 5-point) — your best defensive point.");

    if (backCheckers(after) < backCheckers(before)) reasons.push("Escapes a back checker toward safety.");
    if (after.barB > before.barB) reasons.push("Hits an opponent blot, sending it to the bar and costing them tempo.");
    if (blots(after) < blots(before)) reasons.push("Reduces the number of blots you leave exposed.");
    if (E.off(bestPlay.result, player) > E.off(board, player)) reasons.push("Bears a checker off, banking progress toward the win.");

    // Contrast with the player's choice: quantify extra risk it takes on.
    if (chosenPlay && chosenPlay !== bestPlay) {
      let worst = null;
      for (let p = 1; p <= 24; p++) {
        if (E.count(chosenPlay.result, p, player) === 1) {
          const shots = exactHitRolls(chosenPlay.result, p, -player);
          if (shots > 0 && (!worst || shots > worst.shots)) worst = { point: p, shots };
        }
      }
      if (worst) reasons.push(`Your move leaves a blot hittable by ${worst.shots} of 36 rolls — the recommended move is safer here.`);
    }

    if (reasons.length === 0) reasons.push("Best by the numbers — it keeps the most flexible position and the best equity.");
    return reasons;
  }

  // Verdict thresholds in this evaluator's equity units (not real millipoints).
  function verdictFrom(loss) {
    if (loss < 0.02) return "best";
    if (loss < 0.08) return "good";
    if (loss < 0.16) return "doubtful";
    if (loss < 0.35) return "error";
    return "blunder";
  }

  // Pre-move: rank the player's options so we can highlight the best.
  function analyze(board, d1, d2, player) {
    const ranked = AI.rankPlays(board, d1, d2, player, TEACH_PLIES);
    return { ranked, best: ranked[0] };
  }

  // Post-move: grade the play the player actually made.
  function review(analysis, chosenPlay, board, player) {
    const best = analysis.best;
    const chosen = analysis.ranked.find((r) => samePlay(r.play, chosenPlay)) || { play: chosenPlay, score: AI.scorePlay(chosenPlay, player, TEACH_PLIES) };
    const loss = Math.max(0, best.score - chosen.score);
    return {
      verdict: verdictFrom(loss),
      loss,
      reasons: reasonsFor(best.play, chosenPlay, board, player),
      bestPlay: best.play,
    };
  }

  function samePlay(a, b) {
    if (!a || !b || a.moves.length !== b.moves.length) return false;
    for (let i = 0; i < a.moves.length; i++)
      if (a.moves[i].from !== b.moves[i].from || a.moves[i].to !== b.moves[i].to) return false;
    return true;
  }

  // Tier-aware phrasing of a review.
  function phrase(review, tier) {
    const r = review.reasons;
    if (tier === "beginner") return r[0];
    if (tier === "advanced") return r.join(" ") + `  (Equity cost of your move: ${review.loss.toFixed(3)}.)`;
    return r.slice(0, 3).join(" "); // intermediate
  }

  const VERDICT_LABEL = { best: "Best ✓", good: "Good", doubtful: "Doubtful ?!", error: "Error ?", blunder: "Blunder ??" };

  return { analyze, review, phrase, exactHitRolls, verdictFrom, samePlay, VERDICT_LABEL, TEACH_PLIES };
});

