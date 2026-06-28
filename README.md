# Backgammon

A native iOS backgammon app with Easy/Medium/Hard/Expert opponents and a
"Teach Me" mode that explains the best move and *why*. See
[`docs/`](docs/) for the full rules/strategy guide and the build specification.

## Status

This repo currently contains **Module 1 — the core model & rules engine**
(roadmap step 1 of the build spec). It is a UI-free Swift package, built and
tested in isolation as the correctness-critical foundation everything else
(AI, Teach Me) depends on.

```
Sources/BackgammonEngine/
  Player.swift        Player enum + PlayerInts (bar/off counts)
  Dice.swift          DiceRoll, all 21 rolls, doubles handling
  Move.swift          CheckerMove (one die-step) and Play (a full legal play)
  Board.swift         Board model, starting position, orientation/normalization,
                      win detection (single/gammon/backgammon), pip count
  RulesEngine.swift   Legal-move generation + move application (the core)
Tests/BackgammonEngineTests/
  BoardTests.swift        model, mirroring, pip count, win types
  RulesEngineTests.swift  opening rolls, larger-die rule, bear-off overshoot,
                          bar entry, hitting, and random-position invariants
```

## What the engine implements

The official rules from the strategy guide §3–§7:

- Move generation by recursive enumeration of all full plays, then filtering by
  the **max-dice rule** (you must play as many dice as legally possible).
- The **larger-die rule**: when only one die can be played and the larger one is
  individually playable, it must be used.
- **Bar entry first**: checkers on the bar must re-enter before any other move;
  a fully blocked entry forfeits the turn (dancing).
- **Doubles** play four times.
- **Bearing off**: only with all 15 checkers home, including the higher-die
  overshoot rule and the option to move within the board instead.
- **Hitting**: landing on a single enemy checker (a blot) sends it to the bar.
- Win detection: single / gammon / backgammon, and pip counting.

### Board representation & normalization

`Board.points` is a length-25 array (index 0 unused); `+n` = *n* White checkers,
`-n` = *n* Black. White moves high→low and bears off past point 1; Black mirrors.
To write the rules once, the engine **normalizes for the player on move**
(`Board.normalized(for:)`) so all generation logic reads as "move from high
points toward 0." `mirrored()` is its own inverse, so the same call normalizes
and de-normalizes. This is the single biggest simplifier (the gnubg approach).

## Building & testing (Swift)

Requires a Swift 6 toolchain (Xcode 16+ or Swift on Linux/macOS):

```sh
swift test
```

## Reference oracle (dev-only)

`dev/oracle/` contains a Python port of the engine used to validate the
correctness-critical logic in environments without a Swift toolchain. It runs
the same fixtures plus a property test over thousands of random reachable
positions × all 21 rolls (checker-count conservation, max-dice uniformity, and
the larger-die rule). It is **not** part of the shipped app.

```sh
python3 dev/oracle/test_engine.py
```

## Note on the build spec

The spec's sample `Board.starting` literal inadvertently omitted the 8-point and
17-point stacks (only 12 checkers per side). This engine uses the correct
standard setup: White 2/24, 5/13, 3/8, 5/6 (and Black mirrored) — 15 per side,
167 pips each.
