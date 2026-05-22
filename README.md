# Backrooms Escape: Found Footage 3D

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/Himavanth97/roblox-backrooms-game)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Three.js](https://img.shields.io/badge/3D-Three.js-orange)](https://threejs.org/)
[![Roblox Rojo](https://img.shields.io/badge/Roblox-Rojo-blue)](https://rojo.space/)

An immersive, high-aesthetic 3D survival horror game based on the Backrooms Level 0 legend. This repository hosts a dual architecture:
1. **First-Person Web 3D Game**: A high-performance browser-based survival simulation built using **Three.js** and procedural texturing/audio engines.
2. **Roblox Rojo Developer Suite**: Production-grade Lua scripts for NPC Pathfinding AI, battery-drained flashlights, and camera sways ready to sync directly to Roblox Studio.

---

## 📺 Web Game Features

* **VHS Camcorder Simulation**: Custom CRT scanlines, lens vignettes, visual static noise shifts, color glitches, and blinking recording overlays for a genuine "found footage" aesthetic.
* **Procedural Maze Level Engine**: Randomized maze configurations using a Depth-First Search (DFS) generator. Every play presents a brand-new maze layout!
* **Web Audio Synthesis**: 100% procedural soundscapes synthesized directly on the browser's Web Audio API (AC mains fluorescent humming, low-pass footstep thuds, heartbeat speedups, detuned sawtooth screamer screams). Zero asset delays or CORS blocks!
* **Stalker AI State-Machine**: Creepy dark entity with spider-like limbs and glowing red eyes that wanders, stalks when close, and launches into aggressive sprints upon visual line-of-sight locks.
* **Jumpscare Screamer**: Heart-stopping screamer sequence that forces camera locks, shakes perspective violently, triggers full-screen static noise, and plays audio screeches.

---

## 🛠️ Roblox Rojo Script Suite

Located under the `roblox/` directory, these scripts provide professional-grade systems for Roblox Studio using Rojo:
* **`default.project.json`**: Rojo folder mappings syncing local directories to Roblox services.
* **`MonsterAI.lua`**: Server-side script implementing `PathfindingService` waypoints, raycasted field-of-view overlays, and target pursuit parameters.
* **`FlashlightClient.lua`**: Client-side UserInputService listener for flashlight controls, battery charge drains, and low-power flickers.
* **`HeadBobbing.lua`**: Dynamic client-side camera offset calculations using sine waves relative to humanoid walk speeds.

---

## 📂 Project Structure

```
roblox-backrooms-game/
├── roblox/                           # Roblox developer folder
│   ├── default.project.json          # Rojo sync mappings
│   └── src/
│       ├── server/
│       │   └── MonsterAI.lua         # Roblox pathfinding NPC AI
│       └── client/
│           ├── FlashlightClient.lua  # Flashlight battery drain logic
│           └── HeadBobbing.lua       # Immersive camera sways
│
├── package.json                      # Web project settings
├── index.html                        # VHS camera HUD & layouts
├── index.css                         # CRT curvature & scanlines CSS
├── app.js                            # Main 3D orchestration loop
├── maze.js                           # Procedural 3D map generator
├── player.js                         # First-person PointerLock controls
├── monster.js                        # Procedural stalker mesh & AI
├── audio.js                          # Web Audio procedural sound board
└── README.md                         # Project documentation
```

---

## 🚀 Running the Web Game Locally

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Clone this repository to your computer.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the local development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to the address shown (usually `http://localhost:5173`).
6. Click the screen to capture the mouse lock and **enter the maze**!

---

## ⚡ Syncing to Roblox Studio

If you want to sync the Lua scripts into Roblox Studio:
1. Install [Rojo](https://rojo.space/docs/v7/) (VS Code extension or CLI tool).
2. Open a Roblox project file (`.rbxl`).
3. Run the Rojo server inside the `roblox/` subdirectory:
   ```bash
   cd roblox
   rojo serve
   ```
4. Connect the Rojo plugin in Roblox Studio to start live-syncing the scripts.
