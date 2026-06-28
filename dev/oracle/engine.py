"""Reference port of Sources/BackgammonEngine, used as a dev-only oracle.

This is a line-for-line translation of the Swift rules engine into Python so the
correctness-critical move-generation logic can be exercised with property tests
and fixtures in an environment without a Swift toolchain. It is NOT shipped in
the app. If you change the Swift engine, mirror the change here and re-run
`python3 dev/oracle/test_engine.py`.

Conventions match the Swift code exactly:
- points: list of length 25, index 0 unused; +n = n White, -n = n Black.
- bar/off: dict {1: white_count, -1: black_count} keyed by player sign.
- Internal generation runs on a normalized board (mover positive, high -> low).
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional

WHITE = 1
BLACK = -1


def opponent(player: int) -> int:
    return -player


@dataclass(frozen=True)
class Board:
    points: tuple            # length 25
    bar_white: int = 0
    bar_black: int = 0
    off_white: int = 0
    off_black: int = 0

    @staticmethod
    def starting() -> "Board":
        pts = [0,
               -2, 0, 0, 0, 0, 5,
               0, 3, 0, 0, 0, -5,
               5, 0, 0, 0, -3, 0,
               -5, 0, 0, 0, 0, 2]
        return Board(tuple(pts))

    def bar(self, player: int) -> int:
        return self.bar_white if player == WHITE else self.bar_black

    def off(self, player: int) -> int:
        return self.off_white if player == WHITE else self.off_black

    def owns(self, p: int, player: int) -> bool:
        return self.points[p] > 0 if player == WHITE else self.points[p] < 0

    def count(self, p: int, player: int) -> int:
        v = self.points[p]
        if player == WHITE:
            return v if v > 0 else 0
        return -v if v < 0 else 0

    def checker_count(self, player: int) -> int:
        c = self.bar(player) + self.off(player)
        for p in range(1, 25):
            c += self.count(p, player)
        return c

    def mirrored(self) -> "Board":
        np = [0] * 25
        for p in range(1, 25):
            np[p] = -self.points[25 - p]
        return Board(tuple(np), self.bar_black, self.bar_white,
                     self.off_black, self.off_white)

    def normalized(self, player: int) -> "Board":
        return self if player == WHITE else self.mirrored()

    @property
    def winner(self) -> Optional[int]:
        if self.off_white == 15:
            return WHITE
        if self.off_black == 15:
            return BLACK
        return None

    def win_type(self) -> Optional[str]:
        w = self.winner
        if w is None:
            return None
        loser = opponent(w)
        if self.off(loser) > 0:
            return "single"
        if self.bar(loser) > 0:
            return "backgammon"
        home = range(1, 7) if w == WHITE else range(19, 25)
        for p in home:
            if self.owns(p, loser):
                return "backgammon"
        return "gammon"

    def pip_count(self, player: int) -> int:
        pips = self.bar(player) * 25
        for p in range(1, 25):
            if self.owns(p, player):
                dist = p if player == WHITE else (25 - p)
                pips += self.count(p, player) * dist
        return pips


@dataclass(frozen=True)
class CheckerMove:
    frm: int
    to: int
    die: int


@dataclass(frozen=True)
class Play:
    moves: tuple            # tuple of CheckerMove
    result: Board


# --- normalized helpers (mover positive) ---

def can_land(b: Board, p: int) -> bool:
    return b.points[p] >= -1


def all_home(b: Board) -> bool:
    if b.bar_white > 0:
        return False
    for p in range(7, 25):
        if b.points[p] > 0:
            return False
    return True


def none_higher(b: Board, p: int) -> bool:
    if p >= 6:
        return True
    for q in range(p + 1, 7):
        if b.points[q] > 0:
            return False
    return True


def single_step_moves(b: Board, die: int) -> List[CheckerMove]:
    moves: List[CheckerMove] = []
    if b.bar_white > 0:
        entry = 25 - die
        if can_land(b, entry):
            moves.append(CheckerMove(25, entry, die))
        return moves
    for p in range(24, 0, -1):
        if b.points[p] > 0:
            dest = p - die
            if dest >= 1 and can_land(b, dest):
                moves.append(CheckerMove(p, dest, die))
    if all_home(b):
        for p in range(1, 7):
            if b.points[p] > 0:
                if p == die:
                    moves.append(CheckerMove(p, 0, die))
                elif die > p and none_higher(b, p):
                    moves.append(CheckerMove(p, 0, die))
    return moves


def apply_normalized(m: CheckerMove, board: Board) -> Board:
    pts = list(board.points)
    bw, bb = board.bar_white, board.bar_black
    ow = board.off_white
    if m.frm == 25:
        bw -= 1
    else:
        pts[m.frm] -= 1
    if m.to == 0:
        ow += 1
    else:
        if pts[m.to] < 0:
            pts[m.to] = 0
            bb += 1
        pts[m.to] += 1
    return Board(tuple(pts), bw, bb, ow, board.off_black)


def _explore(board: Board, remaining, acc, out: dict, max_used: list):
    if len(acc) > max_used[0]:
        max_used[0] = len(acc)
    if acc:
        out[(tuple(acc), board)] = Play(tuple(acc), board)
    if not remaining:
        return
    die = remaining[0]
    rest = remaining[1:]
    for mv in single_step_moves(board, die):
        nxt = apply_normalized(mv, board)
        _explore(nxt, rest, acc + [mv], out, max_used)


def _flip(x: int) -> int:
    return x if (x == 0 or x == 25) else 25 - x


def _denormalize(play: Play, player: int) -> Play:
    if player == WHITE:
        return play
    moves = tuple(CheckerMove(_flip(m.frm), _flip(m.to), m.die) for m in play.moves)
    return Play(moves, play.result.normalized(player))


def legal_plays(board: Board, d1: int, d2: int, player: int) -> List[Play]:
    norm = board.normalized(player)
    is_double = d1 == d2
    orderings = [[d1, d1, d1, d1]] if is_double else [[d1, d2], [d2, d1]]
    out: dict = {}
    max_used = [0]
    for seq in orderings:
        _explore(norm, seq, [], out, max_used)
    best = [p for p in out.values() if len(p.moves) == max_used[0]]
    if max_used[0] == 1 and not is_double:
        larger = max(d1, d2)
        with_larger = [p for p in best if p.moves[0].die == larger]
        if with_larger:
            best = with_larger
    if not best:
        chosen = [Play(tuple(), norm)]
    else:
        chosen = best
    return [_denormalize(p, player) for p in chosen]
