# BIT-HUNTER 2099 — Loop 2: Engine Integration & Asset Architecture Analysis

## 1. Monster Tamer Codebase Map vs Bit-Hunter Needs
- **Monster Tamer Engine Structure**:
  - `src/main.js`: Game config, scene registrations (`PreloadScene`, `TitleScene`, `WorldScene`, `BattleScene`, `DialogScene`, `InventoryScene`, etc.).
  - `src/scenes/world-scene.js`: Tiled map rendering, player movement, interaction grid, NPC handling, transitions to `BattleScene`.
  - `src/scenes/battle-scene.js`: Turn-based Pokémon battle UI. We hook the Hacker Ape encounter here to trigger mini-games.
  - `src/common/direction.js`, `src/utils/grid-utils.js`: Directional and tile grid utilities.
  - `assets/data/`: Tiled JSON maps (`main_1.json`), monster stats, dialog data.
  - `assets/images/`: Backgrounds, character sprites, monster sprites, battle UI assets.

## 2. Adapting Monster Tamer into Bit-Hunter 2099
Instead of ripping out Monster Tamer's working pipeline, we:
1. **Preserve & Skin WorldScene**:
   - Swap `assets/images/maps/main_1_level_background.png` with Neo-City map.
   - Adjust `main_1.json` object layers for:
     - 3 Portal NPCs (Ape guards) -> trigger Block Flyer, Vault Run, Chain Snake.
     - 15 street coin pickups (collectible on overlap/grid-step).
     - 10 hidden token spots (crates/bushes with face-and-interact E).
     - 4 Cyberpunk citizen NPCs for lore & blockchain tips.
2. **Global State Manager (`src/bit-hunter/state.js`)**:
   - Standalone module tracking `lives (3)`, `score`, `runTimer (420s)`, `cleared: []`, `hunterId`, `name`, `badges: []`.
   - Accessible by all scenes; saves snapshots in `localStorage`.
3. **Mini-Game Scene Additions**:
   - `src/scenes/mini-games/chain-snake-scene.js`
   - `src/scenes/mini-games/block-flyer-scene.js`
   - `src/scenes/mini-games/vault-run-scene.js`
   Each adheres to standard Phaser 3 scene lifecycles with countdown, in-game HUD overlay, clear condition, and death/life loss routing back to the Hub or Game Over.
4. **Battle Wrapper Hook**:
   - When encountering an Ape guard, launch BattleScene with custom Hacker Ape dialogue -> selecting "FIGHT" starts the corresponding mini-game scene.
   - On mini-game clear, return to BattleScene victory sequence (Ape faints, awards 600 BIT + Badge, returns to WorldScene with portal cleared).

