# Backgammon: Complete Rules & Winning Strategy

A full reference covering every rule of the game plus the strategic framework used by strong modern players (informed by neural-net engines like XG and GNU Backgammon, which have revised a lot of older human theory).

---

# PART 1 — THE RULES

## 1. Equipment & Setup

**Equipment**
- A board with 24 narrow triangles called **points**, in four quadrants of six points each.
- 15 checkers per player (one color each).
- Two dice per player (or one shared pair).
- A **doubling cube** (a die marked 2, 4, 8, 16, 32, 64) for staking.
- Optional dice cup for shaking.

**The four quadrants** (from each player's own perspective):
- **Home board (inner board)** — points 1–6, where you bear off.
- **Outer board** — points 7–12.
- Your opponent's outer board — points 13–18.
- Your opponent's home board — points 19–24.

The **bar** is the ridge down the middle, separating inner from outer boards. Hit checkers go here.

**Standard starting position** (numbering each player's points 1–24 from their own bear-off corner):
- 2 checkers on your 24-point
- 5 checkers on your 13-point
- 3 checkers on your 8-point
- 5 checkers on your 6-point

The two sides mirror each other. Each player moves their checkers from the 24-point toward the 1-point and bears them off the 1-point side.

## 2. Objective

Move all 15 of your checkers into your own home board, then **bear them all off** (remove them from the board). The first player to bear off all 15 checkers wins.

## 3. Direction & the Dice

- Checkers always move from higher-numbered points toward your 1-point — i.e., toward your home board. You never move backward.
- **Starting:** each player rolls one die; the higher number goes first and plays the two dice shown (those two numbers). On a tie, re-roll. (Because of this, an *opening* roll is never doubles.)
- After the opening, each player rolls two dice on their turn.

**Playing the numbers**
- Each die is a separate move. A roll of 5-3 lets you move one checker 5 and another checker 3, **or** move one checker 5 then 3 (8 total) — provided each intermediate landing point is legal.
- **Doubles** are played **four times**: a roll of 4-4 gives you four 4s to play.
- A checker may only land on a point that is **open** — empty, occupied by your own checkers, or holding exactly one enemy checker (which you then hit).
- A point held by **two or more enemy checkers is blocked** — you cannot land there.

**You must use both numbers if legally possible.**
- If you can play only one number, you must play that one.
- If either number could be played but not both, you must play the **larger**.
- If you can play neither, you forfeit the turn.

## 4. Making Points, Blots & Hitting

- A **point** is "made" when you have two or more checkers on it. Made points block the opponent.
- A **blot** is a single checker alone on a point. It is vulnerable.
- **Hitting:** landing on a point with a single enemy checker sends that checker to the **bar**.

## 5. Entering from the Bar

- A checker on the bar must **re-enter** in the opponent's home board before you may make any other move.
- You enter on the point matching a die value (a 3 enters on the opponent's 3-point, counting into their home board). The point must be open.
- If both numbers correspond to blocked points, you **forfeit the entire turn**. With multiple checkers on the bar, all must enter before anything else moves.

## 6. Bearing Off

You may begin bearing off only once **all 15 checkers are in your home board** (points 1–6).

- A die of N bears a checker off your N-point. (A 5 bears off a checker on the 5-point.)
- If you roll a number higher than your highest occupied point, you bear off a checker from the **next-highest** occupied point.
- If a number can be played by moving a checker *within* the home board instead of bearing off, you may choose to do so (often the safer play).
- **Key rule:** if you are hit during bear-off, that checker goes to the bar and must re-enter and travel all the way around again — and you cannot resume bearing off until it's home. This makes leaving a blot during bear-off potentially game-losing.

## 7. Winning Margins

- **Single (1 point):** opponent has borne off at least one checker.
- **Gammon (2 points):** opponent has borne off **zero** checkers when you finish.
- **Backgammon (3 points):** opponent has borne off zero checkers **and** still has a checker on the bar or in your home board.

These multipliers stack with the doubling cube, so a gammon with the cube on 4 is worth 8 points.

## 8. The Doubling Cube

The cube lets either player raise the stakes.

- The game starts at a value of 1 (cube in the middle, no owner).
- Before rolling on your turn, you may **double** — offer to double the stakes.
- The opponent either **takes** (accepts; the cube turns to 2 and they now *own* it — only they can next double) or **drops/passes** (concedes the game immediately at the current stake).
- Whoever owns the cube can later **redouble** (2→4→8…). There's no theoretical ceiling, but games rarely go past 4.
- **Beavers** (optional, money play): a player who is doubled and believes they're actually the favorite may immediately *beaver* — double again to the next level while retaining ownership.
- **Automatic doubles / the Jacoby rule** are optional money-play conventions (see §10).

## 9. Match Play & the Crawford Rule

Tournament backgammon is played as a **match** to a target score (e.g., first to 7 points). Cube values and gammons all count toward the match score.

- **Crawford rule:** when either player first reaches **match point** (one point from winning), the *next single game* is played with **no doubling cube**. After that one Crawford game, the cube is live again ("post-Crawford").
- **Free drop:** post-Crawford, the leader can sometimes decline a double "for free" when it wouldn't change their match position — a subtle but real edge.

## 10. Common Optional Rules (Money Play)

- **Jacoby rule:** gammons and backgammons count as a single game *unless the cube has been turned* at least once. This discourages playing on for a gammon when the cube is still in the middle. (Used in money play; **not** used in match play.)
- **Automatic double:** if both players roll the same number on the opening die, the cube is bumped to 2 (often capped at one or two autodoubles).
- **Beavers / raccoons:** escalating re-double options as above.

---

# PART 2 — WINNING STRATEGY

## 11. The Single Most Important Idea: Key Points

Not all points are equal. The most valuable points to make are the ones that block your opponent and anchor your structure.

- **The 5-point (the "golden point")** — your single most valuable point. It blocks, builds priming structure, and is hard for the opponent to escape past.
- **The bar-point (7-point)** — completes a strong wall in front of the opponent's back checkers.
- **The 4-point** — the next-best home-board point after the 5.
- **The opponent's 5-point (your 20-point) — the "golden anchor."** The best defensive anchor in the game. Owning it means you're rarely gammoned and always have a shot at hitting.

A wall of consecutive made points is a **prime**. Six consecutive made points (a **full prime**, points 2–7 typically) is an absolute wall — no checker, no matter the roll, can jump it.

## 12. Opening Rolls (modern engine-approved plays)

Computer rollouts have settled most opening-roll debates and overturned some old human habits (e.g., slotting the 5-point on 4-1/5-1 is no longer best; making the deep 2-point on 6-4 is roughly as good as running). Best plays:

| Roll | Best play | Idea |
|------|-----------|------|
| **3-1** | 8/5, 6/5 | Makes the golden 5-point. The best opening roll. |
| **4-2** | 8/4, 6/4 | Makes the 4-point. Second-best roll. |
| **6-1** | 13/7, 8/7 | Makes the bar-point. |
| **5-3** | 8/3, 6/3 | Makes the 3-point. |
| **4-3** | 24/20, 13/10 (or 24/21, 13/9) | Split + builder; engines roughly tie these. |
| **2-1** | 13/11, 6/5 (slot) or 24/23, 13/11 (split) | Slot is a hair better; split is lower-variance. |
| **5-1** | 24/23, 13/8 | Split + bring builder down. |
| **6-2** | 24/18, 13/11 | Split to bar + builder. |
| **6-3** | 24/18, 13/10 (or 24/15 run) | Split or run. |
| **6-4** | 24/14 (run), or 8/2 6/2, or 24/18 13/9 | All three nearly equal; run is marginally top. |
| **6-5** | 24/13 | "Lover's Leap" — run a back checker clean to safety. The only play. |
| **5-4** | 24/20, 13/8 | Develop both sides; engines' slight favorite. |
| **5-2** | 24/22, 13/8 | Split + builder (beats the old 13/8, 13/11). |
| **4-1** | 24/23, 13/9 | Split + builder (slotting the 5 is no longer preferred). |
| **3-2** | 24/21, 13/11 or 13/11, 13/10 | Split or two down. |

**Why these themes recur:** point-making rolls (3-1, 4-2, 6-1, 5-3) take the point immediately. The rest balance three jobs — **splitting** the back checkers to fight for an advanced anchor, bringing **builders** down to make points next turn, and **running** when the pips justify it.

## 13. The Five Game Plans

Strong play means recognizing which type of game you're in and playing accordingly. The plan often changes mid-game based on the dice.

**1. The Race (running game).** When you're ahead on the pip count and contact is minimal, just run home and bear off fastest. No need to fight — avoid getting hit and convert your lead. Decided largely by the **pip count** (§15).

**2. The Blitz (attacking game).** Aggressively hit the opponent and slam home-board points to close them out. Goal: leave their checker(s) on the bar while you build a closed board (all six home points made), then they dance while you romp — often for a gammon. Works best when they have loose back checkers and no anchor.

**3. The Priming Game.** Build a wall (prime) of consecutive points in front of the opponent's back checkers to trap them, then roll the prime home while they're stuck. The 6-prime is a cage; even a 4- or 5-prime is very strong. Patience and timing matter.

**4. The Holding Game.** You're behind in the race but hold a strong **anchor** (ideally the opponent's 5-point — the golden anchor — or bar-point/4-point). You wait on the anchor for a **shot** (a chance to hit) as the opponent breaks down to bear in. One good hit can flip the game.

**5. The Backgame.** You hold **two or more anchors** deep in the opponent's home board (e.g., their 1 and 3 points). You deliberately fall way behind, hoping to hit late as they bear in, then contain the hit checker behind your board. High-variance and hard to play well — **timing** (not crunching your own structure too early) is everything. Two anchors on adjacent or near-adjacent points (like the 2 and 4, or 1 and 3) are the best backgame structures; the 1-2 backgame is the weakest.

## 14. Core Checker-Play Principles

- **Make the 5-point and 20-point (golden points) whenever you reasonably can.**
- **Don't leave unnecessary blots.** When you must leave one, leave it where it's *least* likely to be hit, or where being hit costs least. Count your opponent's hitting numbers (out of 36).
- **Direct vs. indirect shots:** a blot within 6 pips can be hit by a single die (a "direct shot," more dangerous); 7–12 away needs a combination ("indirect shot," fewer numbers hit it).
- **Slotting:** intentionally placing a blot on a key point (often the 5) to make it next turn. High-reward, high-risk — better when your opponent's return hit costs them, and worse when they badly want that same point.
- **Unstack heavy points.** Piles on your 6-point and 13-point are inflexible. Distribute checkers into **builders** that can make new points.
- **Builders:** spare checkers positioned to make points next roll. More builders aimed at a point = more rolls that make it.
- **Don't bury checkers.** Stacking deep on your 1- and 2-points wastes pips and flexibility.
- **Hit when it gains** — hitting sends the opponent back ~ (distance) pips *and* costs them tempo (they must re-enter). Double hits are especially strong. But don't hit just because you can if it shatters your own position.
- **Race vs. fight:** if ahead in the race, simplify and avoid contact; if behind, keep contact and play for a hit.
- **Anchor early when behind; advance/escape your back checkers when ahead.**

## 15. Pip Counting (the decision backbone)

Your **pip count** is the total number of pips needed to bring all checkers home and bear them off. (Add: for each checker, its point number × number of checkers there.) The starting pip count is **167** for each side.

- Recount at key moments; the difference between the two counts tells you whether you're racing or fighting.
- **Rough doubling guideline based on the race (for pure races):** the leader's **own** count, the lead, and the number of *crossovers/positioning* all factor in — but a common shortcut is the **8/9/12 rule**: with your pip count, you can generally *double* with a lead of ~9–12% of your count, *take* down to a lead against you of about the same, and so on. Don't over-rely on shortcuts; learn real reference positions.
- **Crossovers:** counting how many quadrant-to-quadrant moves each side needs is a fast way to judge bear-in and bear-off races.

## 16. The Doubling Cube — Where Most Games Are Won or Lost

Cube skill separates strong players from weak ones more than checker play does. The math:

**The 25% take point.** If you'll win **25% or more**, you should *take* a double. Why: over four games at the doubled stake, winning one (25%) breaks even against passing all four. Below 25%, pass.

**Cube ownership lowers your take point.** Because taking gives you the *exclusive right to redouble* later (called **recube vigorish**), you can correctly take at slightly *under* 25% — often down to about **20–22%** in volatile, "swingy" positions where you might turn it around and redouble.

**When to double.** Roughly, double when you're around **65–70%+** to win and the position is volatile enough that waiting risks losing your market (i.e., your opponent becoming too strong to take, or you jumping to a position where they'd correctly pass). The classic **doubling window** runs from about 65% up to the point where you're "too good."

**"Too good to double."** When you have a strong **gammon** threat, cashing one point by doubling the opponent out can be *worse* than playing on for an undoubled (or already-doubled) gammon worth two. If you're a big favorite to win a gammon and rarely lose, play on.

**Gammon threats cut both ways.** The threat of being gammoned can make it right to double with *less* than 65%, or to **pass** a double even with *more* than 25% winning chances (because some of your "wins" are actually gammon losses).

**Redoubles cost more.** When you redouble from 2 to 4, you're risking the 2 you'd lose plus the new stakes — be more cautious initiating, since a taking opponent immediately owns a powerful 4-cube.

## 17. Match-Play Adjustments

The score changes correct strategy, sometimes dramatically.

- **Normalize the score** as "X-away, Y-away" (points each side needs). Strategy depends on these, not raw points.
- **Match equity tables** convert any score to a win probability; strong players memorize key reference equities.
- **2-away / 2-away:** whoever wins the game is on the brink — gammons are capped in value, and the cube dynamics shift (the leader's first double is often an auto-take situation).
- **Trailing badly:** you *want* gammons and high cubes (variance is your friend) — double aggressively and play on for gammons.
- **Leading:** reduce variance — be quicker to take the safe point, more cautious about giving a live cube, and avoid unnecessary gammon risk.
- **Crawford game:** no cube — play pure checker-play for the win (and for a gammon if you're the leader closing out the match).
- **Post-Crawford:** the trailer should double at their first legal chance (almost always); the leader uses the **free drop** when available.

## 18. Bearing Off Cleanly

- If there's **no contact** (opponent has no checkers behind you), bear off as fast as possible — don't waste pips moving inside the board when you could be taking checkers off.
- If there **is contact** (opponent holds an anchor in your home board), bear off to avoid leaving a **blot** that gives them a shot. Fill gaps, keep an even number of checkers on high points, and avoid being forced to expose a checker.
- Learn to spot when you'll be **forced** to leave a shot on a future roll and plan to minimize the number of shots.

## 19. The Most Common Mistakes (and the fixes)

1. **Over-stacking the 6- and 13-points** instead of distributing builders. → Bring checkers down to make new points.
2. **Playing too safe, never slotting or hitting** when the position demands aggression. → In a blitz or when you need a key point, take the risk.
3. **Playing too loose when ahead in the race.** → When you're winning the race, *break contact* and run.
4. **Ignoring the pip count.** → Count at every cube decision and whenever the game's character might be shifting.
5. **Cube blunders:** doubling too early (giving away a live cube), passing takeable doubles (under-valuing recube vigorish), and failing to double when you should (losing your market). → Learn the 25%/70% framework and reference positions.
6. **Cashing when "too good."** → Recognize big gammon threats and play on.
7. **Mistiming a backgame** — crunching your home board before the hit comes. → Hold your structure; keep checkers flexible.
8. **Abandoning the golden anchor** (opponent's 5-point) too soon when behind. → It's your lifeline; sit on it until you get a shot or the race turns.

## 20. How to Actually Get Better

- **Use a bot.** GNU Backgammon (free) and eXtreme Gammon (XG) analyze your games and rate every move and cube decision in **error rate** (millipoints lost). This is the single fastest way to improve.
- **Roll out positions** you're unsure about and study the equities.
- **Study reference positions** for races, bear-offs, and cube decisions — pattern recognition beats calculation at the table.
- **Learn match equities** if you play tournaments.
- **Play many games** with the cube — cube instinct only comes from reps plus bot feedback.

---

## Quick-Reference Cheat Sheet

- **Starting pip count:** 167 each.
- **Best point to make:** your 5 (golden point). **Best anchor:** opponent's 5 (golden anchor).
- **Take a double at ≥ 25%** win chance (a bit lower if you own recube potential).
- **Double around 65–70%+**, unless **too good** (big gammon threat → play on).
- **Prime:** consecutive made points; **6-prime** = no escape.
- **Ahead in the race → run and break contact. Behind → anchor and play for a shot.**
- **Doubles play four times. Must use both numbers if legal; if only one, use the larger.**
- **Hit during bear-off = disaster** — that checker travels all the way around again.
- **Gammon = 2×, Backgammon = 3×**, multiplied by the cube.
