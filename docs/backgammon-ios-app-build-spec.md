# Backgammon iPhone App — Build Specification & Coding Guide

A complete technical plan for a native iOS backgammon app that (a) plays a full game with **Easy / Medium / Hard / Expert** opponents and (b) has a **Teach Me mode** that explains the rules and the next best move *and why*, adapted to the player's level.

This pairs with the rules/strategy guide — the strategy content there is the knowledge base your "why" explanations draw from.

---

## 0. Assumptions (change these if wrong)

- **Single-player vs. the AI first.** Online multiplayer is a later phase (it's a different, larger problem — netcode, matchmaking, anti-cheat).
- **iPhone-first, native.** iPad support is mostly free with SwiftUI/SpriteKit adaptive layout.
- **Solo developer or small team**, comfortable with code, likely leaning on an AI coding assistant. (Your background is web/React — see the cross-platform note in §1.)
- **Offline-capable.** The engine runs on-device; no server round-trip needed to play or to teach.

---

## 1. Tech Stack

**Recommended (best product):**

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **Swift 6** | Native, fast, modern concurrency for running the engine off the main thread. |
| Menus / Teaching UI / settings | **SwiftUI** | Declarative, fast to build, adaptive layouts. |
| Board rendering, drag, animation | **SpriteKit** | Apple's native 2D engine — 120 FPS, low battery, integrates with Metal/Game Center/haptics. Embed a `SpriteView` inside SwiftUI. |
| AI heavy lifting | **Plain Swift** (or a C/C++ core via a bridging header) | The evaluator is just math; keep it pure and testable. C/C++ lets you reuse the public-domain pubeval source almost verbatim. |
| On-device neural net | **Core ML** (optional) or hand-rolled matrix math | A TD-Gammon net is tiny (one hidden layer); you can run it with Accelerate/`simd` without Core ML if you prefer. |
| Persistence | **SwiftData** (iOS 17+) or Codable→JSON | Save games, settings, stats, lesson progress. |
| Multiplayer (later) | **Game Center** `GKTurnBasedMatch` | Native turn-based multiplayer with zero server cost. |
| Haptics | **Core Haptics** | Dice roll, checker placement, hit feedback. |

**Cross-platform fallback (given your web skills):** React Native (Expo) or a web app wrapped in Capacitor will get you to a working build faster *because you already know the ecosystem*, and the engine (the hard part) is pure logic that ports anywhere. The tradeoffs: weaker animation polish, no SpriteKit, more friction with Game Center/haptics, and a less "premium" feel. **Recommendation:** if this is a product you want to feel great, invest in native Swift; if it's an MVP to validate the idea, React Native is defensible. The rest of this doc is written for native but the architecture is identical in either.

---

## 2. Architecture (MVVM + isolated engine)

Keep four layers strictly separated. The golden rule: **the rules engine and the AI engine know nothing about the UI.** They take a game state and return facts (legal moves, evaluations). This makes them unit-testable and reusable for the teaching layer.

```
┌──────────────────────────────────────────────┐
│  UI LAYER (SwiftUI + SpriteKit)              │
│  BoardScene, dice, cube, drag, animations,   │
│  TeachMe overlay, menus, settings            │
└───────────────┬──────────────────────────────┘
                │ observes / sends intents
┌───────────────▼──────────────────────────────┐
│  VIEW MODELS (GameViewModel)                  │
│  current state, turn flow, difficulty config, │
│  teach-mode toggle, undo stack                │
└───────────────┬──────────────────────────────┘
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌────────────────────────────┐
│ RULES ENGINE │  │ AI ENGINE                  │
│ board model, │  │ evaluator(s), move chooser,│
│ legal move   │  │ difficulty policy,         │
│ generation,  │  │ cube decisions,            │
│ apply move,  │  │ annotation/explanations    │
│ win detection│  │ (uses RULES ENGINE)        │
└──────────────┘  └────────────────────────────┘
```

---

## 3. Module 1 — Core Model & Rules Engine

This is the **correctness-critical** part. If move generation is wrong, every layer above it (AI, teaching) is wrong. Test it relentlessly (§9).

### 3.1 Board representation

A signed array is the most intuitive. Points `1...24` from White's perspective; `+` = White, `−` = Black. Bar and off tracked separately.

```swift
enum Player: Int { case white = 1, black = -1
    var opponent: Player { self == .white ? .black : .white }
}

struct Board: Equatable, Hashable {
    // index 0 unused; points 1...24 from White's view.
    // Positive = White checker count, negative = Black checker count.
    var points: [Int]            // length 25
    var bar:  [Player: Int]      // checkers on the bar
    var off:  [Player: Int]      // checkers borne off

    static let starting = Board(
        points: [0,
            -2, 0, 0, 0, 0, 5,      // 1..6   (Black's 2 on White's 1-pt, etc.)
             0, 0, 0, 0, 0, -5,     // 7..12
             5, 0, 0, 0, 0, 0,      // 13..18
            -5, 0, 0, 0, 0, 2],     // 19..24
        bar: [.white: 0, .black: 0],
        off: [.white: 0, .black: 0])
}
```

> **Direction convention:** White moves 24→1 and bears off past 1; Black moves 1→24 and bears off past 24. To keep the engine symmetric, write all logic from "the player on move" perspective and *normalize* by flipping the board for Black (a `normalized(for:)` helper that mirrors points 1..24 → 24..1 and swaps signs). This is the single biggest simplifier — the gnubg codebase does exactly this. Every rule below is then written **only** for "moving from high points toward 0, bearing off below 1."

### 3.2 The data the engine produces

```swift
/// A single die-step: move one checker `from` a point `to` a point (0 = borne off).
struct CheckerMove: Equatable { let from: Int; let to: Int; let die: Int }

/// A full legal play for a dice roll (1–4 steps), plus the resulting board.
struct Play: Equatable, Hashable {
    let moves: [CheckerMove]
    let result: Board
}

struct DiceRoll { let d1: Int; let d2: Int
    var isDouble: Bool { d1 == d2 }
    /// Dice to consume: doubles give four.
    var dice: [Int] { isDouble ? [d1, d1, d1, d1] : [d1, d2] }
}
```

### 3.3 Legal move generation (the hard part)

The official rules you must encode (see the rules guide §3): use both dice if possible; if only one can be played, play it; if either die alone is playable but not both, **the larger must be played**; bar checkers enter first; doubles play four times; bearing off requires all 15 home and the higher-die overshoot rule.

The clean way is recursive enumeration of *all* full plays, then filter by the max-dice and larger-die rules.

```swift
struct RulesEngine {

    /// All legal full plays for `board` (player-on-move, normalized) and `roll`.
    static func legalPlays(_ board: Board, _ roll: DiceRoll, player: Player) -> [Play] {
        var results = Set<Play>()

        // Try both die orderings for non-doubles so we don't miss sequences.
        let orderings: [[Int]] = roll.isDouble
            ? [[roll.d1, roll.d1, roll.d1, roll.d1]]
            : [[roll.d1, roll.d2], [roll.d2, roll.d1]]

        var maxDiceUsed = 0
        for seq in orderings {
            explore(board, seq, player, [], &results, &maxDiceUsed)
        }

        // RULE: you must play as many dice as possible.
        let best = results.filter { $0.moves.count == maxDiceUsed }

        // RULE: if exactly one die can be played (non-double) and either is
        // individually playable, the LARGER must be used. Enforce when maxDiceUsed == 1.
        if maxDiceUsed == 1 && !roll.isDouble {
            let larger = max(roll.d1, roll.d2)
            let withLarger = best.filter { $0.moves.first?.die == larger }
            if !withLarger.isEmpty { return Array(withLarger) }
        }
        return best.isEmpty ? [Play(moves: [], result: board)] : Array(best)
    }

    private static func explore(_ board: Board, _ remaining: [Int], _ player: Player,
                                _ acc: [CheckerMove], _ out: inout Set<Play>,
                                _ maxUsed: inout Int) {
        if acc.count > maxUsed { maxUsed = acc.count }
        if !acc.isEmpty { out.insert(Play(moves: acc, result: board)) }
        guard let die = remaining.first else { return }
        let rest = Array(remaining.dropFirst())

        for mv in singleStepMoves(board, die: die, player: player) {
            let next = apply(mv, to: board, player: player)
            explore(next, rest, player, acc + [mv], &out, &maxUsed)
        }
        // Doubles can also be explored die-by-die naturally via `rest`.
    }

    /// All legal single-checker moves for one die value.
    static func singleStepMoves(_ board: Board, die: Int, player: Player) -> [CheckerMove] {
        var moves: [CheckerMove] = []

        // 1) If checkers on the bar, they MUST enter first.
        if board.bar[player]! > 0 {
            let entry = 25 - die                 // normalized: bar enters at 25-die
            if canLand(board, point: entry, player: player) {
                moves.append(CheckerMove(from: 25, to: entry, die: die))
            }
            return moves                         // nothing else until bar is clear
        }

        // 2) Normal moves from each occupied point.
        for p in stride(from: 24, through: 1, by: -1) where owns(board, p, player) {
            let dest = p - die
            if dest >= 1, canLand(board, point: dest, player: player) {
                moves.append(CheckerMove(from: p, to: dest, die: die))
            }
        }

        // 3) Bearing off (only if all 15 are home: points 1...6).
        if allHome(board, player) {
            for p in 1...6 where owns(board, p, player) {
                if p == die {
                    moves.append(CheckerMove(from: p, to: 0, die: die))      // exact
                } else if die > p && noCheckersHigherThan(board, p, player) {
                    moves.append(CheckerMove(from: p, to: 0, die: die))      // overshoot
                }
            }
        }
        return moves
    }

    // Helpers: owns(), canLand() [open / own / single-blot], allHome(),
    // noCheckersHigherThan(), apply() [moves checker, handles hitting → bar].
    // apply() must: decrement source, increment dest, and if dest held a single
    // enemy checker, send it to the bar.
}
```

Then: `apply(play:)` to commit, and `winner(of:)` / `winType(...)` to detect single / gammon / backgammon (rules guide §7).

### 3.4 Pip count (needed by AI and teaching)

```swift
extension Board {
    func pipCount(for player: Player) -> Int {
        var pips = bar[player]! * 25
        for p in 1...24 where owns(self, p, player) {
            // distance to bear off, from the player's perspective
            let dist = (player == .white) ? p : (25 - p)
            pips += abs(points[p]) * dist
        }
        return pips
    }
}
```

---

## 4. Module 2 — AI Engine (opponent + the brain behind teaching)

### 4.1 The core idea

Every decision in backgammon reduces to: **enumerate legal plays → score each with an evaluator → pick the highest.** The evaluator returns a win-probability (or equity). Strength = quality of the evaluator + how many plies deep you look + whether you roll out.

This single function also powers Teach Me mode: the ranked list of plays by equity *is* the lesson.

```swift
protocol Evaluator {
    /// Probability (0...1) that the player-on-move wins from this board,
    /// ideally split into win/gammon/backgammon for cube + gammon logic.
    func evaluate(_ board: Board, player: Player) -> Equity
}

struct Equity {            // cubeless probabilities from player-on-move's view
    var win: Double        // P(win, any kind)
    var winG: Double       // P(win a gammon)
    var winBG: Double      // P(win a backgammon)
    var loseG: Double
    var loseBG: Double
    /// Single scalar for ranking plays (money-game equity).
    var value: Double {
        (win + winG + winBG) - ((1 - win) + loseG + loseBG)
    }
}
```

### 4.2 Three evaluators, increasing strength — and the LICENSE rule

> ⚠️ **Licensing — read before you choose an engine.**
> - **pubeval** (Gerald Tesauro): **public domain.** Safe to ship in a closed-source App Store app. Intermediate strength. Use it for Easy/Medium and as a baseline.
> - **Your own TD-Gammon-style net:** you train the weights yourself via self-play, so **you own them.** Safe to ship. Can reach near-expert.
> - **GNU Backgammon (gnubg):** world-class **but GPL-licensed.** If you embed its code *or its neural-net weight files* in your app, the GPL obligates you to release your **entire app** under GPL (open source). **Do not ship gnubg in a closed-source app.** You *may* use it privately during development as an oracle (validate your move generator, generate training positions, benchmark your net). That offline use creates no distribution obligation.

**(a) pubeval — public-domain linear evaluator.** Two weight vectors (one for race, one for contact positions), each scoring a 122-feature encoding of the board. Grab the canonical public-domain source (Tesauro's `pubeval.c`) and port the `setx()` feature encoding + dot product to Swift, or drop the C file in via a bridging header. It's ~100 lines.

```swift
struct PubEval: Evaluator {
    let raceWeights: [Double]      // load from bundled public-domain data
    let contactWeights: [Double]
    func evaluate(_ board: Board, player: Player) -> Equity {
        let x = encode122(board, player)              // pubeval's feature vector
        let race = isRace(board)                      // no contact?
        let w = race ? raceWeights : contactWeights
        let score = zip(x, w).reduce(0) { $0 + $1.0 * $1.1 }
        // pubeval returns a relative score; squash to a pseudo-probability.
        return Equity(win: sigmoid(score), winG: 0, winBG: 0, loseG: 0, loseBG: 0)
    }
}
```

**(b) TD-Gammon-style neural net — your own, ship-safe, strong.** One hidden layer (80–160 units), sigmoid, output = 4–5 win/gammon probabilities. Train it with TD(λ) self-play (open-source reference implementations exist to follow, e.g. TD-Gammon reimplementations on GitHub). Inputs: the classic Tesauro encoding (per point: unary-ish encoding of checker counts) + a few engineered features (pip count, bar, off). Training is a one-time offline job; you bundle the resulting weights (a small file) in the app.

```swift
struct NeuralEvaluator: Evaluator {
    let w1: [[Double]]; let b1: [Double]   // input→hidden
    let w2: [[Double]]; let b2: [Double]   // hidden→output (5 outputs)
    func evaluate(_ board: Board, player: Player) -> Equity {
        let x = encodeFeatures(board, player)
        let h = matVec(w1, x).enumerated().map { sigmoid($0.element + b1[$0.offset]) }
        let o = matVec(w2, h).enumerated().map { sigmoid($0.element + b2[$0.offset]) }
        return Equity(win: o[0], winG: o[1], winBG: o[2], loseG: o[3], loseBG: o[4])
    }
}
```

**(c) Ply search + rollouts (for Hard/Expert).** Wrap any evaluator:
- **0-ply:** evaluate the resulting position directly (fast, instant).
- **1-ply:** for each candidate play, average the evaluator over all 21 of the opponent's dice rolls (opponent plays greedily). Much stronger, ~21× cost.
- **2-ply:** recurse one more level (expensive; cache).
- **Rollouts:** play the position out to the end many times with random dice + the evaluator choosing moves; average the result. This is the gold standard, used mainly for cube decisions and Teach Me "deep analysis," not every move (too slow live).

Run all of this **off the main thread** (`Task.detached` / a background actor) and show a subtle "thinking" indicator.

### 4.3 Difficulty levels (Easy / Medium / Hard / Expert)

Difficulty = which evaluator + how deep + **how much deliberate error you inject.** Injecting error realistically (occasionally picking a slightly worse move) feels more human and teachable than a bot that's just weak everywhere.

```swift
struct Difficulty {
    let evaluator: Evaluator
    let plies: Int
    let blunderRate: Double      // chance of NOT picking the best play
    let blunderSeverity: Int     // when blundering, pick from top-N instead of #1
    let usesCube: Bool
    let cubeSkill: Double        // 0 = naive, 1 = near-optimal

    static let easy   = Difficulty(evaluator: pubeval, plies: 0,
                        blunderRate: 0.35, blunderSeverity: 6,
                        usesCube: false, cubeSkill: 0.0)
    static let medium = Difficulty(evaluator: pubeval, plies: 0,
                        blunderRate: 0.15, blunderSeverity: 3,
                        usesCube: true,  cubeSkill: 0.4)
    static let hard   = Difficulty(evaluator: net,     plies: 1,
                        blunderRate: 0.04, blunderSeverity: 2,
                        usesCube: true,  cubeSkill: 0.8)
    static let expert = Difficulty(evaluator: net,     plies: 2,
                        blunderRate: 0.0,  blunderSeverity: 1,
                        usesCube: true,  cubeSkill: 1.0)   // + rollouts for cube
}

func choosePlay(_ board: Board, _ roll: DiceRoll, player: Player,
                _ d: Difficulty) -> Play {
    let plays = RulesEngine.legalPlays(board, roll, player: player)
    guard plays.count > 1 else { return plays.first ?? Play(moves: [], result: board) }

    let ranked = plays
        .map { ($0, scoreWithPlies($0.result, player, d.evaluator, d.plies)) }
        .sorted { $0.1 > $1.1 }                 // best equity first

    if Double.random(in: 0...1) < d.blunderRate {
        let n = min(d.blunderSeverity, ranked.count)
        return ranked[Int.random(in: 0..<n)].0  // realistic "human" slip
    }
    return ranked.first!.0
}
```

### 4.4 Cube decisions

Use the rules-guide §16 math: **take if win chance ≥ ~25%** (a bit lower with recube potential); **double around ~65–70%+** unless **too good** (strong gammon threat → play on). Easy ignores the cube; Medium uses crude thresholds; Hard/Expert use the evaluator's gammon-split probabilities and (Expert) a short rollout to decide double/take/pass. Gate aggressiveness by `cubeSkill`.

---

## 5. Module 3 — Teach Me Mode

The teaching content is **generated from the same evaluator**, so it's always consistent with how the AI actually plays. Three sub-features:

### 5.1 "How to play" — structured onboarding
Static, level-gated lessons (drawn from the rules/strategy guide): setup → movement → hitting/entering → making points → bearing off → the cube → game plans. Interactive: set up a position, ask the player to find a move, validate against the engine. Keep these as data (JSON), not hard-code, so you can add lessons without shipping new builds.

### 5.2 "Next best move + why" — the core feature
When it's the player's turn (and Teach Me is on), before they move:

1. Generate all legal plays, score each (use the strongest evaluator you can afford live — Hard/Expert quality even if they're playing Easy; the *lesson* should be correct).
2. Surface the **best play**, the player's **intended play** (if different), and the **equity gap** between them.
3. Classify the gap into a verdict and explain *why*, from position features.

```swift
enum MoveVerdict: String {           // mirrors how bots annotate
    case best, good, doubtful, error, blunder
    static func from(equityLossMillipoints loss: Double) -> MoveVerdict {
        switch loss {
        case ..<2:    return .best
        case ..<20:   return .good
        case ..<40:   return .doubtful
        case ..<80:   return .error
        default:      return .blunder
        }
    }
}

struct MoveLesson {
    let bestPlay: Play
    let playerPlay: Play?
    let equityLoss: Double
    let verdict: MoveVerdict
    let reasons: [String]            // generated explanation
    let conceptTags: [String]        // ["make 5-point","escape back checker"...]
}
```

**Generating the "why".** Diff the board *before* vs *after* the best play and tag the strategic ideas (these map directly to the strategy guide):

```swift
func explain(best: Play, alt: Play?, board: Board, player: Player) -> [String] {
    var reasons: [String] = []
    let b = best.result

    if madePoint(b, board, point: 5, player)  { reasons.append(
        "Makes your 5-point (the 'golden point') — your most valuable blocking point.") }
    if madePoint(b, board, point: 7, player)  { reasons.append(
        "Makes the bar-point, building a wall in front of the opponent's back checkers.") }
    if madeAnchor(b, board, point: 20, player){ reasons.append(
        "Secures the golden anchor (opponent's 5-point) — your best defensive point.") }
    if escapedBackChecker(b, board, player)   { reasons.append(
        "Escapes a back checker toward safety.") }

    let blotsBefore = blotsExposed(board, player)
    let blotsAfter  = blotsExposed(b, player)
    if blotsAfter < blotsBefore { reasons.append("Reduces the number of blots you leave.") }

    if let alt = alt, alt != best {
        let shots = directShotsAgainst(alt.result, player)
        if shots > directShotsAgainst(b, player) {
            reasons.append("Your move leaves a blot hittable by \(shots) of 36 rolls — "
                         + "the recommended move is safer here.")
        }
    }
    if reasons.isEmpty { reasons.append(
        "Best by the numbers — it keeps the most flexible position and the best equity.") }
    return reasons
}
```

### 5.3 Adapt to the player's level
Track a skill estimate (start from chosen difficulty; refine from their average equity-loss per move over time). Then tune the explanation:

```swift
enum SkillTier { case beginner, intermediate, advanced }

func phrase(_ lesson: MoveLesson, for tier: SkillTier) -> String {
    switch tier {
    case .beginner:                       // plain language, one idea, no jargon
        return lesson.reasons.first.map(deJargon) ?? "This is the safest, strongest move."
    case .intermediate:                   // 2–3 reasons + the concept names
        return lesson.reasons.prefix(3).joined(separator: " ")
    case .advanced:                       // full detail + the equity numbers
        return lesson.reasons.joined(separator: " ")
             + String(format: " (Equity cost of your move: %.3f.)", lesson.equityLoss/1000)
    }
}
```

Beginners get one plain-English reason and gentle verdicts; advanced players get the full feature list, the shot counts, and the millipoint equity loss. Let the user override the tier in settings.

---

## 6. Module 4 — UI / UX (SpriteKit board + SwiftUI shell)

- **Board (`SKScene`):** 24 point nodes, bar, two off-trays, the cube. Checkers are `SKSpriteNode`s. Embed via `SpriteView(scene:)` inside your SwiftUI game screen.
- **Interaction:** on roll, ask the engine for legal plays and **highlight only legal destinations** for the touched checker (huge for learnability). Drag-and-drop with snap-to-point; tap-to-auto-move the obvious case. Animate the opponent's moves so the player can follow them.
- **Dice:** animated roll + Core Haptics tap on landing. (Use a proper PRNG; for fairness perception, never fudge dice — let difficulty live entirely in move/cube choice, not loaded dice.)
- **Cube:** tappable; show double/take/pass prompts with the Teach-Me equity if enabled.
- **Teach Me overlay:** a non-blocking panel that shows verdict + reasons; a "show me the best move" button that ghosts the recommended checkers; an "undo & try again" affordance. Make it dismissible so confident players aren't nagged.
- **Accessibility:** VoiceOver labels for points/checkers, Dynamic Type in the SwiftUI shell, colorblind-safe checker styles.
- **Game Center:** leaderboards (e.g., average equity-loss = "PR/performance rating"), achievements ("first gammon," "took a correct double").

---

## 7. Persistence, Monetization, App Store

- **Save state:** serialize `Board` + cube + score + match context (Codable) so a game survives backgrounding. Store stats and lesson progress in SwiftData.
- **Performance rating:** log each player move's equity loss; show a running "error rate" like the real bots — it's a great retention/teaching hook.
- **Monetization options:** free with a one-time "unlock Expert + full lessons" IAP; or free tier (Easy/Medium, basic tips) + subscription for Expert analysis and deep rollouts. Avoid ads in a "calm, learn-a-skill" app — they fight the vibe.
- **App Store review notes:** it's a game of skill, no gambling, no real-money stakes (the doubling *cube* is a scoring mechanic, not betting) — keep it that way to avoid the gambling category and its restrictions. Confirm no GPL code shipped (§4.2).

---

## 8. Build Roadmap (ship in slices)

1. **Rules engine + tests.** Board, move generation, apply, win detection, pip count. No UI — drive it from unit tests. *Get this bulletproof before anything else.*
2. **Minimal playable UI.** SpriteKit board, dice, drag legal moves, a dumb random-legal-move opponent. You can play a full game start to bear-off.
3. **pubeval evaluator.** Wire it in → Easy/Medium real opponents + cube basics.
4. **Teach Me v1.** Best-move + verdict + reasons using pubeval; the "how to play" lessons.
5. **Neural net.** Train offline via self-play; bundle weights → Hard/Expert; add 1–2 ply.
6. **Polish.** Haptics, animations, Game Center, performance rating, accessibility, IAP.
7. **Later:** rollout-based deep analysis; Game Center turn-based multiplayer; match play (Crawford, match equity).

---

## 9. Testing the Rules Engine (do not skip)

The move generator is where subtle bugs hide (the larger-die rule, bear-off overshoot, bar-entry-first, doubles). Strategy:

- **Property tests:** for thousands of random reachable positions × all 21 rolls, assert invariants — checker count always 15/side; you never play fewer dice than the max possible; when only one die is playable the larger is enforced; bearing off only when all home.
- **Oracle test (dev-only):** run the same positions through **GNU Backgammon** (offline, on your dev machine — fine under GPL since you're not distributing it) and assert your legal-move *set* matches its. This catches edge cases fast. The gnubg net can also rate your net's play to measure strength.
- **Known-position fixtures:** hand-build tricky cases (forced single-die plays, double from the bar against a near-closed board, bear-off with a checker on the bar) and assert exact outputs.

---

## 10. Pitfalls Checklist

- ❌ Shipping gnubg code/weights in a closed app → GPL obligation. Use pubeval / your own net. ✅
- ❌ Letting difficulty fudge the dice. Players notice; it kills trust. Vary *decisions*, not dice. ✅
- ❌ Running the evaluator on the main thread → UI hitches. Use background concurrency. ✅
- ❌ Teaching with the *weak* evaluator while they play Easy → wrong lessons. Always teach with your strongest available analysis. ✅
- ❌ Over-nagging in Teach Me. Make it dismissible and tier-aware. ✅
- ❌ Forgetting board normalization → double the move-gen code and double the bugs. Normalize for the player on move. ✅

---

### One-line summary
Build a rock-solid, UI-free **rules engine** first; layer a **pubeval (public-domain) → your-own-neural-net** evaluator on top for the four difficulties; and since that evaluator already ranks every move by equity, **Teach Me mode is mostly presentation** — verdict, reasons, and equity gap, phrased for the player's level. Keep GNU Backgammon strictly to your dev machine.
