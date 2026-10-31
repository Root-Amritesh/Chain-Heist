# Antigravity Game-Development Router Integration

## 🎮 Autonomous GameDev Routing

When responding to or working on any game-development task:
1. **Engine Detection**:
   - Check the active project fingerprint (`package.json`, `index.html` loading Phaser / Pixi / Three, `project.godot`, `*.uproject`, `go.mod`, etc.).
   - In this workspace (`monster-tamer`), the engine is **Phaser 3 (JavaScript)**.
   - For Phaser work, anchor to `phaser-core` and `phaser-arcade-physics`.

2. **Task & Genre Classification**:
   - For RPG mechanics (battles, stats, leveling, inventory, quests, dialogs): compose with `rpg`, `dialogue-systems`, `save-systems`.
   - For Art / Assets: compose with `create-game-assets`.
   - For Juice / Polish: compose with `game-feel`, `camera-systems`, `audio-design`, `game-ui-ux`.
   - For AI / Decision Trees: compose with `game-ai`, `ai-behavior-trees-utility-ai`.

3. **Routing Execution Workflow**:
   - Announce briefly the detected engine and loaded skills (e.g. `[GameDev Router: Phaser 3 + RPG + Game-Feel]`).
   - Consult the specific `SKILL.md` before generating architecture or code to uphold version-pinned best practices and prevent antipatterns.
   - Compose from low-level engine fundamentals -> discipline concepts -> genre logic -> polish/workflow.

