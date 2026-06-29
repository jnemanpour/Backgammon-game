// engine.test.js — Node parity/property tests for the JS engine.
// Run: node web/engine.test.js
const E = require("./engine.js");
let checks = 0, failures = [];
function check(c, m) { checks++; if (!c) { failures.push(m); console.log("FAIL:", m); } }

function boardFrom(map, bar = [0, 0], off = [0, 0]) {
  const pts = new Array(25).fill(0);
  for (const k in map) pts[+k] = map[k];
  return { points: pts, barW: bar[0], barB: bar[1], offW: off[0], offB: off[1] };
}

const start = E.startingBoard();
check(E.checkerCount(start, E.WHITE) === 15, "white 15 at start");
check(E.checkerCount(start, E.BLACK) === 15, "black 15 at start");
check(E.pipCount(start, E.WHITE) === 167, "white pip 167");
check(E.pipCount(start, E.BLACK) === 167, "black pip 167");
check(JSON.stringify(E.mirrored(E.mirrored(start))) === JSON.stringify(start), "mirror involution");

// 3-1 makes the 5-point
let plays = E.legalPlays(start, 3, 1, E.WHITE);
check(plays.some(p => p.result.points[5] === 2 && p.result.points[8] === 2 && p.result.points[6] === 4), "3-1 makes 5-pt");
check(plays.every(p => p.moves.length === 2), "3-1 uses both dice");

// larger-die rule
plays = E.legalPlays(boardFrom({ 6: 1, 4: -2 }), 5, 2, E.WHITE);
check(plays.length === 1 && plays[0].moves[0].die === 5 && plays[0].moves[0].to === 1, "larger die forced");

// bear-off overshoot
plays = E.legalPlays(boardFrom({ 4: 2, 2: 2, 1: 2 }, [0, 0], [9, 0]), 6, 6, E.WHITE);
check([...new Set(plays.map(p => p.moves[0].from))].join() === "4", "overshoot bears the 4");

// blocked bar entry -> forfeit
plays = E.legalPlays(boardFrom({ 19: -2, 20: -2, 6: 5 }, [1, 0]), 6, 5, E.WHITE);
check(plays.length === 1 && plays[0].moves.length === 0, "blocked bar -> forfeit");

// hit + make point
plays = E.legalPlays(boardFrom({ 8: 1, 6: 1, 5: -1 }), 3, 1, E.WHITE);
check(plays.some(p => p.result.points[5] === 2 && p.result.barB === 1), "hit and make 5-pt");

// win types
check(E.winType({ points: new Array(25).fill(0).map((_, i) => i === 6 ? -12 : 0), barW: 0, barB: 0, offW: 15, offB: 3 }) === "single", "single");
check(E.winType({ points: new Array(25).fill(0).map((_, i) => i === 13 ? -15 : 0), barW: 0, barB: 0, offW: 15, offB: 0 }) === "gammon", "gammon");
check(E.winType({ points: new Array(25).fill(0).map((_, i) => i === 3 ? -15 : 0), barW: 0, barB: 0, offW: 15, offB: 0 }) === "backgammon", "backgammon");

// property: conservation + max-dice uniformity + larger-die over random play
function rnd(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
const rand = rnd(987654321);
const di = () => 1 + Math.floor(rand() * 6);
let propPos = 0;
for (let t = 0; t < 300; t++) {
  let b = E.startingBoard(), pl = E.WHITE;
  const turns = Math.floor(rand() * 40);
  for (let i = 0; i < turns; i++) {
    if (E.winner(b) !== null) break;
    const ps = E.legalPlays(b, di(), di(), pl);
    b = ps[Math.floor(rand() * ps.length)].result; pl = -pl;
  }
  if (E.winner(b) !== null) continue;
  for (const who of [E.WHITE, E.BLACK]) for (const r of E.allRolls) {
    const ps = E.legalPlays(b, r.d1, r.d2, who); propPos++;
    for (const p of ps) {
      if (E.checkerCount(p.result, E.WHITE) !== 15 || E.checkerCount(p.result, E.BLACK) !== 15) { check(false, "count!=15"); break; }
    }
    const counts = new Set(ps.map(p => p.moves.length));
    check(counts.size === 1, "uniform dice usage");
    const used = [...counts][0];
    if (used === 1 && r.d1 !== r.d2) {
      const norm = E.normalized(b, who);
      const sm = Math.min(r.d1, r.d2), lg = Math.max(r.d1, r.d2);
      if (E.singleStepMoves(norm, sm).length && E.singleStepMoves(norm, lg).length)
        check(ps.every(p => p.moves[0].die === lg), "larger-die over random");
    }
  }
}
console.log(`\nRan ${checks} checks over ${propPos} property positions.`);
if (failures.length) { console.log(`${failures.length} FAILURE(S)`); process.exit(1); }
console.log("ALL PASSED");
