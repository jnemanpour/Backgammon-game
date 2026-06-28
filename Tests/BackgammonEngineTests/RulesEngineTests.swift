import XCTest
@testable import BackgammonEngine

final class RulesEngineTests: XCTestCase {

    /// Build a board from a sparse {point: signed-count} map.
    private func board(_ map: [Int: Int],
                       bar: PlayerInts = PlayerInts(),
                       off: PlayerInts = PlayerInts()) -> Board {
        var pts = [Int](repeating: 0, count: 25)
        for (p, v) in map { pts[p] = v }
        return Board(points: pts, bar: bar, off: off)
    }

    // MARK: Opening rolls

    func testOpening31CanMakeWhiteGoldenPoint() {
        let plays = RulesEngine.legalPlays(.starting, DiceRoll(3, 1), player: .white)
        let made5 = plays.filter {
            $0.result.points[5] == 2 && $0.result.points[8] == 2 && $0.result.points[6] == 4
        }
        XCTAssertFalse(made5.isEmpty, "3-1 should be able to make the 5-point (8/5, 6/5)")
        XCTAssertTrue(plays.allSatisfy { $0.moves.count == 2 },
                      "both dice are playable from the opening, so every play uses both")
    }

    func testOpening31ForBlackMakesBlackGoldenPoint() {
        // Black's 5-point is real point 20.
        let plays = RulesEngine.legalPlays(.starting, DiceRoll(3, 1), player: .black)
        let made20 = plays.filter { $0.result.points[20] == -2 }
        XCTAssertFalse(made20.isEmpty, "Black 3-1 should be able to make point 20")
    }

    // MARK: Use-both / larger-die rules

    func testLargerDieMustBePlayedWhenOnlyOneIsPossible() {
        // White blot on 6; Black holds point 4. Roll 5-2.
        // die 2: 6->4 is blocked. die 5: 6->1 is open. After playing the 5 there
        // is no second checker to move, so max-dice == 1 and the larger (5) wins.
        let pos = board([6: 1, 4: -2])
        let plays = RulesEngine.legalPlays(pos, DiceRoll(5, 2), player: .white)
        XCTAssertEqual(plays.count, 1)
        XCTAssertEqual(plays[0].moves.first?.die, 5)
        XCTAssertEqual(plays[0].moves.first?.to, 1)
    }

    func testBothDiceUsedFromOpeningWhenPossible() {
        let plays = RulesEngine.legalPlays(.starting, DiceRoll(6, 5), player: .white)
        XCTAssertTrue(plays.allSatisfy { $0.moves.count == 2 })
    }

    // MARK: Bearing off

    func testBearOffOvershootFromHighestPoint() {
        // All White home: 4-pt, 2-pt, 1-pt occupied (9 already off). Roll 6-6.
        // Nothing on 5 or 6, so a 6 must bear off the 4-point (overshoot).
        let pos = board([4: 2, 2: 2, 1: 2], off: PlayerInts(white: 9, black: 0))
        XCTAssertEqual(pos.checkerCount(for: .white), 15)
        let plays = RulesEngine.legalPlays(pos, DiceRoll(6, 6), player: .white)
        let firstSources = Set(plays.compactMap { $0.moves.first?.from })
        XCTAssertEqual(firstSources, [4], "first 6 overshoot-bears the 4-point")
        XCTAssertTrue(plays.allSatisfy { $0.moves.first?.to == 0 })
    }

    func testExactBearOffOrMoveWithinBoard() {
        // White home on 6 and 3. A die of 3 may bear off the 3, OR move 6->3.
        let pos = board([6: 1, 3: 1], off: PlayerInts(white: 13, black: 0))
        let plays = RulesEngine.legalPlays(pos, DiceRoll(3, 1), player: .white)
        var die3Targets = Set<[Int]>()
        for p in plays {
            for m in p.moves where m.die == 3 { die3Targets.insert([m.from, m.to]) }
        }
        XCTAssertTrue(die3Targets.contains([3, 0]), "die 3 can bear off the 3-point")
        XCTAssertTrue(die3Targets.contains([6, 3]), "die 3 can move 6->3 within the board")
    }

    func testCannotBearOffUntilAllHome() {
        // One White checker still on the 13-point; the rest home. No bear-off yet.
        let pos = board([13: 1, 6: 5, 5: 5, 4: 4], off: PlayerInts(white: 0, black: 0))
        XCTAssertEqual(pos.checkerCount(for: .white), 15)
        let plays = RulesEngine.legalPlays(pos, DiceRoll(2, 1), player: .white)
        let bearsOff = plays.contains { $0.moves.contains { $0.to == 0 } }
        XCTAssertFalse(bearsOff, "no bearing off while a checker is outside the home board")
    }

    // MARK: Bar entry

    func testBlockedBarEntryForfeitsTurn() {
        // White on the bar; both entry points (19 for die 6, 20 for die 5) blocked.
        let pos = board([19: -2, 20: -2, 6: 5], bar: PlayerInts(white: 1, black: 0))
        let plays = RulesEngine.legalPlays(pos, DiceRoll(6, 5), player: .white)
        XCTAssertEqual(plays.count, 1)
        XCTAssertTrue(plays[0].isForfeit)
    }

    func testMustEnterFromBarBeforeAnythingElse() {
        // Entry for die 6 (point 19) blocked; die 5 (point 20) open.
        let pos = board([19: -2, 6: 5], bar: PlayerInts(white: 1, black: 0))
        let plays = RulesEngine.legalPlays(pos, DiceRoll(6, 5), player: .white)
        XCTAssertTrue(plays.allSatisfy { $0.moves.first?.from == 25 })
        XCTAssertTrue(plays.allSatisfy { $0.moves.first?.to == 20 })
    }

    // MARK: Hitting

    func testHittingSendsBlotToBarAndMakesPoint() {
        // White on 8 and 6, Black blot on 5. Roll 3-1: 8->5 hits, 6->5 makes it.
        let pos = board([8: 1, 6: 1, 5: -1])
        let plays = RulesEngine.legalPlays(pos, DiceRoll(3, 1), player: .white)
        let hit = plays.first { $0.result.points[5] == 2 && $0.result.bar.black == 1 }
        XCTAssertNotNil(hit, "white can hit on 5 and make the point")
        XCTAssertEqual(hit?.result.bar.black, 1)
        XCTAssertEqual(hit?.result.points[5], 2)
    }

    // MARK: Invariants over random positions

    func testCheckerCountConservedOverRandomPlay() {
        var rng = SystemRandomNumberGenerator()
        var board = Board.starting
        var player = Player.white
        for _ in 0..<200 {
            if board.winner != nil { break }
            let roll = DiceRoll(Int.random(in: 1...6, using: &rng),
                                Int.random(in: 1...6, using: &rng))
            let plays = RulesEngine.legalPlays(board, roll, player: player)
            // Every legal play conserves 15 checkers per side and is uniform in
            // dice used (the max-dice rule).
            XCTAssertTrue(plays.allSatisfy { $0.result.checkerCount(for: .white) == 15 })
            XCTAssertTrue(plays.allSatisfy { $0.result.checkerCount(for: .black) == 15 })
            XCTAssertEqual(Set(plays.map { $0.moves.count }).count, 1)
            board = plays.randomElement(using: &rng)!.result
            player = player.opponent
        }
    }

    func testLargerDieRuleAcrossAllRollsOnRandomPositions() {
        var rng = SystemRandomNumberGenerator()
        for _ in 0..<50 {
            // Walk to a random reachable position.
            var board = Board.starting
            var player = Player.white
            for _ in 0..<Int.random(in: 0...30, using: &rng) {
                if board.winner != nil { break }
                let roll = DiceRoll(Int.random(in: 1...6, using: &rng),
                                    Int.random(in: 1...6, using: &rng))
                let plays = RulesEngine.legalPlays(board, roll, player: player)
                board = plays.randomElement(using: &rng)!.result
                player = player.opponent
            }
            guard board.winner == nil else { continue }
            for who in [Player.white, Player.black] {
                for roll in DiceRoll.allRolls where !roll.isDouble {
                    let plays = RulesEngine.legalPlays(board, roll, player: who)
                    guard plays.first?.moves.count == 1 else { continue }
                    let norm = board.normalized(for: who)
                    let smallOK = !RulesEngine.singleStepMoves(norm, die: min(roll.d1, roll.d2)).isEmpty
                    let largeOK = !RulesEngine.singleStepMoves(norm, die: max(roll.d1, roll.d2)).isEmpty
                    if smallOK && largeOK {
                        XCTAssertTrue(plays.allSatisfy { $0.moves.first?.die == max(roll.d1, roll.d2) },
                                      "larger die must be used for \(roll) as \(who)")
                    }
                }
            }
        }
    }
}
