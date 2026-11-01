# BIT-HUNTER 2099 — Project & Agent Development Rules

These rules are strictly enforced for **all AI agents and developers** working on this repository. They supersede any generic suggestions and must be followed at every step.

---

## 🛡️ The 12 Golden Rules

1. **Never rewrite working systems from Monster Tamer.**
   - Do NOT rewrite or replace existing working systems (grid movement, camera follow, dialog box, sound manager, scene transitions, etc.). Extend or re-skin them.
   - Do NOT tear down functional code to build from scratch.

2. **Never create all phases in one prompt.**
   - Work incrementally, one milestone/feature at a time.
   - Never batch multiple distinct systems (e.g. all 3 mini-games + menus + map) into a single sprawling, untestable change.

3. **Never duplicate the game state.**
   - Maintain a single source of truth for global run state (`lives`, `score`, `timer`, `clearedMiniGames`, `pickupsFound`, `runCode`).
   - All scenes read and write to the same centralized state manager (`src/bit-hunter/state.js`). Never cache divergent copies of state in scene instances.

4. **Never create placeholder functions and claim they're working.**
   - Every function implemented must be real, functional, and testable.
   - Never write empty stubs, mock handlers, or fake implementations and tell the user they work.

5. **Never install unnecessary dependencies.**
   - Keep the project lean. We are using Phaser 3 in the browser.
   - Do not pull in heavy UI frameworks, React/Next.js layers, or redundant libraries when native Phaser/DOM features suffice.

6. **Keep Phaser scenes independent.**
   - Each scene (`TitleScene`, `WorldScene`, `BattleScene`, `ChainSnakeScene`, `BlockFlyerScene`, `VaultRunScene`, `ResultsScene`, `LeaderboardScene`) must manage its own lifecycle, assets, display list, and event listeners cleanly.
   - Clean up timers, tweens, and listeners on scene shutdown (`Phaser.Scenes.Events.SHUTDOWN`) to prevent memory leaks and zombie loops.

7. **Keep backend / state communication outside rendering logic.**
   - Rendering loops (`update()`, `render()`) must only handle display and physics updates.
   - State mutations, persistence (`localStorage`), audio routing, and network calls must be handled via event emitters or dedicated service calls, not in render passes.

8. **Use consistent types and contracts.**
   - Enforce clean contracts and parameter schemas for scene data transfer (`scene.start(key, data)`).
   - Maintain consistent data structures across states, maps, and events.

9. **Run the game and verify every meaningful change.**
   - After implementing a milestone, test it in the running browser environment.
   - Check console logs for Phaser warnings, asset loading errors, or broken transitions before marking a task complete.

10. **Commit after every working milestone.**
    - Use clean, conventional git commits after every verified, working milestone.
    - If a change breaks, revert or fix it immediately before proceeding to the next feature.

11. **Keep the code short, readable and maintainable.**
    - Write clean, idiomatic JavaScript/TypeScript following the patterns already present in Monster Tamer.
    - No spaghetti code, no massive monolithic functions, and no unnecessary abstraction layers.

12. **Never sacrifice functionality for visual effects.**
    - Gameplay readability, responsiveness, and 60 FPS performance come first.
    - Shader passes, particle emitters, bloom, and screen shakes must never obscure player vision, collision boundaries, or cause frame drops.
    - Respect accessibility (`Reduce Motion` mode must disable intense flashes/shakes).

---

## 📌 Engine & Workspace Anchors
- **Engine**: Phaser 3 (JavaScript)
- **Active Skills**: `phaser-core`, `phaser-arcade-physics`, `rpg`, `game-feel`, `dialogue-systems`, `save-systems`
- **Memory Base**: Located in `.agents/memory/`

