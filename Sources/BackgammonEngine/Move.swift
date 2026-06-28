// Move.swift
// The data the rules engine produces: individual die-steps and full plays.

/// A single die-step: move one checker `from` a point `to` a point.
///
/// Coordinates use the same point numbering as `Board` (1...24 from White's
/// view). Two sentinel values are used:
/// - `from == 25` means the checker comes off the bar (re-entering).
/// - `to == 0` means the checker is borne off.
public struct CheckerMove: Equatable, Hashable, Sendable {
    /// Source point (1...24), or 25 for the bar.
    public let from: Int
    /// Destination point (1...24), or 0 for borne off.
    public let to: Int
    /// The die value consumed by this step (1...6).
    public let die: Int

    public init(from: Int, to: Int, die: Int) {
        self.from = from
        self.to = to
        self.die = die
    }
}

/// A complete legal play for one dice roll: the ordered sequence of die-steps
/// (1–4 of them) and the board that results from applying them.
///
/// The `result` board and the `moves` are in real-board coordinates from the
/// moving player's perspective already denormalized — callers can apply
/// `result` directly without further transformation.
public struct Play: Equatable, Hashable, Sendable {
    public let moves: [CheckerMove]
    public let result: Board

    public init(moves: [CheckerMove], result: Board) {
        self.moves = moves
        self.result = result
    }

    /// `true` when the player could make no legal move at all (a forfeited turn,
    /// e.g. dancing on the bar).
    public var isForfeit: Bool { moves.isEmpty }

    /// Number of dice actually consumed.
    public var diceUsed: Int { moves.count }
}
