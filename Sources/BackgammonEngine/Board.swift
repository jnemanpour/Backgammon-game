// Board.swift
// The core board model plus orientation, win-detection and pip-count helpers.
//
// Representation
// --------------
// `points` has length 25 (index 0 unused). Points 1...24 are numbered from
// White's bear-off corner. A positive value is a count of White checkers on
// that point; a negative value is a count of Black checkers. `bar` and `off`
// track checkers on the bar and borne off for each side.
//
// Direction convention
// --------------------
// White moves from high-numbered points toward 1 and bears off past the 1-point.
// Black moves the opposite way (1 -> 24) and bears off past the 24-point. To
// keep move generation written once, the engine *normalizes* the board for the
// player on move (see `normalized(for:)`), so all rule logic can be written as
// "move from high points toward 0, bear off below 1."

/// A backgammon position.
public struct Board: Equatable, Hashable, Sendable {
    /// Length 25; index 0 unused. +n = n White checkers, -n = n Black checkers.
    public var points: [Int]
    /// Checkers on the bar for each side.
    public var bar: PlayerInts
    /// Checkers borne off for each side.
    public var off: PlayerInts

    public init(points: [Int], bar: PlayerInts = PlayerInts(), off: PlayerInts = PlayerInts()) {
        precondition(points.count == 25, "points must have length 25 (index 0 unused)")
        self.points = points
        self.bar = bar
        self.off = off
    }

    /// The standard opening position (15 checkers per side).
    ///
    /// White: 2 on the 24-pt, 5 on the 13-pt, 3 on the 8-pt, 5 on the 6-pt.
    /// Black mirrors. (Note: this differs from the build-spec's sample literal,
    /// which inadvertently omitted the 8-pt / 17-pt stacks and had only 12
    /// checkers per side.)
    public static let starting = Board(
        points: [0,
            -2,  0,  0,  0,  0,  5,   //  1..6
             0,  3,  0,  0,  0, -5,   //  7..12
             5,  0,  0,  0, -3,  0,   // 13..18
            -5,  0,  0,  0,  0,  2],  // 19..24
        bar: PlayerInts(white: 0, black: 0),
        off: PlayerInts(white: 0, black: 0))

    // MARK: - Queries

    /// Whether `player` owns (has at least one checker on) point `p` (1...24).
    public func owns(_ p: Int, _ player: Player) -> Bool {
        player == .white ? points[p] > 0 : points[p] < 0
    }

    /// Number of `player` checkers on point `p` (1...24), always non-negative.
    public func count(_ p: Int, _ player: Player) -> Int {
        let v = points[p]
        if player == .white { return v > 0 ? v : 0 }
        return v < 0 ? -v : 0
    }

    /// Total checkers belonging to `player` everywhere (should always be 15).
    public func checkerCount(for player: Player) -> Int {
        var c = bar[player] + off[player]
        for p in 1...24 { c += count(p, player) }
        return c
    }

    // MARK: - Orientation

    /// A copy mirrored end-for-end with the colors swapped.
    ///
    /// Point `p` becomes point `25 - p` and signs flip, so the moving side's
    /// checkers always read as positive and move from high points toward 0.
    /// This operation is its own inverse, so the same call both normalizes and
    /// de-normalizes.
    public func mirrored() -> Board {
        var np = [Int](repeating: 0, count: 25)
        for p in 1...24 { np[p] = -points[25 - p] }
        return Board(points: np,
                     bar: PlayerInts(white: bar.black, black: bar.white),
                     off: PlayerInts(white: off.black, black: off.white))
    }

    /// The board as seen by `player` on move: White is returned unchanged; Black
    /// is mirrored so the mover's checkers are positive and travel high -> low.
    /// Because `mirrored()` is an involution, calling this again de-normalizes.
    public func normalized(for player: Player) -> Board {
        player == .white ? self : mirrored()
    }

    // MARK: - Win detection

    public enum WinType: Equatable, Sendable {
        case single      // loser has borne off at least one checker
        case gammon      // loser has borne off zero checkers
        case backgammon  // gammon, and loser still has a checker on the bar or in winner's home
    }

    /// The player who has borne off all 15 checkers, if any.
    public var winner: Player? {
        if off.white == 15 { return .white }
        if off.black == 15 { return .black }
        return nil
    }

    /// The win magnitude for the winner, or `nil` if the game is unfinished.
    public func winType() -> WinType? {
        guard let w = winner else { return nil }
        let loser = w.opponent
        if off[loser] > 0 { return .single }
        // Loser has borne off nothing: at least a gammon. It is a backgammon if
        // the loser still has a checker on the bar or in the winner's home board.
        if bar[loser] > 0 { return .backgammon }
        let winnerHome = (w == .white) ? (1...6) : (19...24)
        for p in winnerHome where owns(p, loser) { return .backgammon }
        return .gammon
    }

    // MARK: - Pip count

    /// The pip count for `player`: total pips needed to bring every checker home
    /// and bear it off. Starting position is 167 for each side.
    public func pipCount(for player: Player) -> Int {
        var pips = bar[player] * 25
        for p in 1...24 where owns(p, player) {
            let dist = (player == .white) ? p : (25 - p)
            pips += count(p, player) * dist
        }
        return pips
    }
}
