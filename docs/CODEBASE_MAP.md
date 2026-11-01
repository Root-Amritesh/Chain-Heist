# BIT-HUNTER 2099 / Monster Tamer — Codebase Architecture Map

This document details the exact architecture, scene flows, map data requirements, interaction patterns, and state storage of the game engine.

---

## 1. Scenes & Their Roles

| Scene Key | Class | File | Responsibility |
|---|---|---|---|
| `PreloadScene` | `PreloadScene` | `src/scenes/preload-scene.js` | Loads all images, audio, web fonts, JSON data, and Tiled maps. Bootstraps state. |
| `TitleScene` | `TitleScene` | `src/scenes/title-scene.js` | Displays title logo, plays title BGM, menu options (New Game, Continue, Options). |
| `WorldScene` | `WorldScene` | `src/scenes/world-scene.js` | Overworld exploration, Tiled map rendering, grid movement, camera follow, NPCs, signs, items, encounters. |
| `BattleScene` | `BattleScene` | `src/scenes/battle-scene.js` | Turn-based Pokémon-style battle scene (attacks, animations, HP bars, enemy & player monster logic). |
| `DialogScene` | `DialogScene` | `src/scenes/dialog-scene.js` | Overlay scene handling typewriter dialog boxes, text pagination, and confirmation menus. |
| `InventoryScene` | `InventoryScene` | `src/scenes/inventory-scene.js` | Menu showing player items, descriptions, and use/discard options. |
| `MonsterPartyScene` | `MonsterPartyScene` | `src/scenes/monster-party-scene.js` | Monster team lineup management, summary inspection, and monster swapping. |
| `MonsterDetailsScene` | `MonsterDetailsScene` | `src/scenes/monster-details-scene.js` | Detailed stat inspection for a monster (moves, HP, attack stats). |
| `CutsceneScene` | `CutsceneScene` | `src/scenes/cutscene-scene.js` | Scripted cutscenes, camera pans, and scripted character walks. |
| `OptionsScene` | `OptionsScene` | `src/scenes/options-scene.js` | Settings for text speed, battle style, sound volume, and menu colors. |
| `TestScene` | `TestScene` | `src/scenes/test-scene.js` | Sandbox test scene for isolated UI and animations. |

---

## 2. World Map Loading & Tiled Architecture

### A. Tiled JSON & Image Keys
- In `WorldScene.create()`, the level is loaded via:
  ```javascript
  const map = this.#getLevelTileMap(`${this.#sceneData.area.toUpperCase()}_LEVEL`);
  ```
  Default area: `main_1` -> `assets/data/main_1.json` (asset key `MAIN_1_LEVEL`).
- **Tile Size**: 64x64 pixels (`TILE_SIZE = 64` in `src/config.js`).
- **Visual Layers**:
  - Background image: `MAIN_1_BACKGROUND` (`assets/images/maps/main_1_level_background.png`) rendered at `(0, 0)` with depth 0.
  - Foreground image: `MAIN_1_FOREGROUND` (`assets/images/maps/main_1_level_foreground.png`) rendered at depth 1 for overhangs/trees.
- **Tile Layer**:
  - `Collision`: Uses tileset image named `'collision'` (`assets/images/world/collision.png`). Painted tiles denote blocked squares.

### B. Tiled Object Layers (Exact Names from `src/assets/tiled-keys.js`)
| Layer Name | Required / Optional | Purpose |
|---|---|---|
| `Player-Spawn-Location` | **Required** | Point/rectangle object where player spawns on a new game. |
| `Revive-Location` | **Required** | Point/rectangle where player respawns after fainting/blacking out. |
| `Camera-Bounds` | Optional | Rectangles defining camera bounding regions. |
| `Sign` | Optional | Objects with custom property `id` (maps to dialog in `assets/data/dialog.json`). |
| `Scene-Transitions` | Optional | Warps to interior buildings or other map zones. |
| `Item` | Optional | Items placed in world (properties: `item_id`, `id`). |
| `Area-Metadata` | Optional | Region metadata like encounter zones and faint locations. |
| `Events` | Optional | Event trigger zones for scripted trainer sights or story cutscenes. |

---

## 3. NPCs, Signs, and Dialog System

### A. NPCs in Tiled
- In Tiled, NPCs are defined on an object layer as custom type `'npc'`.
- **Properties**:
  - `id`: Unique numeric or string ID.
  - `frame`: Sprite sheet frame number to use.
  - `movement_pattern`: Movement behavior (`'idle'`, `'wander'`, `'clockwise'`, etc.).
- **NPC Sight / Battle Trigger**:
  - If NPC has event triggers or sight lines, stepping into its line-of-sight triggers an exclamation mark (`!`), pathfinding to player, and dialog.

### B. Signs
- Defined on the `Sign` object layer with custom property `id`.
- Interacting with the facing tile loads sign text from `assets/data/dialog.json` using the sign's `id`.

### C. Dialog Mechanism
- `DialogScene` runs as a parallel overlay.
- Text typing is configurable (`TEXT_SPEED`).
- Pressing **Space / Enter** advances lines or skips to the end of the current line.

---

## 4. Battles: Triggers & Return Lifecycle

### A. How Battles are Triggered
1. **Wild Encounters**:
   - Stepping on grass/encounter tiles rolls a weighted random check in `WorldScene.#handlePlayerMovementUpdate()`.
2. **Trainer / NPC Encounters**:
   - Stepping into NPC sight triggers `NPC_EVENT_TYPE.BATTLE` or `NPC_EVENT_TYPE.MESSAGE`.
3. **Transition**:
   - Camera flash / spiral transition (`src/utils/scene-transition.js`).
   - `WorldScene` calls:
     ```javascript
     this.scene.start(SCENE_KEYS.BATTLE_SCENE, {
       isTrainerBattle: true,
       enemyMonster: enemyMonsterData,
       trainerNpcId: npcId,
     });
     ```

### B. How Battle Scene Ends
- In `BattleScene`, battle concludes when:
  - Enemy monster faints (Player victory) -> awards EXP / gold -> scene fades to black.
  - Player monster faints (Loss / Whiteout) -> if party wiped, triggers whiteout.
  - Flee (Run) -> battle ends immediately.
- Ending call:
  ```javascript
  this.scene.start(SCENE_KEYS.WORLD_SCENE, {
    isPlayerKnockedOut: playerLost,
    area: previousArea,
  });
  ```
- `WorldScene.init(data)` receives this data and handles post-battle dialogue or faint repositioning.

---

## 5. Controls Architecture (`src/utils/controls.js`)
Controls are encapsulated in the `Controls` class:
- **Movement**: Arrow Keys (`cursorKeys.up`, `down`, `left`, `right`).
- **Confirm / Action / Interact**: `Space` (`cursorKeys.space`) or `Enter` (`enterKey`).
- **Back / Cancel**: `Shift` (`cursorKeys.shift`).
- **Debug / Special**: `F` (`fKey`).
- Can lock player input globally during animations or dialog via `controls.lockInput = true`.

---

## 6. Global State & Persistence (`src/utils/data-manager.js`)
- **Key**: `localStorage` item name `'MONSTER_TAMER_DATA'`.
- **State Schema (`initialState`)**:
  - `player`: `{ position: { x, y }, direction, location: { area, isInterior } }`
  - `options`: `{ textSpeed, battleSceneAnimations, battleStyle, sound, volume, menuColor }`
  - `gameStarted`: boolean
  - `monsters`: `{ inParty: [] }`
  - `inventory`: `{ items: [] }`
  - `itemsPickedUp`: `number[]`
  - `viewedEvents`: `number[]`
  - `flags`: `GameFlag[]`
  - `defeatedNpcs`: `string[]`

---

## 7. Direct Guidance for BIT-HUNTER 2099 Integration
1. **Overworld Map**:
   - Replace `main_1_level_background.png` with `neo-city.png` (3840×2304).
   - In `main_1.json`, match the exact layer names: `Collision`, `Player-Spawn-Location`, `Revive-Location`, `Camera-Bounds`, `Sign`, `Item`, `Events`.
2. **Mini-Game Portals**:
   - Model the 3 Hacker Ape guards as NPCs with custom IDs (`ape_mining`, `ape_vault`, `ape_data`).
   - Hook their battle trigger in `BattleScene` or `WorldScene` to launch our 3 mini-game scenes (`BlockFlyerScene`, `VaultRunScene`, `ChainSnakeScene`).
3. **Global State Integration**:
   - Extend `dataManager` or attach `state.js` to track `lives: 3`, `score: 0`, `runTimer: 420`, and `cleared: []`.

