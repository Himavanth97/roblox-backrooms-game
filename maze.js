/* -------------------------------------------------------------
   maze.js - Procedural 3D Backrooms Grid Generator
   Generates a fully connected maze layout using Depth-First Search
   and renders high-fidelity textures (damp yellow carpet, molding wallpaper,
   fluorescent light grids) synthesized dynamically on HTML5 Canvas.
   ------------------------------------------------------------- */

import * as THREE from 'three';

export class MazeEngine {
  constructor(scene, size = 12) {
    this.scene = scene;
    this.size = size;
    this.cellSize = 6.0; // 6 meters per cell
    this.wallHeight = 4.0; // 4 meters high
    this.grid = [];
    
    // Arrays for collision and lighting
    this.walls = [];
    this.fuses = [];
    this.lightFixtures = [];
    
    // Procedural Textures
    this.carpetTexture = null;
    this.wallpaperTexture = null;
    this.ceilingTexture = null;
    
    // Exit hatch
    this.exitPortal = null;
    this.exitPosition = new THREE.Vector3();
    
    this.generateGrid();
    this.synthesizeTextures();
    this.buildMaze();
  }

  // Generates a fully connected 2D grid using Depth-First Search
  generateGrid() {
    // Initialize grid with all walls (1)
    for (let x = 0; x < this.size; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.size; y++) {
        this.grid[x][y] = 1; // 1 = Wall, 0 = Empty Passage
      }
    }

    const stack = [];
    // Start cell (ensure inside borders)
    const startX = 1;
    const startY = 1;
    this.grid[startX][startY] = 0;
    stack.push({ x: startX, y: startY });

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = [];

      // Look for unvisited neighbors with 2 cells distance (to keep wall thickness)
      const directions = [
        { dx: 2, dy: 0 },
        { dx: -2, dy: 0 },
        { dx: 0, dy: 2 },
        { dx: 0, dy: -2 }
      ];

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        if (nx > 0 && nx < this.size - 1 && ny > 0 && ny < this.size - 1) {
          if (this.grid[nx][ny] === 1) {
            neighbors.push({ x: nx, y: ny, dx: dir.dx, dy: dir.dy });
          }
        }
      }

      if (neighbors.length > 0) {
        // Pick random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        
        // Break down wall between current and neighbor
        this.grid[current.x + next.dx / 2][current.y + next.dy / 2] = 0;
        this.grid[next.x][next.y] = 0;
        
        stack.push({ x: next.x, y: next.y });
      } else {
        stack.pop();
      }
    }

    // Punch some random holes to make it a more organic office maze (cycles)
    for (let i = 0; i < this.size * 2; i++) {
      const rx = Math.floor(Math.random() * (this.size - 2)) + 1;
      const ry = Math.floor(Math.random() * (this.size - 2)) + 1;
      if (this.grid[rx][ry] === 1) {
        // Check if removing it connects passage cells
        this.grid[rx][ry] = 0;
      }
    }

    // Keep entry cell clear
    this.grid[1][1] = 0;
  }

  // Synthesizes high-end visual textures directly on 2D Canvases
  // This guarantees zero-latency asset load and allows custom procedural weathering!
  synthesizeTextures() {
    // 1. CARPET TEXTURE: Wet, dirty, organic yellow-brownish carpet
    const carpetCanvas = document.createElement('canvas');
    carpetCanvas.width = 512;
    carpetCanvas.height = 512;
    const carpetCtx = carpetCanvas.getContext('2d');
    
    carpetCtx.fillStyle = '#bfa56a'; // Damp mustard base
    carpetCtx.fillRect(0, 0, 512, 512);

    // Weathering/water spots (dirt maps)
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = 20 + Math.random() * 60;
      
      const grad = carpetCtx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, 'rgba(84, 69, 39, 0.45)'); // Dirty dark wet center
      grad.addColorStop(0.5, 'rgba(120, 102, 60, 0.2)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      carpetCtx.fillStyle = grad;
      carpetCtx.beginPath();
      carpetCtx.arc(x, y, radius, 0, Math.PI * 2);
      carpetCtx.fill();
    }

    // Micro-texture noise fibers
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const c = 120 + Math.floor(Math.random() * 60);
      carpetCtx.fillStyle = `rgba(${c - 20}, ${c}, ${c - 40}, 0.25)`;
      carpetCtx.fillRect(x, y, 1, 1);
    }
    
    this.carpetTexture = new THREE.CanvasTexture(carpetCanvas);
    this.carpetTexture.wrapS = THREE.RepeatWrapping;
    this.carpetTexture.wrapT = THREE.RepeatWrapping;
    this.carpetTexture.repeat.set(2, 2);

    // 2. WALLPAPER TEXTURE: Classic mono-yellow wallpaper with molding/stripes
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wallCtx = wallCanvas.getContext('2d');

    wallCtx.fillStyle = '#dbb972'; // Wallpaper light base
    wallCtx.fillRect(0, 0, 512, 512);

    // Dynamic stripes
    wallCtx.fillStyle = '#c5a25b';
    for (let i = 0; i < 512; i += 32) {
      wallCtx.fillRect(i, 0, 4, 512);
    }

    // Damp moisture/grunge mold rising from the floor (bottom 120px)
    const moldGrad = wallCtx.createLinearGradient(0, 512, 0, 320);
    moldGrad.addColorStop(0, 'rgba(44, 39, 29, 0.7)'); // very dark dirt
    moldGrad.addColorStop(0.3, 'rgba(74, 65, 47, 0.45)');
    moldGrad.addColorStop(1, 'rgba(0,0,0,0)');

    wallCtx.fillStyle = moldGrad;
    wallCtx.fillRect(0, 300, 512, 212);

    // Add wooden wall molding/skirting boards at the absolute bottom
    wallCtx.fillStyle = '#6b5133'; // Brown molding
    wallCtx.fillRect(0, 492, 512, 20);
    wallCtx.fillStyle = '#3a2b1b'; // Dark edge shadow
    wallCtx.fillRect(0, 492, 512, 3);
    wallCtx.fillStyle = '#8f6e4a'; // Top shine
    wallCtx.fillRect(0, 495, 512, 2);

    this.wallpaperTexture = new THREE.CanvasTexture(wallCanvas);
    this.wallpaperTexture.wrapS = THREE.RepeatWrapping;
    this.wallpaperTexture.wrapT = THREE.RepeatWrapping;

    // 3. CEILING PANELS: Standard white acoustical grid tiles
    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 256;
    ceilingCanvas.height = 256;
    const ceilingCtx = ceilingCanvas.getContext('2d');

    ceilingCtx.fillStyle = '#ded9cf'; // Dirty white acoustic ceiling
    ceilingCtx.fillRect(0, 0, 256, 256);

    // Grid lines
    ceilingCtx.fillStyle = '#6b675e';
    ceilingCtx.fillRect(0, 0, 256, 4);
    ceilingCtx.fillRect(0, 0, 4, 256);
    ceilingCtx.fillRect(0, 252, 256, 4);
    ceilingCtx.fillRect(252, 0, 4, 256);

    // Acoustic panel spray spots
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 0.5 + Math.random() * 1.5;
      ceilingCtx.fillStyle = 'rgba(84, 80, 72, 0.4)';
      ceilingCtx.beginPath();
      ceilingCtx.arc(x, y, r, 0, Math.PI * 2);
      ceilingCtx.fill();
    }

    this.ceilingTexture = new THREE.CanvasTexture(ceilingCanvas);
    this.ceilingTexture.wrapS = THREE.RepeatWrapping;
    this.ceilingTexture.wrapT = THREE.RepeatWrapping;
    this.ceilingTexture.repeat.set(1, 1);
  }

  // Renders the 3D grid layout inside Three.js
  buildMaze() {
    // Materials
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: this.carpetTexture,
      roughness: 0.85,
      metalness: 0.05
    });

    const wallMaterial = new THREE.MeshStandardMaterial({
      map: this.wallpaperTexture,
      roughness: 0.75,
      metalness: 0.02
    });

    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: this.ceilingTexture,
      roughness: 0.9,
      metalness: 0.05
    });

    // Geometries
    const floorGeo = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
    const ceilingGeo = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
    const wallGeo = new THREE.BoxGeometry(this.cellSize, this.wallHeight, 0.3); // Box walls avoid render leaks

    const halfCell = this.cellSize / 2;

    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const posX = x * this.cellSize;
        const posZ = y * this.cellSize;

        if (this.grid[x][y] === 0) {
          // Passage Cell: Render Floor & Ceiling
          
          // Floor
          const floorMesh = new THREE.Mesh(floorGeo, floorMaterial);
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.set(posX, 0, posZ);
          floorMesh.receiveShadow = true;
          this.scene.add(floorMesh);

          // Ceiling
          const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMaterial);
          ceilingMesh.rotation.x = Math.PI / 2;
          ceilingMesh.position.set(posX, this.wallHeight, posZ);
          ceilingMesh.receiveShadow = true;
          this.scene.add(ceilingMesh);

          // Spawn office fluorescent flickering ceiling light (30% chance per tile)
          if ((x + y) % 3 === 0 && (x !== 1 || y !== 1)) {
            this.createCeilingLight(posX, posZ);
          }
        } else {
          // Wall Cell: Render 3D box wall blocks
          const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
          wallMesh.position.set(posX, this.wallHeight / 2, posZ);
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          this.scene.add(wallMesh);
          
          // Store in walls array for dynamic bounding box collision handling
          this.walls.push(new THREE.Box3().setFromObject(wallMesh));
        }
      }
    }

    // Add perimeter boundaries to block mapping glitches
    this.addBoundaries();

    // Spawn 3 Fuses/Data floppy disks randomly
    this.spawnFuses();

    // Spawn Exit Portal
    this.spawnExitPortal();
  }

  // Adds external blocking boxes around the grid
  addBoundaries() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: this.wallpaperTexture,
      roughness: 0.75
    });
    
    const sizeOffset = this.cellSize;
    const perimeterSize = this.size * this.cellSize;
    const boundaryGeoX = new THREE.BoxGeometry(perimeterSize + sizeOffset * 2, this.wallHeight, 1.0);
    const boundaryGeoZ = new THREE.BoxGeometry(1.0, this.wallHeight, perimeterSize + sizeOffset * 2);

    const wallOffset = -this.cellSize / 2;
    const outerBorder = this.size * this.cellSize - halfCell;
    const halfCell = this.cellSize / 2;

    const b1 = new THREE.Mesh(boundaryGeoX, wallMaterial);
    b1.position.set(perimeterSize / 2 - halfCell, this.wallHeight / 2, -this.cellSize);
    this.scene.add(b1);
    this.walls.push(new THREE.Box3().setFromObject(b1));

    const b2 = new THREE.Mesh(boundaryGeoX, wallMaterial);
    b2.position.set(perimeterSize / 2 - halfCell, this.wallHeight / 2, perimeterSize);
    this.scene.add(b2);
    this.walls.push(new THREE.Box3().setFromObject(b2));

    const b3 = new THREE.Mesh(boundaryGeoZ, wallMaterial);
    b3.position.set(-this.cellSize, this.wallHeight / 2, perimeterSize / 2 - halfCell);
    this.scene.add(b3);
    this.walls.push(new THREE.Box3().setFromObject(b3));

    const b4 = new THREE.Mesh(boundaryGeoZ, wallMaterial);
    b4.position.set(perimeterSize, this.wallHeight / 2, perimeterSize / 2 - halfCell);
    this.scene.add(b4);
    this.walls.push(new THREE.Box3().setFromObject(b4));
  }

  // Renders a recessed office fluorescent grid light
  createCeilingLight(x, z) {
    // Metal fixture housing
    const fixtureGeo = new THREE.BoxGeometry(2.0, 0.1, 1.0);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.set(x, this.wallHeight - 0.05, z);
    this.scene.add(fixture);

    // Glowing tube mesh
    const bulbGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8);
    bulbGeo.rotateZ(Math.PI / 2);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffebb }); // warm fluorescent tone
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, this.wallHeight - 0.1, z);
    this.scene.add(bulb);

    // PointLight that casts soft shadows in the maze
    const light = new THREE.PointLight(0xfffdbb, 1.3, 14.0, 1.8); // warm light, distance 14m
    light.position.set(x, this.wallHeight - 0.3, z);
    light.castShadow = true;
    light.shadow.mapSize.width = 256;
    light.shadow.mapSize.height = 256;
    light.shadow.bias = -0.005;
    this.scene.add(light);

    this.lightFixtures.push({
      light: light,
      mesh: bulb,
      originalIntensity: 1.3,
      flickerTimer: 0,
      flickerState: true,
      x: x,
      z: z
    });
  }

  // Places exactly 3 data disks in dead-end passages of the maze
  spawnFuses() {
    const emptyCells = [];
    for (let x = 1; x < this.size - 1; x++) {
      for (let y = 1; y < this.size - 1; y++) {
        if (this.grid[x][y] === 0 && (x !== 1 || y !== 1)) {
          // Check if dead end (surrounded by 3 walls)
          let wallCount = 0;
          if (this.grid[x+1][y] === 1) wallCount++;
          if (this.grid[x-1][y] === 1) wallCount++;
          if (this.grid[x][y+1] === 1) wallCount++;
          if (this.grid[x][y-1] === 1) wallCount++;
          
          emptyCells.push({ x: x * this.cellSize, z: y * this.cellSize, deadEnd: wallCount >= 3 });
        }
      }
    }

    // Sort to prioritize dead-ends for item placement
    emptyCells.sort((a, b) => (b.deadEnd ? 1 : 0) - (a.deadEnd ? 1 : 0));

    // Spawn 3 disks
    const fuseGeo = new THREE.BoxGeometry(0.3, 0.05, 0.3); // Floppy disk size
    const labelGeo = new THREE.BoxGeometry(0.2, 0.051, 0.15);
    const diskMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.1 }); // Yellow floppy
    const labelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < 3; i++) {
      if (emptyCells[i]) {
        const group = new THREE.Group();
        const disk = new THREE.Mesh(fuseGeo, diskMat);
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0, 0, 0.04);
        
        group.add(disk);
        group.add(label);

        // Spin and float on a small pedastal base
        const pedestalGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8);
        const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6 });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.set(0, -0.6, 0);
        group.add(pedestal);

        // Glowing point light ring around item
        const ringGeo = new THREE.RingGeometry(0.25, 0.3, 16);
        ringGeo.rotateX(-Math.PI/2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(0, 0.02, 0);
        group.add(ring);

        const pointLight = new THREE.PointLight(0xeab308, 0.8, 4.0);
        pointLight.position.set(0, 0.2, 0);
        group.add(pointLight);

        // Position group
        const targetX = emptyCells[i].x;
        const targetZ = emptyCells[i].z;
        group.position.set(targetX, 0.9, targetZ);
        this.scene.add(group);

        this.fuses.push({
          mesh: group,
          light: pointLight,
          collected: false,
          boundingBox: new THREE.Box3().setFromObject(disk),
          x: targetX,
          z: targetZ
        });
      }
    }
  }

  // Spawns the green glowing escape door/hatch in the furthest cell
  spawnExitPortal() {
    // Find passage cell furthest from start (1,1)
    let maxDist = 0;
    let exitX = 1;
    let exitY = 1;

    for (let x = 1; x < this.size - 1; x++) {
      for (let y = 1; y < this.size - 1; y++) {
        if (this.grid[x][y] === 0) {
          const dist = Math.pow(x - 1, 2) + Math.pow(y - 1, 2);
          if (dist > maxDist) {
            maxDist = dist;
            exitX = x;
            exitY = y;
          }
        }
      }
    }

    const posX = exitX * this.cellSize;
    const posZ = exitY * this.cellSize;
    this.exitPosition.set(posX, 0, posZ);

    const portalGroup = new THREE.Group();

    // Portal glowing frame structure
    const frameGeo = new THREE.BoxGeometry(0.4, 2.8, 1.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    portalGroup.add(frame);

    // Glowing green surface
    const glowGeo = new THREE.PlaneGeometry(1.6, 2.6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(0.21, 0, 0);
    glowMesh.rotation.y = Math.PI / 2;
    portalGroup.add(glowMesh);

    // EXIT Sign
    const signGeo = new THREE.BoxGeometry(0.2, 0.4, 0.8);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.6, 0);
    portalGroup.add(sign);

    const exitLight = new THREE.PointLight(0x22c55e, 2.5, 8.0);
    exitLight.position.set(0.4, 0, 0);
    portalGroup.add(exitLight);

    portalGroup.position.set(posX, 1.4, posZ);
    this.scene.add(portalGroup);

    this.exitPortal = portalGroup;
    this.exitPortal.boundingBox = new THREE.Box3().setFromObject(frame);
  }

  // Updates fluorescent light flickering behaviors
  update(timeDelta) {
    // 1. Update spinning of Fuses/disks
    this.fuses.forEach(fuse => {
      if (!fuse.collected) {
        fuse.mesh.rotation.y += 1.5 * timeDelta;
        // Floating up and down sine effect
        fuse.mesh.position.y = 0.9 + Math.sin(THREE.MathUtils.clamp(Date.now() * 0.003, 0, 100000000)) * 0.08;
        // Update bounding box position
        fuse.boundingBox.setFromObject(fuse.mesh.children[0]);
      }
    });

    // 2. Fluorescent light dynamic flickers
    this.lightFixtures.forEach(fixture => {
      fixture.flickerTimer -= timeDelta;
      if (fixture.flickerTimer <= 0) {
        // Decide next flicker event
        const isFlickering = Math.random() > 0.85; // 15% flicker chance
        if (isFlickering) {
          fixture.flickerState = !fixture.flickerState;
          
          if (!fixture.flickerState) {
            fixture.light.intensity = 0.1;
            fixture.mesh.material.color.setHex(0x444433); // Dim color
            fixture.flickerTimer = 0.05 + Math.random() * 0.2; // short dim duration
          } else {
            fixture.light.intensity = fixture.originalIntensity;
            fixture.mesh.material.color.setHex(0xfffebb); // bright tube
            fixture.flickerTimer = 0.8 + Math.random() * 5.0; // long lit duration
          }
        } else {
          // Standard humming glow state
          fixture.light.intensity = fixture.originalIntensity + (Math.random() - 0.5) * 0.1;
          fixture.mesh.material.color.setHex(0xfffebb);
          fixture.flickerTimer = 0.1;
        }
      }
    });
  }

  // Checks collision of player boundary box against all maze walls
  checkCollision(playerBox) {
    for (const wallBox of this.walls) {
      if (playerBox.intersectsBox(wallBox)) {
        return true;
      }
    }
    return false;
  }
}
