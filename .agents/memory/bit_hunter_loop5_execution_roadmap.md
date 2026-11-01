# BIT-HUNTER 2099 — Loop 5: Step-by-Step Execution Plan & Verification Checkpoints

## Phased Execution Roadmap

### Step 1: Baseline Architecture & Asset Ingestion
- Ingest sliced assets from `bithunter-assets.zip` into `assets/images/bithunter/`.
- Ensure web server serves the project smoothly.
- Define `src/bit-hunter/state.js` global singleton managing lives, score, timers, and cleared states.

### Step 2: Title, Professor Intro & Naming
- Adapt Title Scene into "BIT-HUNTER 2099" with cyberpunk cyber-neon styling.
- Implement Pokémon-style Prof. Ledger dialogue intro & Hunter name / variant selection.

### Step 3: Overworld Hub, Tiled Map & Pokémon Grid Feel
- Wire `neo-city` map into `WorldScene`.
- Ensure player has 4-directional grid movement, bump sounds on collision, and smooth camera clamping.
- Implement top HUD (3 lives, score, timer, portal badges) and GBA-style minimap with `M` toggle.
- Add 15 floating gold street coins (+10 pts) and 10 hidden search spots (+50 pts).

### Step 4: Hacker Ape Encounters & Battle Scene Wrappers
- Place 3 Hacker Ape guards at the 3 district portals:
  - Mining District -> Block Flyer
  - Chain-Bank Vault -> Vault Run
  - Data Hub -> Chain Snake
- Implement the 4-tile line-of-sight `!` alert, approach walk, taunt dialogue, and battle swirl transition.
- In `BattleScene`, customize the command menu (`FIGHT`, `BAG`, `RUN`) to dispatch to the respective mini-game.

### Step 5: Implement Mini-Games
- **Chain Snake**: 15 blocks target, 1:30 timer, transaction packets, malware obstacle.
- **Block Flyer**: 20 server pillars target, Arcade physics, neon trail, drones, coin pickups.
- **Vault Run**: 2:00 timer, neon maze, B pellets, 4 AI apes, power pellets.

### Step 6: Results, Hall of Fame & The Ledger Leaderboard
- Build `ResultsScene` with victory / defeat fanfare, badge award (Bronze/Silver/Gold), run code, and bonus calculations.
- Build `LeaderboardScene` ("THE LEDGER") showing local top 10 rankings with player highlight.

### Step 7: Final Audio, CRT / Scanline FX & Polish
- Ensure Web Audio sound effects (blip, coin collect, hit, victory, alert).
- Add subtle neon particles and scanlines.
- Verify full offline build (`npm run build` or static dist serving).

