# BIT-HUNTER 2099 — Loop 3: Mini-Game Technical Specifications & State Contracts

## Contract: Mini-Game Launch & Return Parameters
Every mini-game scene accepts:
```javascript
{
  gameKey: 'CHAIN_SNAKE' | 'BLOCK_FLYER' | 'VAULT_RUN',
  portalId: 'mining' | 'vault' | 'data_hub',
  apeGuardId: string
}
```

### 1. Chain Snake (`ChainSnakeScene`)
- **Canvas / Grid**: 480x320 internal, 16x16 tile grid (~28x18 playable area).
- **Entities**:
  - Head: Visor cat head sprite with directional rotation.
  - Tail: Array of block coordinates rendered as glowing cyan rectangular links with connector lines.
  - Food (TX Packet): Glowing icon; triggers `+20` points and `LINKED` popup.
  - Bonus (Block Reward): Golden coin spawning intermittently for 5 seconds (+100 pts).
  - Hazard (Malware): Red corrupted block moving every 2 ticks once length >= 8.
- **Controls**: WASD / Arrow keys. Prevents reverse self-collision.
- **Rules**:
  - Timer: 90s countdown (1:30).
  - Clear Target: 15 blocks.
  - Death: Wall collision, self-collision, malware hit, or time out.
  - Result:
    - Win: emits `mini-game-win`, sets `state.cleared['CHAIN_SNAKE'] = true`, awards +500 pts, returns to battle/hub.
    - Loss: `state.lives -= 1`, if `lives <= 0` goto `ResultsScene`, else returns to hub in front of portal.

### 2. Block Flyer (`BlockFlyerScene`)
- **Canvas / World**: 480x320, horizontal scrolling Arcade physics.
- **Entities**:
  - Parallax Background: 2-3 layers of Neo-city skyline scrolling at varying speeds.
  - Player: Cat sprite with Arcade physics gravity and velocity impulses on SPACE / W.
  - Tail Particle: Streaming cyan/magenta particle emitter behind cat.
  - Obstacles: Server-rack pillars (top & bottom gaps) generated dynamically with smooth spacing.
  - Drones: Flying obstacles appearing starting from pillar 5.
  - Collectibles: Floating gold coins between gaps (+25 pts).
- **Rules**:
  - Clear Target: 20 pillars passed (HUD shows `0/20`). Speed ramps up at 5, 10, 15.
  - Death: Collision with pillar, drone, or ground/ceiling.
  - Result:
    - Win: +500 pts, clears portal, returns to hub.
    - Loss: `state.lives -= 1`, returns to hub in front of portal.

### 3. Vault Run (`VaultRunScene`)
- **Canvas / World**: 480x320, neon double-line maze layout.
- **Entities**:
  - Maze: Grid-based walls with cyan & magenta neon strokes.
  - Player: Visor cat moving along grid tracks.
  - Pellets: Gold "B" glyphs on grid nodes (+10 pts).
  - Power Pellets: 4 large glowing BTC coins in corners (+50 pts, frightens apes for 6s).
  - Apes: 4 AI apes (Blinky/Pinky/Inky/Clyde styles: direct chase, ambush, flank, wander).
- **Rules**:
  - Timer: 120s countdown (2:00).
  - Clear Target: Eat all pellets.
  - Result:
    - Win: +500 pts, clears portal, returns to hub.
    - Loss: Ape touch when not frightened or time out = `state.lives -= 1`.

