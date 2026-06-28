import XCTest
@testable import BackgammonEngine

final class BoardTests: XCTestCase {

    func testStartingPositionHasFifteenCheckersPerSide() {
        let b = Board.starting
        XCTAssertEqual(b.checkerCount(for: .white), 15)
        XCTAssertEqual(b.checkerCount(for: .black), 15)
    }

    func testStartingPipCountIs167() {
        XCTAssertEqual(Board.starting.pipCount(for: .white), 167)
        XCTAssertEqual(Board.starting.pipCount(for: .black), 167)
    }

    func testMirrorIsInvolution() {
        let b = Board.starting
        XCTAssertEqual(b.mirrored().mirrored(), b)
    }

    func testMirrorSwapsPipViewBetweenPlayers() {
        let b = Board.starting
        XCTAssertEqual(b.mirrored().pipCount(for: .white), b.pipCount(for: .black))
    }

    func testWinTypeSingle() {
        // White off all 15; Black has borne off 3 -> single.
        var pts = [Int](repeating: 0, count: 25)
        pts[6] = -12
        let b = Board(points: pts, bar: PlayerInts(),
                      off: PlayerInts(white: 15, black: 3))
        XCTAssertEqual(b.winType(), .single)
    }

    func testWinTypeGammon() {
        // White off all 15; Black off zero, all Black checkers outside White's
        // home and bar -> gammon.
        var pts = [Int](repeating: 0, count: 25)
        pts[13] = -15
        let b = Board(points: pts, off: PlayerInts(white: 15, black: 0))
        XCTAssertEqual(b.winType(), .gammon)
    }

    func testWinTypeBackgammonInHome() {
        // Black still has a checker in White's home board (point 3) -> backgammon.
        var pts = [Int](repeating: 0, count: 25)
        pts[3] = -15
        let b = Board(points: pts, off: PlayerInts(white: 15, black: 0))
        XCTAssertEqual(b.winType(), .backgammon)
    }

    func testWinTypeBackgammonOnBar() {
        var pts = [Int](repeating: 0, count: 25)
        pts[13] = -14
        let b = Board(points: pts, bar: PlayerInts(white: 0, black: 1),
                      off: PlayerInts(white: 15, black: 0))
        XCTAssertEqual(b.winType(), .backgammon)
    }

    func testNoWinnerOnFreshBoard() {
        XCTAssertNil(Board.starting.winner)
        XCTAssertNil(Board.starting.winType())
    }
}
