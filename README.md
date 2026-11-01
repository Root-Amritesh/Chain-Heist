<div align="center">

# ⚡ BIT-HUNTER 2099 ⚡
### Cyberpunk Blockchain Arcade RPG

[![Engine](https://img.shields.io/badge/Phaser-3.60.0-E0234E.svg?style=for-the-badge&logo=phaser)](https://phaser.io/)
[![Bundler](https://img.shields.io/badge/Vite-6.0.0-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Database](https://img.shields.io/badge/MongoDB-Leaderboard-47A248.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Runtime](https://img.shields.io/badge/Node.js-18%2B-339933.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Build-Passing-00E5FF.svg?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-FFD700.svg?style=for-the-badge)](LICENSE)

*An enterprise-grade, high-performance web arcade experience combining top-down cyber-city exploration with authentic arcade infiltration minigames and an immutable consensus leaderboard.*

[Quick Start](#-quick-start) • [Game Architecture](#-architecture--tech-stack) • [Tutorial & Guide](#-gameplay-guide--tutorial) • [Controls](#-controls--keybindings) • [Deployment](#-deployment-guide)

</div>

---

## 📜 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Repository Structure](#-repository-structure)
- [Quick Start & Setup Guide](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Development Server](#running-development)
  - [Building for Production](#building-for-production)
- [Gameplay Guide & Tutorial](#-gameplay-guide--tutorial)
  - [Neo-City Overworld](#1-neo-city-overworld)
  - [The Four Infiltration Portals](#2-the-four-infiltration-portals)
  - [Vault Run (Cryptographic Ledger Run)](#3-vault-run-authentic-pac-man-engine)
  - [Unified Scoring & The Ledger](#4-unified-scoring--the-ledger)
- [Controls & Keybindings](#-controls--keybindings)
- [MongoDB Leaderboard System](#-mongodb-leaderboard-system)
- [Deployment Guide](#-deployment-guide)
  - [Static Web Deployment](#static-web-deployment)
  - [Itch.io Deployment via Butler](#itchio-deployment-via-github-actions)
- [Contributing & License](#-license)

---

## 🌟 Overview

**BIT-HUNTER 2099** puts players in control of an elite cybernetic hunter unit navigating **Neo-City**, a sprawling 1920×1152 cyberpunk metropolis under lockdown by rogue hacker daemons. 

To restore order and achieve consensus, operatives must breach four decentralized security districts, survive timed arcade challenges, gather cryptographic tokens, and log their immutable proof-of-work run scores to **The Ledger**.

```
+-------------------------------------------------------------------------+
|                           NEO-CITY OVERWORLD                            |
|             (Continuous Sub-Stepped Walkmask Physics: 1920x1152)        |
+--------------------+-------------------+-------------------+------------+
         |                    |                   |                |
         v                    v                   v                v
 [PORTAL 1: FLYER]   [PORTAL 2: VAULT]   [PORTAL 3: SNAKE]   [PORTAL 4: HEIST]
  Block Avoidance      Authentic Pac-Man   Consensus Chain     North-Lane Core
  Throughput Test      Ghost AI Personal.  Data Link Feeder    Interactive Sim
         |                    |                   |                |
         +--------------------+-------------------+----------------+
                              |
                              v
                [TIME & SCORE SINGLE-SOURCE OF TRUTH]
                 - TimeManager (Synchronized Clock)
                 - ScoreManager (Deterministic Formula)
                              |
                              v
               [THE LEDGER (MONGODB CONSENSUS)]
                - MongoDB Atlas / Local Daemon
                - Offline JSON Consensus Fallback
```

---

## ⚡ Key Features

- **Continuous Sub-Stepped Collision & Grounding**:
  - Pure vector velocity movement with 8-directional normalized diagonals.
  - Pixel-accurate sub-stepped box collision against a hand-corrected binary walkmask.
  - Separate X/Y collision resolution enabling silky smooth wall-sliding.
  - Depth sorting determined strictly by `depth = feetY` every frame for pixel-perfect occlusions.
  - Automated boot-time flood-fill algorithm verifying 100% reachable spawn clearance for all NPCs, coins, and portals.

- **Vault Run (Cryptographic Ledger Run - Authentic Pac-Man Engine)**:
  - Fixed-timestep target-to-target grid movement (zero drift or tile-boundary vibration).
  - Directional corner buffering: turns queue and execute cleanly at intersection centers.
  - Instant 180° reversals anywhere along a tile corridor.
  - 4 distinct Ghost Ape AI personalities:
    - **Shadow Ape (Blinky)**: Direct player chaser.
    - **Cyber Ape (Pinky)**: Intercepting ambusher targeting 4 tiles ahead.
    - **Rogue Ape (Inky)**: Flanker vectoring off Blinky and player coordinates.
    - **Glitch Ape (Clyde)**: Coward that stalks at range and retreats to corner when close.
  - Power coins trigger Frightened mode with vulnerable blue daemons, halved speed, and bonus score.
  - **Death Continuation Confirmation**: Catches pause gameplay and prompt the operative (`[YES - RESPAWN]` / `[NO - ABORT]`) to prevent accidental life exhaustion.
  - **ESC Pause & Exit Confirmation**: Instant mission abort popup with clean transition back to the overworld.

- **Universal Time Architecture (`TimeManager`)**:
  - Single source of truth managing both overworld countdown (default 07:00) and strict 90-second minigame sessions.
  - Minigame time elapsed is deducted in real time from the overworld clock upon return.
  - Heartbeat-driven crash and browser refresh resilience.

- **Unified Scoring (`ScoreManager`) & Anti-Cheat**:
  - Deterministic score calculations factoring district clear bonuses, tokens, time multipliers, and heart integrity.
  - Cryptographic verification code generation (`#XXXX-XXXX`) for proof-of-run validity.

- **The Ledger (MongoDB Leaderboard)**:
  - Production-ready MongoDB integration for global rankings (`All-Time` and `Today` filtering).
  - Built-in transparent offline fallback to a local consensus cache with automatic synchronization upon reconnect.
  - Live HUD status pill: `● MONGO CONSENSUS (ONLINE)` or `○ LOCAL CONSENSUS (OFFLINE)`.

---

## 🛠 Architecture & Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Game Engine** | [Phaser 3.60.0](https://phaser.io/) | Canvas/WebGL rendering, Arcade math, Tween animations |
| **Bundler & Dev Server** | [Vite 6.0](https://vitejs.dev/) | Sub-second HMR, ES module bundling, custom backend middleware |
| **Language** | ES2022+ JavaScript / JSDoc | Clean modern modules with strict type checking via `jsconfig.json` |
| **Database** | [MongoDB 6+](https://www.mongodb.com/) | Official Node driver, indexed queries for global score consensus |
| **Testing & CI/CD** | [Playwright](https://playwright.dev/) | Headless browser integration testing and GitHub Actions workflow |
| **Typography & Art** | Kenney Future Narrow / Pixel Art | Retro-futuristic cyberpunk vector font, animated neon glow shaders |

---

## 📁 Repository Structure

```text
monster-tamer/
├── assets/                          # Static audio, spritesheets, and maps
│   ├── fonts/                       # Retro typography (Kenney Future Narrow)
│   └── images/bithunter/            # Cyberpunk city assets, sprites, walkmask
│       └── maps/
│           ├── neo-city.png         # Canonical 1920x1152 overworld map
│           └── neo-city-walkmask.png# Binary collision walkmask (White=Walk, Black=Block)
├── server/                          # Backend services
│   └── mongo-leaderboard.js         # MongoDB client, indexed queries, offline cache
├── data/                            # Persistent offline consensus storage
│   └── leaderboard-db.json          # Mirrored local leaderboard data
├── src/
│   ├── config/                      # Configuration constants
│   │   ├── vault-run-config.js      # 28x22 maze grid, ghost configs, spawn specs
│   │   └── index.js                 # Global resolution (1024x576), time, score caps
│   ├── scenes/                      # Phaser Scenes
│   │   ├── base-scene.js            # Foundation class with scene lifecycle hooks
│   │   ├── title-scene.js           # Unit selection, operative registration
│   │   ├── world-scene.js           # Neo-City continuous movement, portals, NPCs
│   │   ├── leaderboard-scene.js     # The Ledger table with tabbed queries
│   │   ├── results-scene.js         # Mission debrief, scoring calculation breakdown
│   │   └── minigames/               # Decentralized District Minigames
│   │       ├── vault-run-scene.js   # Cryptographic Ledger Run (Pac-Man)
│   │       ├── block-flyer-scene.js # District 1 obstacle avoidance
│   │       └── chain-snake-scene.js # District 3 consensus feeder
│   ├── state/
│   │   └── run-state.js             # Live player run state (lives, score, tokens)
│   ├── systems/                     # Single source of truth managers
│   │   ├── time-manager.js          # Synchronized clock & session deduct system
│   │   ├── score-manager.js         # Deterministic score & bonus engine
│   │   └── leaderboard.js           # Client-side API adapter & offline fallback
│   ├── world/
│   │   └── walkmask.js              # Binary mask loader, flood-fill & collision
│   └── main.js                      # Phaser Game instance bootstrap
├── vite.config.js                   # Vite config with MongoDB /api middleware
├── package.json                     # Scripts & dependencies
└── jsconfig.json                    # Type checking rules
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` or `pnpm`
- *(Optional)* [MongoDB Community Server](https://www.mongodb.com/try/download/community) or a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Root-Amritesh/Chain-Heist.git
   cd Chain-Heist
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Environment Configuration

The application works 100% out-of-the-box using the local consensus cache. To connect to a live MongoDB instance, create a `.env` file in the project root:

```env
# MongoDB Connection String (Local or MongoDB Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017

# Database Name
MONGODB_DB_NAME=bithunter

# Optional dev server port
PORT=5174
```

### Running Development

Launch the Vite development server with the integrated MongoDB API router:

```bash
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:5174/
```

### Building for Production

To create an optimized, minified production distribution:

```bash
npm run build
```

The output will be generated inside the `dist/` directory, ready to deploy to any web host.

To preview the production build locally:
```bash
npm run preview
```

---

## 🎮 Gameplay Guide & Tutorial

### 1. Neo-City Overworld
- **Objective**: Infiltrate all 4 security districts before the overworld clock (07:00) expires.
- **Exploration**: Explore the streets of Neo-City using continuous movement. Walk sliding allows fluid navigation through narrow alleys.
- **Crypto Coins & Tokens**:
  - Collect gold Bitcoin coins scattered throughout the city for instant BIT score.
  - Locate 10 hidden cryptographic tokens hidden across landmarks.
- **NPC Informants**: Interact with operatives across the districts for hints and security status updates.

### 2. The Four Infiltration Portals
Step onto glowing holographic portal pads to trigger minigames:
1. **[1] BLOCK FLYER**: Navigate a cyber flyer through firewall pulses.
2. **[2] VAULT RUN**: Infiltrate the central cryptographic ledger maze (see detailed breakdown below).
3. **[3] CHAIN SNAKE**: Assemble unconfirmed transactions into valid blocks.
4. **[4] CHAIN HEIST**: The northern terminal core challenge located at the north-lane dead-end (`500, 310`).

### 3. Vault Run (Authentic Pac-Man Engine)
- **Rules**:
  - Drain all **206 cryptographic ledger pellets** (`+10 BIT` each) to secure the vault.
  - Grab the 4 corner **Power Coins** (`+50 BIT`) to overclock and freeze the Hacker Daemons.
  - When daemons turn cyan, eat them for `+200 BIT` each.
  - Avoid daemons in normal mode; contact drains 1 life.
- **Life Management & Continuation**:
  - If caught by a daemon while lives remain, the system pauses and prompts:
    ```
    // OPERATIVE COMPROMISED //
    REMAINING LIVES: ♥ ♥ (2/3)
    CONTINUE INFILTRATION?
    [ YES - RESPAWN ]    [ NO - ABORT RUN ]
    ```
  - Selecting **YES** respawns your cat with temporary invulnerability.
  - Selecting **NO** aborts the run cleanly, saving your remaining hearts and score.
- **ESC Pause & Exit**: Press `ESC` at any time to open the abort confirmation menu, or press `ESC` again to resume.

### 4. Unified Scoring & The Ledger
At the end of your run, **ScoreManager** tallies:
$$\text{Final Score} = \text{Base Mission Score} + \text{Time Bonus} + \text{Heart Integrity Bonus}$$
- Submitting publishes your Operative Name, Score, Districts Cleared, Tokens, and Badges to **The Ledger**.
- Filter between **ALL-TIME** and **TODAY** to inspect rankings.

---

## ⌨️ Controls & Keybindings

### Overworld Navigation
| Key | Action |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | Continuous 8-directional player movement |
| <kbd>SPACE</kbd> / <kbd>ENTER</kbd> | Interact with NPCs, enter portals, confirm dialogues |
| <kbd>ESC</kbd> | Pause menu / Cancel mission prompt |
| <kbd>M</kbd> | Open full-screen high-resolution vector map |
| <kbd>R</kbd> | Toggle reduce-motion mode (accessibility) |
| <kbd>F1</kbd> | Toggle debug collision walkmask tint and coordinate overlay |
| <kbd>F2</kbd> | Open in-engine Walkmask Editor (Exports to safe standalone file) |

### Minigames & Modals
| Key | Action |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / Arrow Keys | Steer character / Navigate modal options |
| <kbd>ENTER</kbd> / <kbd>SPACE</kbd> | Confirm selected modal option (`YES` / `NO`) |
| <kbd>ESC</kbd> | Open Pause/Abort popup / Resume current minigame |

---

## 🗄 MongoDB Leaderboard System

The game features an enterprise-grade hybrid storage architecture:

```
[Phaser Client]
       │
       ▼ (HTTP REST)
[Vite API Middleware (/api/leaderboard)]
       │
       ├──► [MongoDB Database ('bithunter.leaderboard')]
       │      • High-performance sorted query { score: -1, createdAt: 1 }
       │      • Unique verificationCode index (anti-duplication)
       │
       └──► [Local JSON Consensus Cache ('data/leaderboard-db.json')]
              • Automatic fallback if MongoDB is offline
              • Auto-syncs to MongoDB when connection restores
```

### Leaderboard API Endpoints
- `GET /api/leaderboard?limit=50&range=all` - Fetches top 50 all-time entries.
- `GET /api/leaderboard?limit=50&range=today` - Fetches today's top scores.
- `POST /api/leaderboard` - Submits a validated score entry.
- `GET /api/leaderboard/status` - Checks MongoDB health & connection state.

---

## 🌐 Deployment Guide

### Static Web Deployment
The build output (`dist/`) can be deployed to any static host:
- **Vercel / Netlify**: Connect your GitHub repository and set the build command to `npm run build` and output directory to `dist`.
- **GitHub Pages**: Build the project and deploy the `dist/` directory via `gh-pages`.

### Itch.io Deployment via GitHub Actions
A production-ready GitHub Action workflow is included in [`.github/workflows/itchio-deploy.yaml`](.github/workflows/itchio-deploy.yaml).

1. In your GitHub repository, add your itch.io Butler API key as a secret:
   - Secret Name: `ITCH_IO_API_KEY`
2. Update the environment variables in `.github/workflows/itchio-deploy.yaml`:
   ```yaml
   ITCH_GAME: bit-hunter-2099
   ITCH_USER: your-itch-username
   CHANNEL: html5
   ```
3. Trigger the workflow manually via `workflow_dispatch` or push to your release branch.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
<b>BIT-HUNTER 2099</b> • Built with ❤️ using Phaser 3 and Vite.
</div>
