# BIT-HUNTER 2099 — Loop 4: UI, Polish, Leaderboard & GBA Pokémon Feel

## 1. Intro & Naming Flow
1. **TitleScene**:
   - Cyberpunk animated title: "BIT-HUNTER 2099" with bounce-in.
   - Flashing "PRESS ENTER TO JACK IN".
   - Attract mode after 60s idle (cycling high scores and game tips).
2. **NameEntryScene & HunterSelectScene**:
   - Pokémon GBA style dialogue: Prof. Ledger introduces Neo-City and the blockchain threat.
   - Letter selection grid (A-Z, 0-9, _, END) + direct keyboard support.
   - Hunter cat selection (4 variants: NEON cyan, GLITCH magenta, CIPHER violet, BYTE gold).

## 2. In-Game HUD & GBA Overlay
- **Top HUD**:
  - 3 Cyber-Hearts (intact / shattered).
  - Ticking Score counter in gold Orbitron/VT323 font.
  - 3 District Portals indicator (unlocked / cleared green ✓).
  - 7:00 Run timer (flashes red with warning chime at < 1:00).
- **Minimap (Top-Right)**:
  - GBA/DS-styled chamfered border with scanlines.
  - Scaled map representation showing player location, 3 portal nodes, and discovered pickups.
  - `M` toggles expanded radar view.
- **START Menu (ENTER in Hub)**:
  - Slide-in menu box: CHAIN-DEX, HUNTER profile card, LEDGER, OPTIONS, RESUME.
  - Pauses the 7:00 run timer while open.

## 3. Results & Leaderboard Scene ("THE LEDGER")
- **Hall of Fame Sequence**:
  - Victory Fanfare.
  - Hunter cat on podium surrounded by the 3 earned district badges (Mining, Vault, Chain).
  - Tallying bonuses: Time bonus (10 pts/sec left) + Life bonus (300 pts/life left).
  - Generated deterministic Run Code (e.g. `#A7F3-91C2`).
  - Badge Tier calculated: Bronze Node (clear), Silver Node (>= 4,000 pts), Gold Node (>= 6,500 pts).
- **The Ledger Leaderboard**:
  - Top 10 high scores stored in `localStorage`.
  - Gold crown on #1 rank.
  - Highlight current player's run with `YOU` tag.
  - "PRESS ENTER TO JACK IN AGAIN" -> resets run state for new player.

