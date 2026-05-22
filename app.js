/* -------------------------------------------------------------
   app.js - Main 3D Game Engine & Orchestrator
   Integrates WebGL rendering context loops, responsive sizes,
   sound system controllers, date clocks, HUD updates,
   and round state handlers (Start, Play, Win, Over).
   ------------------------------------------------------------- */

import * as THREE from 'three';
import { MazeEngine } from './maze.js';
import { PlayerController } from './player.js';
import { MonsterController } from './monster.js';
import { AudioSys } from './audio.js';

class GameApp {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Core game states
    this.maze = null;
    this.player = null;
    this.monster = null;
    
    this.isGameOver = false;
    this.isWon = false;
    this.gameStartTime = 0;
    this.elapsedTime = 0;
    this.glitchTimer = 0;
    
    // Frame delta timings
    this.clock = new THREE.Clock();
    
    // UI DOM bindings
    this.setupUI();
    this.initWebGL();
    this.initGameWorld();
    
    // Begin rendering loops
    this.animate();
  }

  initWebGL() {
    // 1. Create Scene
    this.scene = new THREE.Scene();
    
    // Classic Backrooms heavy yellow fog
    this.scene.fog = new THREE.FogExp2(0x1a160c, 0.08); // fog color, density 0.08

    // 2. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
    this.scene.add(this.camera);

    // 3. WebGL Renderer with High-Aesthetic Shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // smooth high-end shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic cinematic exposure
    this.renderer.toneMappingExposure = 1.0;

    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    // Weak pale yellow ambient light to simulate fluorescent bounce glow
    const ambientLight = new THREE.AmbientLight(0x282317, 0.4);
    this.scene.add(ambientLight);

    // Responsive resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initGameWorld() {
    // Generate procedural office maze size 12x12
    this.maze = new MazeEngine(this.scene, 12);
    
    // Load player at cell (1,1)
    this.player = new PlayerController(this.camera, this.maze);
    
    // Load stalker monster opposite diagonal cell
    this.monster = new MonsterController(this.scene, this.maze, this.player);
    
    // Tock current timing clock
    this.updateVHSClock();
    setInterval(() => this.updateVHSClock(), 1000);
  }

  setupUI() {
    // Buttons bindings
    document.getElementById('btn-play').addEventListener('click', () => {
      // Simulate tape insertion loading transition
      document.getElementById('menu-screen').classList.add('hidden');
      document.getElementById('loading-screen').classList.remove('hidden');
      
      // Start ambient generator audio
      AudioSys.init();
      
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('crt-monitor').requestPointerLock();
        this.startGameTimer();
      }, 3000); // 3s cassettes loader
    });

    document.getElementById('btn-controls').addEventListener('click', () => {
      document.getElementById('menu-screen').classList.add('hidden');
      document.getElementById('controls-screen').classList.remove('hidden');
    });

    document.getElementById('btn-controls-back').addEventListener('click', () => {
      document.getElementById('controls-screen').classList.add('hidden');
      document.getElementById('menu-screen').classList.remove('hidden');
    });

    document.getElementById('btn-audio').addEventListener('click', () => {
      const isPlaying = AudioSys.toggle();
      document.getElementById('btn-audio').textContent = `AUDIO: ${isPlaying ? 'ENABLED' : 'DISABLED'}`;
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.resetRound();
    });

    document.getElementById('btn-win-retry').addEventListener('click', () => {
      this.resetRound();
    });
  }

  updateVHSClock() {
    const now = new Date();
    
    // Retro dates padding format
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    
    document.getElementById('vhs-date').textContent = `${month} ${day} ${year}`;

    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('vhs-clock').textContent = `${hrs}:${mins}:${secs}`;
  }

  startGameTimer() {
    this.gameStartTime = Date.now();
    this.isGameOver = false;
    this.isWon = false;
  }

  // Resets round coordinates, inventories, and regenerates a BRAND NEW maze layout dynamically!
  resetRound() {
    // Clear old maze elements from scene
    this.scene.children = this.scene.children.filter(child => {
      if (child instanceof THREE.AmbientLight || child === this.camera) {
        return true;
      }
      this.scene.remove(child);
      return false;
    });

    // Hide Screen overlays
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.add('hidden');

    // Rebuild a newly randomized procedural maze
    this.maze = new MazeEngine(this.scene, 12);
    
    // Reset player position and meters
    this.player.maze = this.maze;
    this.player.reset();
    
    // Reset stalker position
    this.monster.maze = this.maze;
    this.monster.player = this.player;
    this.monster.reset();
    this.scene.add(this.monster.meshGroup);

    // Request pointer lock to immediately restart gameplay
    document.getElementById('crt-monitor').requestPointerLock();
    this.startGameTimer();
  }

  // Triggers winning game screens upon exit hatch contact
  triggerWin() {
    this.isWon = true;
    document.exitPointerLock();
    
    // Math stats
    const rawTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const m = Math.floor(rawTime / 60);
    const s = String(rawTime % 60).padStart(2, '0');
    
    // Sanity calculation (depends on how close creature stalked player)
    let sanity = 100 - Math.floor(this.elapsedTime * 0.4);
    sanity = Math.max(12, Math.min(100, sanity));

    document.getElementById('stat-time').textContent = `${m}:${s}`;
    document.getElementById('stat-sanity').textContent = `${sanity}%`;

    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('win-screen').classList.remove('hidden', 'active');
    document.getElementById('win-screen').classList.add('active');
  }

  // Infinite WebGL rendering loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const timeDelta = Math.min(this.clock.getDelta(), 0.1); // clamp delta to avoid extreme lag jumps
    const isPointerLocked = document.pointerLockElement !== null;

    if (isPointerLocked && !this.isGameOver && !this.isWon) {
      this.elapsedTime += timeDelta;

      // 1. Update Player position & controller physics
      this.player.update(timeDelta);

      // Camera Wobble & head sway at low sanity (simulates panic/madness)
      if (this.player.sanity < 50) {
        const sanityDeficit = 100 - this.player.sanity;
        const swayAmount = sanityDeficit * 0.00018; 
        const speed = 0.006 - (this.player.sanity * 0.00004);
        
        // Z-axis head-roll oscillation
        this.camera.rotation.z = Math.sin(Date.now() * speed) * swayAmount * 1.5;
        
        // Subtle positional sways added to camera
        const posSwayX = Math.sin(Date.now() * speed * 0.8) * (sanityDeficit * 0.003);
        const posSwayY = Math.cos(Date.now() * speed * 0.5) * (sanityDeficit * 0.002);
        this.camera.position.x += posSwayX;
        this.camera.position.y += posSwayY;
      } else {
        this.camera.rotation.z = 0; // reset Z-roll
      }

      // Periodic VHS screening glitches (random interval tracking)
      this.glitchTimer += timeDelta;
      if (this.glitchTimer > 5.0 + Math.random() * 8.0) { // triggers every 5-13 seconds
        this.glitchTimer = 0;
        const crt = document.getElementById('crt-monitor');
        if (crt) {
          crt.classList.add('vhs-glitch');
          setTimeout(() => {
            crt.classList.remove('vhs-glitch');
          }, 150 + Math.random() * 200); // lasts 150-350ms
        }
      }

      // 2. Update Maze animations (light flickers, item spins)
      this.maze.update(timeDelta);

      // 3. Update Stalker AI chase dynamics
      this.monster.update(timeDelta, this);

      // 4. Update Light Hum audio panning based on proximity to nearest fixture
      if (AudioSys.isEnabled) {
        let minDistance = 9999.0;
        this.maze.lightFixtures.forEach(fix => {
          const dist = this.player.position.distanceTo(new THREE.Vector3(fix.x, this.player.position.y, fix.z));
          if (dist < minDistance) {
            minDistance = dist;
          }
        });
        
        AudioSys.startLightHum();
        AudioSys.updateLightHumVolume(minDistance);
      }

      // 5. Intersect check with Win Exit Portal Portal
      if (this.player.collectedFuses >= this.player.totalFuses) {
        const exitDist = this.player.position.distanceTo(this.maze.exitPosition);
        if (exitDist < 1.8 && this.player.boundingBox.intersectsBox(this.maze.exitPortal.boundingBox)) {
          this.triggerWin();
        }
      }
    } else if (this.isGameOver && this.monster.state === 'JUMPSCARE') {
      // Keep rendering screamer animation frame updates even with pointer unlocked
      this.monster.update(timeDelta, this);
    }

    // 6. Draw 3D WebGL render frame buffers
    this.renderer.render(this.scene, this.camera);
  }
}

// Fire up the application upon module loading
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
