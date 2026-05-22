/* -------------------------------------------------------------
   player.js - First Person Controller & Mechanics
   Manages PointerLock movement controls, AABB collision boxes,
   sprint stamina limits, flashlight batteries, head bobs,
   and floppy disk collecting triggers.
   ------------------------------------------------------------- */

import * as THREE from 'three';
import { AudioSys } from './audio.js';

export class PlayerController {
  constructor(camera, maze) {
    this.camera = camera;
    this.maze = maze;
    
    // Player body dimensions
    this.height = 1.7;
    this.radius = 0.5;
    this.position = new THREE.Vector3(6, this.height, 6); // Starts at center of cell (1,1)
    
    // Camera setup
    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0);
    
    // Movement attributes
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;
    
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    
    // Stamina System
    this.stamina = 100;
    this.maxStamina = 100;
    this.staminaDepletionRate = 22; // Stamina drain per second sprinting
    this.staminaRecoveryRate = 12; // Stamina recovery per second walking
    
    // Sanity System
    this.sanity = 100;
    this.maxSanity = 100;
    
    // Flashlight System
    this.flashlightOn = true;
    this.battery = 100;
    this.maxBattery = 100;
    this.batteryDepletionRate = 1.5; // Battery drain per second (lasts ~66s)
    this.flashlight = null;
    this.flashlightFlickerTimer = 0;
    
    // Inventory
    this.collectedFuses = 0;
    this.totalFuses = 3;
    
    // Audio trigger timing
    this.footstepTimer = 0;
    this.footstepIntervalWalk = 0.55; // 550ms footstep rhythm
    this.footstepIntervalSprint = 0.35; // 350ms footstep rhythm
    
    // Camera Head Bobbing
    this.bobTimer = 0;
    this.bobFrequencyWalk = 10;
    this.bobFrequencySprint = 15;
    this.bobAmplitudeWalk = 0.05;
    this.bobAmplitudeSprint = 0.1;
    
    // Collision Bounding Box (AABB)
    this.boundingBox = new THREE.Box3();
    this.updateBoundingBox();
    
    // Setup inputs & spotlight
    this.initFlashlight();
    this.setupInputs();
  }

  initFlashlight() {
    // Dynamic flashlight Spotlight casting detailed shadows
    this.flashlight = new THREE.SpotLight(0xfffee5, 4.0, 18.0, Math.PI / 6, 0.45, 1.2);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 512;
    this.flashlight.shadow.mapSize.height = 512;
    this.flashlight.shadow.bias = -0.002;
    this.flashlight.position.copy(this.camera.position);
    this.maze.scene.add(this.flashlight);
    
    // Small ambient sub-light attached to player to view walls up close
    this.subLight = new THREE.PointLight(0xfffee5, 0.35, 3.5);
    this.subLight.position.copy(this.camera.position);
    this.maze.scene.add(this.subLight);
  }

  setupInputs() {
    // Keyboard listeners
    const onKeyDown = (event) => {
      switch (event.code) {
        case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
        case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
        case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
        case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.isSprinting = true; break;
        case 'KeyF': this.toggleFlashlight(); break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
        case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
        case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
        case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse movement rotation handler
    const canvas = document.getElementById('crt-monitor');
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
      AudioSys.init(); // initialize Web Audio on first user interaction
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('game-hud').classList.remove('hidden');
      } else {
        // Unlock pointer: show start menu if not won/lost
        const isGameOver = !document.getElementById('game-over-screen').classList.contains('hidden');
        const isWin = !document.getElementById('win-screen').classList.contains('hidden');
        if (!isGameOver && !isWin) {
          document.getElementById('menu-screen').classList.remove('hidden');
          document.getElementById('game-hud').classList.add('hidden');
        }
      }
    });

    const mouseRotate = (event) => {
      if (document.pointerLockElement !== canvas) return;

      const sensitivity = 0.0022;
      this.camera.rotation.y -= event.movementX * sensitivity;
      
      // Pitch rotation clamped to avoid backflip views
      this.camera.rotation.x -= event.movementY * sensitivity;
      this.camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camera.rotation.x));
    };

    document.addEventListener('mousemove', mouseRotate);
  }

  toggleFlashlight() {
    if (this.battery > 0) {
      this.flashlightOn = !this.flashlightOn;
      const targetIntensity = this.flashlightOn ? 4.0 : 0.0;
      this.flashlight.intensity = targetIntensity;
      this.subLight.intensity = this.flashlightOn ? 0.35 : 0.0;
    }
  }

  updateBoundingBox() {
    this.boundingBox.set(
      new THREE.Vector3(this.position.x - this.radius, 0.1, this.position.z - this.radius),
      new THREE.Vector3(this.position.x + this.radius, this.height, this.position.z + this.radius)
    );
  }

  // Updates player kinematics, bounding collision checks, items collections, flashlight status
  update(timeDelta) {
    const isPointerLocked = document.pointerLockElement !== null;
    if (!isPointerLocked) return;

    // 1. Sanity Calculations
    let sanityChange = 0;
    if (!this.flashlightOn) {
      sanityChange -= 1.6; // dark drains sanity
    } else {
      sanityChange += 0.45; // flashlight ON slowly recovers sanity
    }

    // Standing close to fluorescent ceiling lights recovers sanity
    let nearestLightDist = 999.0;
    this.maze.lightFixtures.forEach(fix => {
      const dist = this.position.distanceTo(new THREE.Vector3(fix.x, this.position.y, fix.z));
      if (dist < nearestLightDist) {
        nearestLightDist = dist;
      }
    });

    if (nearestLightDist < 2.5) {
      sanityChange += 2.8; // Standing under ceiling lights helps stay calm!
    }

    // Apply sanity change, clamped between 0 and 100
    this.sanity = Math.max(0, Math.min(this.maxSanity, this.sanity + sanityChange * timeDelta));

    // 2. Flashlight Battery Drain & Flickers
    if (this.flashlightOn && this.battery > 0) {
      this.battery = Math.max(0, this.battery - this.batteryDepletionRate * timeDelta);
      
      // Dynamic flickers when flashlight is dying
      if (this.battery < 25) {
        this.flashlightFlickerTimer -= timeDelta;
        if (this.flashlightFlickerTimer <= 0) {
          const isFlickerEvent = Math.random() > 0.6;
          if (isFlickerEvent) {
            this.flashlight.intensity = Math.random() * 2.0; // Dim flickers
            this.subLight.intensity = Math.random() * 0.15;
            this.flashlightFlickerTimer = 0.04 + Math.random() * 0.12;
          } else {
            this.flashlight.intensity = 4.0;
            this.subLight.intensity = 0.35;
            this.flashlightFlickerTimer = 0.2 + Math.random() * 1.5;
          }
        }
      }
      
      if (this.battery === 0) {
        this.flashlightOn = false;
        this.flashlight.intensity = 0;
        this.subLight.intensity = 0;
      }
    }

    // 2. Sprint Stamina calculation
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    const canSprint = this.isSprinting && isMoving && this.stamina > 5;
    
    let activeSpeed = 3.2; // Walk: 3.2 m/s
    if (canSprint) {
      activeSpeed = 5.8; // Sprint: 5.8 m/s
      this.stamina = Math.max(0, this.stamina - this.staminaDepletionRate * timeDelta);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRecoveryRate * timeDelta);
    }

    // 3. Movement Physics and Direction calculation
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    // Align moving vector relative to player's rotation
    const rotationY = this.camera.rotation.y;
    const moveVector = new THREE.Vector3();
    
    if (isMoving) {
      const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      const sideVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      
      moveVector.addScaledVector(forwardVec, this.direction.z);
      moveVector.addScaledVector(sideVec, this.direction.x);
      moveVector.normalize();
    }

    // 4. Bounding Box AABB Collision Solving
    const stepX = moveVector.x * activeSpeed * timeDelta;
    const stepZ = moveVector.z * activeSpeed * timeDelta;

    // Test X-Axis Movement
    this.position.x += stepX;
    this.updateBoundingBox();
    if (this.maze.checkCollision(this.boundingBox)) {
      this.position.x -= stepX; // rollback
    }

    // Test Z-Axis Movement
    this.position.z += stepZ;
    this.updateBoundingBox();
    if (this.maze.checkCollision(this.boundingBox)) {
      this.position.z -= stepZ; // rollback
    }

    this.updateBoundingBox();

    // 5. Head Bobbing camera shifts (Sine wave)
    if (isMoving) {
      const freq = canSprint ? this.bobFrequencySprint : this.bobFrequencyWalk;
      const amp = canSprint ? this.bobAmplitudeSprint : this.bobAmplitudeWalk;
      
      this.bobTimer += timeDelta * freq;
      const bobY = Math.sin(this.bobTimer) * amp;
      const bobX = Math.cos(this.bobTimer * 0.5) * amp * 0.5;
      
      this.camera.position.set(this.position.x + bobX, this.position.y + bobY, this.position.z);

      // Play Footstep Audio thuds rithmically
      this.footstepTimer -= timeDelta;
      if (this.footstepTimer <= 0) {
        AudioSys.playFootstep(canSprint);
        this.footstepTimer = canSprint ? this.footstepIntervalSprint : this.footstepIntervalWalk;
      }
    } else {
      // Return camera smoothly to standing height when idle
      this.camera.position.set(this.position.x, this.position.y, this.position.z);
      this.footstepTimer = 0;
    }

    // Attach flashlight & sublight securely to camera position & projection vectors
    this.flashlight.position.copy(this.camera.position);
    this.subLight.position.copy(this.camera.position);
    
    // Make flashlight point in camera's direction
    const targetPosition = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    targetPosition.add(this.camera.position);
    this.flashlight.target.position.copy(targetPosition);
    this.flashlight.target.updateMatrixWorld();

    // 6. Check inventory floppy disk overlaps (Collectibles)
    this.checkFuseCollections();

    // 7. Sync HUD meters to HTML bars
    this.syncHUD();
  }

  // Intersects player bounding box with fuses
  checkFuseCollections() {
    this.maze.fuses.forEach(fuse => {
      if (!fuse.collected && this.boundingBox.intersectsBox(fuse.boundingBox)) {
        fuse.collected = true;
        fuse.mesh.visible = false;
        fuse.light.visible = false;
        
        this.collectedFuses++;
        AudioSys.playPickup();
        
        // Update Objective
        document.getElementById('fuse-counter').textContent = `${this.collectedFuses} / ${this.totalFuses}`;
      }
    });
  }

  syncHUD() {
    // Fill values
    document.getElementById('stamina-fill').style.width = `${this.stamina}%`;
    document.getElementById('battery-fill').style.width = `${this.battery}%`;
    document.getElementById('sanity-fill').style.width = `${this.sanity}%`;

    // High quality colors for low levels
    const staminaFill = document.getElementById('stamina-fill');
    if (this.stamina < 20) {
      staminaFill.style.backgroundColor = 'var(--color-hud-red)';
      staminaFill.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.6)';
    } else if (this.stamina < 50) {
      staminaFill.style.backgroundColor = 'var(--color-hud-yellow)';
      staminaFill.style.boxShadow = '0 0 6px rgba(234, 179, 8, 0.6)';
    } else {
      staminaFill.style.backgroundColor = 'var(--color-hud-cyan)';
      staminaFill.style.boxShadow = '0 0 6px rgba(6, 182, 212, 0.6)';
    }

    const batteryFill = document.getElementById('battery-fill');
    if (this.battery < 20) {
      batteryFill.style.backgroundColor = 'var(--color-hud-red)';
      batteryFill.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.6)';
    } else if (this.battery < 50) {
      batteryFill.style.backgroundColor = 'var(--color-hud-yellow)';
      batteryFill.style.boxShadow = '0 0 6px rgba(234, 179, 8, 0.6)';
    } else {
      batteryFill.style.backgroundColor = 'var(--color-hud-green)';
      batteryFill.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.6)';
    }

    const sanityFill = document.getElementById('sanity-fill');
    if (this.sanity < 20) {
      sanityFill.style.backgroundColor = 'var(--color-hud-red)';
      sanityFill.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.6)';
    } else if (this.sanity < 50) {
      sanityFill.style.backgroundColor = 'var(--color-hud-yellow)';
      sanityFill.style.boxShadow = '0 0 6px rgba(234, 179, 8, 0.6)';
    } else {
      sanityFill.style.backgroundColor = '#a855f7'; // Purple sanity
      sanityFill.style.boxShadow = '0 0 6px rgba(168, 85, 247, 0.6)';
    }

    // Toggle HUD blinking alerts
    const alertBatt = document.getElementById('alert-batt');
    if (this.battery < 20) {
      alertBatt.classList.remove('hidden');
    } else {
      alertBatt.classList.add('hidden');
    }

    const alertSanity = document.getElementById('alert-sanity');
    if (this.sanity < 20) {
      alertSanity.classList.remove('hidden');
    } else {
      alertSanity.classList.add('hidden');
    }
  }

  reset() {
    this.position.set(6, this.height, 6);
    this.stamina = 100;
    this.battery = 100;
    this.sanity = 100;
    this.collectedFuses = 0;
    this.flashlightOn = true;
    this.flashlight.intensity = 4.0;
    this.subLight.intensity = 0.35;
    document.getElementById('fuse-counter').textContent = `0 / ${this.totalFuses}`;
  }
}
