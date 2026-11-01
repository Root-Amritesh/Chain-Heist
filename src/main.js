import Phaser from './lib/phaser.js';
import { SCENE_KEYS } from './scenes/scene-keys.js';
import { PreloadScene } from './scenes/preload-scene.js';
import { BattleScene } from './scenes/battle-scene.js';
import { WorldScene } from './scenes/world-scene.js';
import { TitleScene } from './scenes/title-scene.js';
import { OptionsScene } from './scenes/options-scene.js';
import { TestScene } from './scenes/test-scene.js';
import { MonsterPartyScene } from './scenes/monster-party-scene.js';
import { MonsterDetailsScene } from './scenes/monster-details-scene.js';
import { InventoryScene } from './scenes/inventory-scene.js';
import { CutsceneScene } from './scenes/cutscene-scene.js';
import { DialogScene } from './scenes/dialog-scene.js';
import { DebugAssetsScene } from './scenes/debug-assets-scene.js';
import { HunterChoiceScene } from './scenes/hunter-choice-scene.js';
import { NameInputScene } from './scenes/name-input-scene.js';
import { IntroScene } from './scenes/intro-scene.js';
import { ResultsScene } from './scenes/results-scene.js';
import { LeaderboardScene } from './scenes/leaderboard-scene.js';
import { ApeBattleScene } from './scenes/ape-battle-scene.js';
import { BlockFlyerScene, VaultRunScene, ChainSnakeScene } from './scenes/minigames/minigame-scene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  pixelArt: true,
  roundPixels: true,
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  powerPreference: 'high-performance',
  antialias: false,
  scale: {
    parent: 'game-container',
    width: 1024,
    height: 576,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#000000',
});
/** @type {any} */ (window).__game = game;

// Debug FPS counter toggleable with F2
if (typeof document !== 'undefined') {
  let fpsVisible = false;
  const fpsTextElement = document.createElement('div');
  fpsTextElement.id = 'debug-fps-counter';
  fpsTextElement.style.position = 'fixed';
  fpsTextElement.style.top = '8px';
  fpsTextElement.style.left = '8px';
  fpsTextElement.style.zIndex = '99999';
  fpsTextElement.style.background = 'rgba(7, 4, 16, 0.88)';
  fpsTextElement.style.color = '#00FF66';
  fpsTextElement.style.border = '1.5px solid #3FF0FF';
  fpsTextElement.style.borderRadius = '4px';
  fpsTextElement.style.padding = '4px 10px';
  fpsTextElement.style.fontFamily = 'monospace';
  fpsTextElement.style.fontSize = '12px';
  fpsTextElement.style.fontWeight = 'bold';
  fpsTextElement.style.display = 'none';
  fpsTextElement.style.pointerEvents = 'none';
  fpsTextElement.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.3)';
  document.body.appendChild(fpsTextElement);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      fpsVisible = !fpsVisible;
      fpsTextElement.style.display = fpsVisible ? 'block' : 'none';
    }
  });

  game.events.on(Phaser.Core.Events.STEP, () => {
    if (fpsVisible && fpsTextElement) {
      const fps = Math.round(game.loop.actualFps);
      const delta = Math.round(game.loop.delta);
      fpsTextElement.textContent = `FPS: ${fps} | DELTA: ${delta}ms`;
      fpsTextElement.style.color = fps >= 55 ? '#00FF66' : fps >= 30 ? '#FFD700' : '#FF3366';
    }
  });
}

game.scene.add(SCENE_KEYS.PRELOAD_SCENE, PreloadScene);
game.scene.add(SCENE_KEYS.WORLD_SCENE, WorldScene);
game.scene.add(SCENE_KEYS.BATTLE_SCENE, BattleScene);
game.scene.add(SCENE_KEYS.TITLE_SCENE, TitleScene);
game.scene.add(SCENE_KEYS.OPTIONS_SCENE, OptionsScene);
game.scene.add(SCENE_KEYS.TEST_SCENE, TestScene);
game.scene.add(SCENE_KEYS.MONSTER_PARTY_SCENE, MonsterPartyScene);
game.scene.add(SCENE_KEYS.MONSTER_DETAILS_SCENE, MonsterDetailsScene);
game.scene.add(SCENE_KEYS.INVENTORY_SCENE, InventoryScene);
game.scene.add(SCENE_KEYS.CUTSCENE_SCENE, CutsceneScene);
game.scene.add(SCENE_KEYS.DIALOG_SCENE, DialogScene);
game.scene.add(SCENE_KEYS.DEBUG_ASSETS_SCENE, DebugAssetsScene);
game.scene.add(SCENE_KEYS.HUNTER_CHOICE_SCENE, HunterChoiceScene);
game.scene.add(SCENE_KEYS.NAME_INPUT_SCENE, NameInputScene);
game.scene.add(SCENE_KEYS.INTRO_SCENE, IntroScene);
game.scene.add(SCENE_KEYS.RESULTS_SCENE, ResultsScene);
game.scene.add(SCENE_KEYS.LEADERBOARD_SCENE, LeaderboardScene);
game.scene.add(SCENE_KEYS.APE_BATTLE_SCENE, ApeBattleScene);
game.scene.add(SCENE_KEYS.BLOCK_FLYER_SCENE, BlockFlyerScene);
game.scene.add(SCENE_KEYS.VAULT_RUN_SCENE, VaultRunScene);
game.scene.add(SCENE_KEYS.CHAIN_SNAKE_SCENE, ChainSnakeScene);
game.scene.start(SCENE_KEYS.PRELOAD_SCENE);
