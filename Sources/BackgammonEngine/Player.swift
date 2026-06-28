// Player.swift
// The two sides. Numeric raw values double as the sign convention used in
// `Board.points`: White checkers are stored as positive counts, Black as negative.

/// One of the two players.
public enum Player: Int, Sendable, CaseIterable {
    case white = 1
    case black = -1

    /// The other player.
    public var opponent: Player { self == .white ? .black : .white }
}

/// A small fixed pair of per-player integers (used for `bar` and `off`).
///
/// Preferred over `[Player: Int]` so the model has no optionals to force-unwrap
/// and is trivially `Hashable`/`Equatable` for use as a dictionary/set key.
public struct PlayerInts: Equatable, Hashable, Sendable {
    public var white: Int
    public var black: Int

    public init(white: Int = 0, black: Int = 0) {
        self.white = white
        self.black = black
    }

    public subscript(_ player: Player) -> Int {
        get { player == .white ? white : black }
        set {
            if player == .white { white = newValue } else { black = newValue }
        }
    }
}
