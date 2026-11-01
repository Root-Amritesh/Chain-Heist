# BIT-HUNTER 2099 — Master Project Knowledge Base & Architecture

## 1. Executive Summary & Core Concept
- **Title**: BIT-HUNTER 2099
- **Event**: College Club Wars (1-day deadline target, playable at booth, offline-ready).
- **Core Loop**:
  - Run duration: 5–7 minutes max (Global countdown timer starting at 7:00).
  - Total lives: 3 lives across the entire run.
  - Spawns in an overworld hub (cyberpunk / Neo-City) with Pokémon-style grid movement, facing, and interaction.
  - Explore the hub, collect ~15 visible hovering coins (+10 pts each), search ~10 hidden tokens in bushes/crates (+50 pts each).
  - Locate and clear 3 distinct arcade mini-games in ANY order guarded by Hacker Apes:
    1. **Block Flyer** (Flappy-Bird style): dodge server pillars/drones, collect coins, clear at 20 pillars passed.
    2. **Vault Run** (Pac-Man style): double neon line maze, eat all "B" pellets, dodge 4 hacker apes, power coins turn apes blue/eatable, 2:00 hard limit.
    3. **Chain Snake** (Snake style): cat head pulling a glowing chain of transaction blocks, eat tx packets, avoid malware tile, clear at 15 blocks, 1:30 hard limit.
  - Clear condition: Clear all 3 mini-games before losing 3 lives or running out of time.
  - Victory: Hall-of-Fame / Results screen, award badge (Bronze / Silver / Gold Node), run code (e.g. `#A7F3-91C2`), time & life bonus points, local leaderboard ("THE LEDGER").

---

## 2. Technical Stack & Base Architecture
- **Framework**: Phaser 3 (JavaScript / TypeScript web game, 480x320 or 640x360 internal pixelArt canvas integer-scaled to viewport, `#07040F` background).
- **Base Repository**: `Monster Tamer` (MIT licensed by Dev Share Academy).
  - Leverages existing battle scene wrappers, dialog systems, menus, grid walking, sound systems, and camera controls.
- **Asset Pack**: `bithunter-assets.zip` (81 sliced PNGs: cats, hacker apes, NPCs, coins, props, flyer elements, neo-city map `main_1_level_background.png`).
- **Map System**:
  - Tiled map (`main_1.json` at 64px tile size, or 16px tile equivalent).
  - Background image layer (`neo-city.png` / `main_1_level_background.png`).
  - Invisible collision layer over buildings, water, fences.
  - Object layers for player spawn, NPC placements, 3 mini-game portals, hidden tokens, and floating street coins.

---

## 3. The 3 Mini-Games Specification
### A. Block Flyer (Ref: Flappy Mockup)
- **Visuals**: Parallax neon skyline, server-rack pillars, drone obstacles, floating coins, cat player with cyan/magenta neon trail.
- **Controls**: SPACE / W to flap.
- **Scoring & Clear**: +10 per pillar passed, +25 per coin. Clears at **20 pillars** (displaying `0/20`). Speed ramp at 5, 10, 15.
- **Win/Lose**: Clear -> "DISTRICT SECURED" banner (+500 pts, portal checked off). Hit obstacle/ground -> -1 life, retry.

### B. Vault Run (Ref: BIT-HUNTER Mockup)
- **Visuals**: Double neon lines (cyan/magenta glow), central VAULT box, gold "B" pellets, 4 glowing corner BTC power coins, 4 hacker apes.
- **Controls**: WASD / Arrow keys.
- **Mechanics**: Eat all pellets to clear. Big coins make apes vulnerable for 6s (+200 pts per ape eaten).
- **Limit**: Hard 2:00 timer. Time out = -1 life, retry.

### C. Chain Snake (Ref: Blockchain Theme)
- **Visuals**: Neon grid, visor cat head, glowing block links forming the tail.
- **Controls**: WASD / Arrow keys.
- **Mechanics**: Eat transaction packets (+20 pts) -> adds block link ("LINKED" flash). Gold Block Reward appears for 5s (+100 pts). Malware tile moves as hazard from 8 blocks.
- **Limit**: Hard 1:30 timer. Clear at **15 blocks**. Collision with wall, own tail, malware, or time out = -1 life.

---

## 4. Run State & Scoring Model
```
Global State (Persisted in localStorage):
{
  name: string,
  hunterId: 'NEON' | 'GLITCH' | 'CIPHER' | 'BYTE',
  lives: 3,
  score: 0,
  clearedMiniGames: ['BLOCK_FLYER'?, 'VAULT_RUN'?, 'CHAIN_SNAKE'?],
  hiddenPickupsFound: string[],
  runTimeRemaining: 420, // 7:00 in seconds
  isPaused: boolean,
  runCode: string
}
```
- **Scoring Rates**:
  - Flyer: 10/pillar, 25/coin
  - Vault: 10/pellet, 50/power coin, 200/ape
  - Snake: 20/tx, 100/block reward
  - District Clear: 500 each
  - Hidden tokens: 50 each
  - Street coins: 10 each
  - Time left at victory: 10 pts/sec
  - Lives remaining at victory: 300 pts/life
- **Badge Tiers**:
  - Bronze: Finish run
  - Silver: >= 4,000 pts
  - Gold: >= 6,500 pts

---

## 5. Pokémon Game Feel & Interface Details
1. **Grid Movement**: 1 tile step, smooth slide (~180ms walk, ~100ms run with SHIFT), face in place on tap, soft bump sound on walls.
2. **Dialogue Box**: Bottom screen, dark glass with cyan pixel border, typing effect in VT323 with blip audio, blinking ▼ arrow.
3. **Trainer Battle Encounter Trigger**:
   - Hacker Ape guards the portal.
   - Stepping within 4 tiles of its sight triggers `!` pop + sting audio -> ape approaches -> taunts in dialogue -> screen white flashes & spiral wipe -> launches mini-game with battle scene intro ("HACKER APE wants to battle!").
   - Upon victory, ape is defeated, awards 600 BIT + district badge, steps aside.
4. **START Menu (ENTER in Hub)**:
   - CHAIN-DEX (districts, tokens, lore)
   - HUNTER (trainer card, run code, badge slots, score)
   - LEDGER (leaderboard)
   - OPTIONS (music, SFX, CRT, Reduce Motion)
   - RESUME
5. **HUD**:
   - Thin glass top bar: ❤️❤️❤️ (cracks on loss), Score counter, 3 district portal icons (✓ on clear), 7:00 countdown (red flashing under 1:00).
   - Minimap (top-right GBA/DS frame, blinking player dot, portal markers, M toggles enlarged view).
   - Key hints bottom: `[WASD] MOVE · [SHIFT] RUN · [E] INTERACT · [M] MAP · [ENTER] MENU · [ESC] PAUSE`.

