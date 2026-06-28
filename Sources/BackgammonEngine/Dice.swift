// Dice.swift
// Dice values and rolls. The engine treats dice purely as input — randomness
// lives in the caller (UI/tests), never in move generation.

/// A roll of the two dice.
public struct DiceRoll: Equatable, Hashable, Sendable {
    public let d1: Int
    public let d2: Int

    public init(_ d1: Int, _ d2: Int) {
        precondition((1...6).contains(d1) && (1...6).contains(d2), "dice must be 1...6")
        self.d1 = d1
        self.d2 = d2
    }

    public var isDouble: Bool { d1 == d2 }

    /// The die values to consume this turn. Doubles are played four times.
    public var dice: [Int] { isDouble ? [d1, d1, d1, d1] : [d1, d2] }

    /// All 21 distinct rolls of two dice (order-independent), useful for
    /// 1-ply averaging and property tests.
    public static let allRolls: [DiceRoll] = {
        var rolls: [DiceRoll] = []
        for a in 1...6 {
            for b in a...6 {
                rolls.append(DiceRoll(a, b))
            }
        }
        return rolls
    }()

    /// The probability weight of this roll out of 36 (doubles 1/36, others 2/36).
    public var probabilityOutOf36: Int { isDouble ? 1 : 2 }
}
