/* -------------------------------------------------------------
   monster.js - Procedural Stalker AI & Jumpscare Engine
   Renders a scary, skeletal multi-limbed creature with glowing red eyes,
   implements a pathfinding stalker AI, tracks line-of-sight raycasts,
   and orchestrates the jumpscare game-over sequences.
   ------------------------------------------------------------- */

import * as THREE from 'three';
import { AudioSys } from './audio.js';

export class MonsterController {
  constructor(scene, maze, player) {
    this.scene = scene;
    this.maze = maze;
    this.player = player;
    
    // Position: spawn in furthest diagonal cell (opposite corner to player start)
    const spawnIndex = this.maze.size - 2;
    this.position = new THREE.Vector3(spawnIndex * this.maze.cellSize, 0, spawnIndex * this.maze.cellSize);
    
    // AI States
    this.state = 'WANDER'; // WANDER, STALK, CHASE, JUMPSCARE
    this.speed = 2.0; // Wander speed
    this.wanderTarget = new THREE.Vector3();
    this.setNewWanderTarget();

    // Visual Mesh Group
    this.meshGroup = new THREE.Group();
    this.buildMonsterMesh();
    this.scene.add(this.meshGroup);
    
    // Bounding Box
    this.boundingBox = new THREE.Box3();
    this.updateBoundingBox();
    
    // Dynamic sound timings
    this.heartbeatTimer = 0;
    this.soundTimer = 0;
  }

  // Procedural construction of a terrifying, wiry bacteria-like monster (limbs, glowing eyes)
  buildMonsterMesh() {
    const charcoalMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.9,
      metalness: 0.1
    });

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // bright glowing red

    // Torso: tall, thin, distorted cylinder
    const torsoGeo = new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6);
    const torso = new THREE.Mesh(torsoGeo, charcoalMat);
    torso.position.set(0, 1.1, 0);
    this.meshGroup.add(torso);

    // Head: deformed wire sphere
    const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const head = new THREE.Mesh(headGeo, charcoalMat);
    head.position.set(0, 2.3, 0);
    this.meshGroup.add(head);

    // Glowing Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.12, 2.34, 0.22);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.12, 2.34, 0.22);
    this.meshGroup.add(leftEye);
    this.meshGroup.add(rightEye);

    // Dynamic point light for eyes reflecting off walls
    this.eyeLight = new THREE.PointLight(0xef4444, 0.5, 3.0);
    this.eyeLight.position.set(0, 2.3, 0.3);
    this.meshGroup.add(this.eyeLight);

    // Spooky wire limbs extending out
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 });
    
    // Add 4 spider-like dynamic wire limbs
    for (let i = 0; i < 4; i++) {
      const armGroup = new THREE.Group();
      
      // Upper arm
      const upperGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
      const upper = new THREE.Mesh(upperGeo, limbMat);
      upper.position.set(0, -0.5, 0);
      armGroup.add(upper);
      
      // Lower arm
      const lowerGeo = new THREE.BoxGeometry(0.05, 1.4, 0.05);
      const lower = new THREE.Mesh(lowerGeo, limbMat);
      lower.position.set(0, -1.7, 0.2);
      lower.rotation.x = 0.5; // bent
      armGroup.add(lower);

      // Positioning on torso
      armGroup.position.set(i % 2 === 0 ? 0.2 : -0.2, 1.8 - (i * 0.4), 0);
      armGroup.rotation.z = i % 2 === 0 ? 0.35 + (i * 0.1) : -0.35 - (i * 0.1);
      armGroup.rotation.x = (i - 1.5) * 0.4;
      
      this.meshGroup.add(armGroup);
    }

    this.meshGroup.position.copy(this.position);
    this.meshGroup.castShadow = true;
  }

  updateBoundingBox() {
    // Large collision boundary
    this.boundingBox.set(
      new THREE.Vector3(this.position.x - 0.7, 0.1, this.position.z - 0.7),
      new THREE.Vector3(this.position.x + 0.7, 2.5, this.position.z + 0.7)
    );
  }

  setNewWanderTarget() {
    const validCells = [];
    for (let x = 1; x < this.maze.size - 1; x++) {
      for (let y = 1; y < this.maze.size - 1; y++) {
        if (this.maze.grid[x][y] === 0) {
          validCells.push({ x: x * this.maze.cellSize, z: y * this.maze.cellSize });
        }
      }
    }
    
    if (validCells.length > 0) {
      const cell = validCells[Math.floor(Math.random() * validCells.length)];
      this.wanderTarget.set(cell.x, 0, cell.z);
    }
  }

  // Raycast to check if player is directly in line of sight (no wall block)
  checkLineOfSight() {
    const origin = new THREE.Vector3(this.position.x, 1.5, this.position.z);
    const target = new THREE.Vector3(this.player.position.x, 1.5, this.player.position.z);
    const dir = new THREE.Vector3().subVectors(target, origin);
    const distance = dir.length();
    dir.normalize();

    // Check if within sensory distance
    if (distance > 22.0) return false;

    // Use raycasting
    const raycaster = new THREE.Raycaster(origin, dir, 0.1, distance);
    
    // Map bounding boxes to meshes for Raycaster intersection checks
    const wallMeshes = [];
    this.maze.scene.traverse((node) => {
      if (node instanceof THREE.Mesh && node.geometry instanceof THREE.BoxGeometry && node.geometry.parameters.height === this.maze.wallHeight) {
        wallMeshes.push(node);
      }
    });

    const intersections = raycaster.intersectObjects(wallMeshes);
    
    // If no walls intersect the ray, there is a clean line of sight!
    return intersections.length === 0;
  }

  // Stalker State-Machine Updates
  update(timeDelta, gameInstance) {
    if (this.state === 'JUMPSCARE') {
      this.animateJumpscare(timeDelta);
      return;
    }

    const distToPlayer = this.position.distanceTo(this.player.position);

    // 1. Dynamic Heartbeat Thump Sound
    // Heartbeats speed up as creature gets closer, warning players
    if (distToPlayer < 24.0) {
      this.heartbeatTimer -= timeDelta;
      if (this.heartbeatTimer <= 0) {
        const intensity = 1.0 - Math.min(distToPlayer / 24.0, 1.0);
        AudioSys.playHeartbeat(intensity);
        
        // Timer speed based on closeness (every 1.4s far away, down to 0.4s very close)
        this.heartbeatTimer = 0.35 + (distToPlayer / 24.0) * 1.05;
      }
    }

    // 2. AI State Transitions
    const hasSight = this.checkLineOfSight();
    
    if (hasSight && distToPlayer < 12.0) {
      this.state = 'CHASE';
    } else if (distToPlayer < 18.0) {
      this.state = 'STALK';
    } else {
      this.state = 'WANDER';
    }

    // Loud player sprints pull monster focus immediately
    if (this.player.isSprinting && distToPlayer < 16.0) {
      this.state = 'CHASE';
    }

    // 2b. Drain player sanity based on monster proximity and state
    let monsterSanityDrain = 0;
    if (this.state === 'CHASE') {
      monsterSanityDrain = 15.0; // Rapid drain in chase
    } else if (this.state === 'STALK') {
      monsterSanityDrain = 5.0;  // Creepy drain in stalking
    } else if (distToPlayer < 15.0) {
      monsterSanityDrain = (15.0 - distToPlayer) * 0.4; // Proximity drain even in wander
    }

    if (monsterSanityDrain > 0) {
      this.player.sanity = Math.max(0, this.player.sanity - monsterSanityDrain * timeDelta);
    }

    // 3. Move along active state paths
    let target = new THREE.Vector3();
    
    if (this.state === 'CHASE') {
      this.speed = 5.2; // Fast run speed
      this.eyeLight.color.setHex(0xff0000);
      this.eyeLight.intensity = 1.8;
      target.copy(this.player.position);
      
      // Heartrate indicator overlay pulse
      document.getElementById('static-overlay').style.opacity = '0.14';
    } else if (this.state === 'STALK') {
      this.speed = 2.6; // Creepy walk
      this.eyeLight.color.setHex(0xef4444);
      this.eyeLight.intensity = 0.7;
      target.copy(this.player.position);
      
      document.getElementById('static-overlay').style.opacity = '0.07';
    } else {
      // WANDER
      this.speed = 1.5;
      this.eyeLight.color.setHex(0x9a0303);
      this.eyeLight.intensity = 0.3;
      target.copy(this.wanderTarget);
      
      // If reached wander cell, choose new wander path
      if (this.position.distanceTo(this.wanderTarget) < 1.0) {
        this.setNewWanderTarget();
      }
      
      document.getElementById('static-overlay').style.opacity = '0.06';
    }

    // 4. Kinematics & collision bounds solving
    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0; // lock height
    dir.normalize();

    // Look in direction of movement
    if (dir.lengthSq() > 0) {
      const angle = Math.atan2(dir.x, dir.z);
      this.meshGroup.rotation.y = angle;
    }

    // Creepy wire limbs walking animation (slight wiggle)
    const legSwing = Math.sin(Date.now() * 0.009 * this.speed) * 0.22;
    for (let i = 2; i < 6; i++) {
      if (this.meshGroup.children[i]) {
        this.meshGroup.children[i].rotation.x = (i % 2 === 0 ? legSwing : -legSwing) + (i - 3) * 0.2;
      }
    }

    // Step calculations
    this.position.addScaledVector(dir, this.speed * timeDelta);
    this.meshGroup.position.copy(this.position);
    this.updateBoundingBox();

    // 5. Catch Player Check (Intersect boxes)
    if (distToPlayer <= 1.25) {
      this.triggerJumpscare(gameInstance);
    }
  }

  triggerJumpscare(gameInstance) {
    this.state = 'JUMPSCARE';
    gameInstance.isGameOver = true;
    
    // Disable PointerLock & Freeze controls
    document.exitPointerLock();
    
    // Trigger Screamer Static Fuzz
    const staticOverlay = document.getElementById('static-overlay');
    staticOverlay.classList.add('full-noise');
    
    // Play Terrifying synthesized horror scream
    AudioSys.playJumpscare();
    
    // Force player camera to stare straight up at creature head
    this.player.camera.lookAt(new THREE.Vector3(this.position.x, 2.3, this.position.z));
    
    // Shaking head bobbing timer
    this.jumpscareTimer = 0;

    // Transition to Lost Screen after 1.5 seconds
    setTimeout(() => {
      staticOverlay.classList.remove('full-noise');
      document.getElementById('game-hud').classList.add('hidden');
      document.getElementById('game-over-screen').classList.remove('active', 'hidden');
      document.getElementById('game-over-screen').classList.add('active');
    }, 1500);
  }

  animateJumpscare(timeDelta) {
    this.jumpscareTimer += timeDelta;
    
    // Violent camera shake
    const shakeIntensity = 0.35;
    this.player.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    this.player.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    this.player.camera.position.z += (Math.random() - 0.5) * shakeIntensity;

    // Slide creature closer to screen
    const dir = new THREE.Vector3().subVectors(this.player.camera.position, this.position);
    dir.normalize();
    this.position.addScaledVector(dir, 4.0 * timeDelta);
    this.meshGroup.position.copy(this.position);
  }

  reset() {
    this.state = 'WANDER';
    this.speed = 1.5;
    const spawnIndex = this.maze.size - 2;
    this.position.set(spawnIndex * this.maze.cellSize, 0, spawnIndex * this.maze.cellSize);
    this.meshGroup.position.copy(this.position);
    this.setNewWanderTarget();
    this.updateBoundingBox();
  }
}
