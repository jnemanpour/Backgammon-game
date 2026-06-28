// RulesEngine.swift
// Legal-move generation and move application — the correctness-critical core.
//
// All internal generation runs on a *normalized* board (the mover's checkers are
// positive and travel from high points toward 0; the bar enters at 25 - die;
// bearing off goes below point 1). Public entry points normalize on the way in
// and de-normalize the produced plays on the way out, so callers always work in
// real-board coordinates from the moving player's perspective.

public enum RulesEngine {

    // MARK: - Public API

    /// Every legal full play for `board` and `roll` with `player` on move.
    ///
    /// Encodes the official rules:
    /// - You must play as many dice as possible.
    /// - If only one die can be played and either is individually playable, the
    ///   larger must be used.
    /// - Checkers on the bar must re-enter before any other move.
    /// - Doubles are played four times.
    /// - Bearing off requires all 15 checkers home, with the overshoot rule.
    ///
    /// Returns a single forfeit play (`moves == []`, `result == board`) when no
    /// move is possible.
    public static func legalPlays(_ board: Board, _ roll: DiceRoll, player: Player) -> [Play] {
        let norm = board.normalized(for: player)

        // Try both die orderings for non-doubles so order-dependent sequences
        // (e.g. only playable as larger-then-smaller) are not missed.
        let orderings: [[Int]] = roll.isDouble
            ? [[roll.d1, roll.d1, roll.d1, roll.d1]]
            : [[roll.d1, roll.d2], [roll.d2, roll.d1]]

        var results = Set<Play>()
        var maxDiceUsed = 0
        for seq in orderings {
            explore(norm, seq, [], &results, &maxDiceUsed)
        }

        // Rule: must play as many dice as legally possible.
        var best = results.filter { $0.moves.count == maxDiceUsed }

        // Rule: when only one die can be played (non-double) and the larger is
        // individually playable, it must be the one used.
        if maxDiceUsed == 1 && !roll.isDouble {
            let larger = max(roll.d1, roll.d2)
            let withLarger = best.filter { $0.moves.first?.die == larger }
            if !withLarger.isEmpty { best = withLarger }
        }

        let chosen = best.isEmpty
            ? [Play(moves: [], result: norm)]   // forfeit: nothing playable
            : Array(best)

        return chosen.map { denormalize($0, player: player) }
    }

    /// Convenience: apply a play and return the resulting board. The board is
    /// already carried on `Play.result`; this just makes intent explicit.
    public static func apply(_ play: Play) -> Board { play.result }

    // MARK: - Recursive enumeration (normalized board, mover positive)

    private static func explore(_ board: Board,
                                _ remaining: [Int],
                                _ acc: [CheckerMove],
                                _ out: inout Set<Play>,
                                _ maxUsed: inout Int) {
        if acc.count > maxUsed { maxUsed = acc.count }
        if !acc.isEmpty { out.insert(Play(moves: acc, result: board)) }

        guard let die = remaining.first else { return }
        let rest = Array(remaining.dropFirst())

        for mv in singleStepMoves(board, die: die) {
            let next = applyNormalized(mv, to: board)
            explore(next, rest, acc + [mv], &out, &maxUsed)
        }
    }

    /// Every legal single-checker move for one die value on a normalized board.
    /// Internal but exposed for unit testing.
    static func singleStepMoves(_ b: Board, die: Int) -> [CheckerMove] {
        var moves: [CheckerMove] = []

        // 1) Checkers on the bar must enter first; nothing else moves until then.
        if b.bar.white > 0 {
            let entry = 25 - die
            if canLand(b, entry) {
                moves.append(CheckerMove(from: 25, to: entry, die: die))
            }
            return moves
        }

        // 2) Ordinary moves from each occupied point.
        for p in stride(from: 24, through: 1, by: -1) where b.points[p] > 0 {
            let dest = p - die
            if dest >= 1 && canLand(b, dest) {
                moves.append(CheckerMove(from: p, to: dest, die: die))
            }
        }

        // 3) Bearing off, only once all 15 checkers are home (points 1...6).
        if allHome(b) {
            for p in 1...6 where b.points[p] > 0 {
                if p == die {
                    moves.append(CheckerMove(from: p, to: 0, die: die))         // exact
                } else if die > p && noneHigher(b, than: p) {
                    moves.append(CheckerMove(from: p, to: 0, die: die))         // overshoot
                }
            }
        }
        return moves
    }

    /// Apply a single normalized move, handling hits. Internal for testing.
    static func applyNormalized(_ m: CheckerMove, to board: Board) -> Board {
        var b = board
        if m.from == 25 {
            b.bar.white -= 1
        } else {
            b.points[m.from] -= 1
        }

        if m.to == 0 {
            b.off.white += 1
        } else {
            if b.points[m.to] < 0 {        // exactly one enemy checker (a blot) -> hit
                b.points[m.to] = 0
                b.bar.black += 1
            }
            b.points[m.to] += 1
        }
        return b
    }

    // MARK: - Normalized helpers (mover is positive)

    /// Can the mover land on point `p` (1...24)? Open if empty, owned, or holding
    /// a single enemy checker (which would be hit). Blocked by 2+ enemy checkers.
    static func canLand(_ b: Board, _ p: Int) -> Bool {
        b.points[p] >= -1
    }

    /// Are all of the mover's checkers in the home board (points 1...6)?
    static func allHome(_ b: Board) -> Bool {
        if b.bar.white > 0 { return false }
        for p in 7...24 where b.points[p] > 0 { return false }
        return true
    }

    /// Does the mover have no checker on a point higher than `p` (within home)?
    static func noneHigher(_ b: Board, than p: Int) -> Bool {
        guard p < 6 else { return true }
        for q in (p + 1)...6 where b.points[q] > 0 { return false }
        return true
    }

    // MARK: - De-normalization

    /// Map a normalized play back to real-board coordinates for `player`.
    private static func denormalize(_ play: Play, player: Player) -> Play {
        guard player == .black else { return play }
        let moves = play.moves.map {
            CheckerMove(from: flip($0.from), to: flip($0.to), die: $0.die)
        }
        return Play(moves: moves, result: play.result.normalized(for: player))
    }

    /// Flip a point coordinate for Black, leaving the bar (25) and off (0)
    /// sentinels untouched.
    private static func flip(_ x: Int) -> Int {
        (x == 0 || x == 25) ? x : 25 - x
    }
}
