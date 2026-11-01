# Game Development Guidelines & Skills Alignment

This project is guided by the **awesome-gamedev-agent-skills** suite. When architecting, writing, reviewing, or refactoring code for Monster Tamer (Phaser 3 RPG):

1. **Phaser Engine Best Practices (`phaser-core`, `phaser-arcade-physics`)**:
   - Strictly manage scene lifecycles (`init`, `preload`, `create`, `update`). Clean up listeners, timers, and tweens on scene shutdown to prevent memory leaks.
   - Use Arcade physics collision layers, groups, and bounding boxes properly. Avoid physics modifications directly in rendering loops.
   - Decouple Phaser rendering display objects from pure gameplay logic/state where appropriate.

2. **RPG Architecture (`rpg`, `game-architecture`, `game-design`)**:
   - Turn-based battle systems: state machine-driven (Player turn, Monster attack, Animation step, Damage calculation, Enemy turn, Result).
   - Monster stats, moves, leveling, and type efficacy tables should remain data-driven (JSON / modular data files).
   - Dialogues and cutscenes should adhere to clear message queues without blocking state updates.

3. **Game Feel & Polish (`game-feel`, `camera-systems`, `game-ui-ux`, `audio-design`)**:
   - Implement responsive input buffering and cursor feedback.
   - Maintain audio mixing levels (BGM vs SFX) and handle user interaction audio unlocking gracefully.
   - Smooth camera lerping, screen shakes for critical moves, and juice.

4. **Persistence & Performance (`save-systems`, `performance-optimization`)**:
   - Maintain safe serialization for player progress, monster team state, inventory, and flags.
   - Keep texture atlases efficient and audio files optimized.

