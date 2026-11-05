import * as THREE from 'three';
import {
  mulberry32, rand, addBox, addCylinder, makeSandTexture, makeWoodTexture,
  makeSignTexture, makePosterTexture, makeSplatTexture, makeShadowTexture,
  makeGlowTexture, cylinderBetween, mergeStaticMeshes,
} from './utils.js';

export function createWorld(scene) {
  const rnd = mulberry32(187314);
  const colliders = [];
  const animated = [];
  const dust = [];
  const scorches = [];
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const sandTex = makeSandTexture();
  const woodTex = makeWoodTexture();
  const posterTex = makePosterTexture();
  const splatTex = makeSplatTexture();
  const shadowTex = makeShadowTexture();
  const glowTex = makeGlowTexture();

  const mat = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex, color: 0xd3a37b, roughness: 0.94, metalness: 0 }),
    darkWood: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x5d3b2a, roughness: 0.94 }),
    trim: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x3f281c, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x4f3023, roughness: 0.95 }),
    roofRed: new THREE.MeshStandardMaterial({ color: 0x713528, roughness: 0.95 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xc8ad82, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x876144, roughness: 1, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x4b4238, roughness: 0.5, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2b1c14, roughness: 0.25, metalness: 0.4 }),
    window: new THREE.MeshStandardMaterial({ color: 0xffc066, emissive: 0xff8628, emissiveIntensity: 1.35, roughness: 0.6 }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xffd18a, emissive: 0xff8e2b, emissiveIntensity: 2.2 }),
    cactus: new THREE.MeshStandardMaterial({ color: 0x526042, roughness: 0.92, flatShading: true }),
    cactusDark: new THREE.MeshStandardMaterial({ color: 0x3a4631, roughness: 0.95, flatShading: true }),
    rock: new THREE.MeshStandardMaterial({ color: 0x8a5c43, roughness: 1, flatShading: true }),
    mesa: new THREE.MeshStandardMaterial({ color: 0x874f3f, roughness: 1, flatShading: true }),
    mesaTop: new THREE.MeshStandardMaterial({ color: 0xa5654a, roughness: 1, flatShading: true }),
    mesaDark: new THREE.MeshStandardMaterial({ color: 0x643a31, roughness: 1, flatShading: true }),
    black: new THREE.MeshStandardMaterial({ color: 0x201510, roughness: 0.9 }),
    hide: new THREE.MeshStandardMaterial({ color: 0x9a6a44, roughness: 0.9 }),
  };

  // ---------------------------------------------------------------- Sky
  const sunDir = new THREE.Vector3(-0.48, 0.29, -0.82).normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 36, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color('#1b3652') },
        midColor: { value: new THREE.Color('#91606a') },
        horizonColor: { value: new THREE.Color('#f0b173') },
        lowColor: { value: new THREE.Color('#73453a') },
        sunColor: { value: new THREE.Color('#ffd79a') },
        sunDir: { value: sunDir },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = normalize(world.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor, midColor, horizonColor, lowColor, sunColor, sunDir;
        void main() {
          float h = vDir.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.01, 0.30, h));
          col = mix(col, topColor, smoothstep(0.27, 0.82, h));
          col = mix(lowColor, col, smoothstep(-0.10, 0.015, h));
          float sun = max(dot(vDir, sunDir), 0.0);
          col += sunColor * pow(sun, 900.0) * 2.5;
          col += sunColor * pow(sun, 14.0) * 0.19;
          col += horizonColor * pow(sun, 3.0) * 0.09;
          float band = sin(h * 45.0 + sin(vDir.x * 8.0)) * 0.5 + 0.5;
          col += horizonColor * band * 0.012 * smoothstep(0.35, 0.0, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.frustumCulled = false;
  root.add(sky);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffdfab,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  sunSprite.position.copy(sunDir).multiplyScalar(220);
  sunSprite.scale.set(53, 53, 1);
  root.add(sunSprite);

  // ---------------------------------------------------------------- Lighting
  scene.fog = new THREE.FogExp2(0x9c7369, 0.0039);
  scene.background = new THREE.Color('#8c675f');
  const hemi = new THREE.HemisphereLight(0xb8cde0, 0x704436, 1.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd0a0, 3.5);
  sun.position.set(-58, 48, -100);
  sun.target.position.set(0, 0, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const bounce = new THREE.DirectionalLight(0x7f9fbe, 1.0);
  bounce.position.set(35, 22, 40);
  const rim = new THREE.AmbientLight(0x4e5e72, 0.45);
  scene.add(rim);
  scene.add(bounce);

  // ---------------------------------------------------------------- Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420, 1, 1),
    new THREE.MeshStandardMaterial({ map: sandTex, color: 0xe9c3a0, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8c5e45, roughness: 1, transparent: true, opacity: 0.42 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 158), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.015, -1);
  root.add(road);
  for (const side of [-1, 1]) {
    const rut = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 158),
      new THREE.MeshBasicMaterial({ color: 0x583426, transparent: true, opacity: 0.26 }),
    );
    rut.rotation.x = -Math.PI / 2;
    rut.position.set(side * 2.3, 0.025, -1);
    root.add(rut);
  }

  const splatMats = [0.26, 0.38, 0.5].map((opacity) => new THREE.MeshBasicMaterial({
    map: splatTex, transparent: true, opacity, depthWrite: false,
  }));
  for (let i = 0; i < 34; i++) {
    const splat = new THREE.Mesh(
      new THREE.PlaneGeometry(rand(4, 13), rand(3, 10)),
      splatMats[i % splatMats.length],
    );
    splat.rotation.x = -Math.PI / 2;
    splat.rotation.z = rand(0, Math.PI * 2);
    splat.position.set(rand(-65, 65), 0.03, rand(-70, 65));
    root.add(splat);
  }

  // ---------------------------------------------------------------- Props
  function addCollider(x, z, hx, hz, tag = '') {
    colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, tag });
  }

  function makeLantern(x, y, z, parent) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.36, 6), mat.lantern);
    body.position.set(x, y, z);
    parent.add(body);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa452, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(1.4, 1.4, 1);
    glow.position.set(x, y, z);
    parent.add(glow);
    animated.push({ type: 'lantern', mesh: body, glow, offset: Math.random() * 10, base: 1.8 });
    return body;
  }

  function makeBuilding(cfg) {
    const {
      x, z, w = 8, d = 11, h = 4.4, side = -1, name = 'SALOON', tone = 0,
      roofColor = 'roof', falseFront = true, twoStory = false, height = null,
    } = cfg;
    const bh = height ?? h;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(g);

    const baseMat = tone > 1 ? mat.plaster : mat.wood;
    addBox(g, [w, bh, d], [0, bh / 2, 0], baseMat).castShadow = true;
    addBox(g, [w + 0.22, 0.18, d + 0.22], [0, 0.09, 0], mat.trim);

    // corner beams and siding bands
    for (const sx of [-1, 1]) {
      addBox(g, [0.17, bh, 0.17], [sx * (w / 2 - 0.05), bh / 2, d / 2 + 0.02], mat.trim);
    }
    addBox(g, [w + 0.15, 0.13, 0.13], [0, bh - 0.5, d / 2 + 0.03], mat.trim);

    if (falseFront) {
      addBox(g, [w + 0.45, bh + 1.35, 0.32], [0, (bh + 1.35) / 2, d / 2 + 0.18], mat[roofColor]);
      addBox(g, [w + 0.7, 0.2, 0.5], [0, bh + 1.42, d / 2 + 0.18], mat.trim);
      if (twoStory) addBox(g, [w + 0.6, 0.18, 0.5], [0, bh - 1.05, d / 2 + 0.2], mat.trim);
    } else {
      const slope = 0.34;
      const half = w * 0.55;
      for (const sx of [-1, 1]) {
        const pane = addBox(g, [half, 0.18, d + 0.8], [sx * w * 0.245, bh + 0.36, 0], mat[roofColor], [0, 0, sx * slope]);
        pane.castShadow = true;
      }
      addBox(g, [0.22, 0.22, d + 1], [0, bh + 1.03, 0], mat.trim);
    }

    // porch
    addBox(g, [w + 1.15, 0.17, 2.9], [0, 0.12, d / 2 + 1.38], mat.trim);
    const porchRoof = addBox(g, [w + 1.6, 0.15, 3.15], [0, 3.22, d / 2 + 1.45], mat.roof);
    porchRoof.castShadow = true;
    addBox(g, [w + 1.7, 0.12, 0.16], [0, 3.1, d / 2 + 2.92], mat.trim);
    for (const sx of [-1, 1]) {
      addCylinder(g, 0.09, 0.11, 3.1, 6, [sx * (w / 2 + 0.33), 1.6, d / 2 + 2.55], mat.trim).castShadow = true;
    }
    addBox(g, [3.2, 0.18, 0.65], [0, 0.12, d / 2 + 3.0], mat.trim);

    // windows and door
    const front = d / 2 + 0.24;
    const doorX = -w * 0.2;
    addBox(g, [1.15, 2.25, 0.12], [doorX, 1.13, front], mat.darkWood);
    addBox(g, [0.72, 1.9, 0.08], [doorX, 1.03, front + 0.07], mat.black);
    addBox(g, [0.1, 0.1, 0.08], [doorX + 0.28, 1.1, front + 0.12], mat.metal);
    // saloon batwing doors
    if (name.toLowerCase().includes('saloon')) {
      for (const sx of [-1, 1]) {
        const door = addBox(g, [0.48, 1.0, 0.07], [doorX + sx * 0.36, 1.28, front + 0.1], mat.wood);
        door.rotation.z = sx * 0.05;
        animated.push({ type: 'saloonDoor', mesh: door, side: sx, offset: Math.random() * 4 });
      }
      addBox(g, [1.8, 0.15, 0.1], [doorX, 2.42, front + 0.09], mat.trim);
    }

    for (const sx of [-1, 1]) {
      const wx = w * 0.22 + sx * w * 0.22;
      addBox(g, [1.25, 1.45, 0.08], [wx, 2.25, front], mat.trim);
      addBox(g, [1.0, 1.18, 0.09], [wx, 2.25, front + 0.05], mat.window);
      addBox(g, [0.06, 1.18, 0.1], [wx, 2.25, front + 0.11], mat.trim);
      addBox(g, [1.0, 0.07, 0.1], [wx, 2.25, front + 0.11], mat.trim);
    }
    if (twoStory) {
      for (const sx of [-1, 1]) {
        addBox(g, [1.05, 1.2, 0.08], [sx * 2.2, bh - 0.2, front], mat.trim);
        addBox(g, [0.84, 0.98, 0.09], [sx * 2.2, bh - 0.2, front + 0.05], mat.window);
      }
    }

    // sign
    const signTex = makeSignTexture(name, {
      sub: cfg.sub || (name === 'SALOON' ? 'WHISKEY · CARDS · TROUBLE' : ''),
      bg: name === 'SHERIFF' ? '#3a2117' : '#2e1a11',
    });
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color(0x3e2411),
      emissiveIntensity: 0.45,
      roughness: 0.8,
    });
    const signW = Math.min(w * 0.85, 5.4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * 0.31), signMat);
    sign.position.set(0, bh + 0.34, d / 2 + 0.36);
    g.add(sign);
    addBox(g, [signW + 0.24, 0.08, 0.06], [0, bh + 0.34 + signW * 0.155, d / 2 + 0.37], mat.trim);

    makeLantern(-w / 2 + 0.25, 2.55, front + 0.12, g);
    makeLantern(w / 2 - 0.25, 2.55, front + 0.12, g);

    // wanted posters on some fronts
    if (cfg.poster) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.68),
        new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.9 }),
      );
      p.position.set(cfg.poster === 'left' ? -w * 0.42 : w * 0.42, 1.5, front + 0.02);
      p.rotation.z = rand(-0.08, 0.08);
      g.add(p);
    }

    // barrels and crates
    if (cfg.props !== false) {
      for (let i = 0; i < 2; i++) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.86, 8), mat.darkWood);
        barrel.position.set((cfg.propsSide ?? 1) * (w / 2 + 0.55 + i * 0.5), 0.43, d / 2 - 0.1 + i * 0.4);
        barrel.castShadow = true;
        g.add(barrel);
      }
    }

    addCollider(x, z, d / 2 + 0.18, w / 2 + 0.18, name);
    return g;
  }

  const buildings = [
    { x: -17.2, z: 32, side: -1, name: 'GENERAL STORE', w: 9, d: 12, h: 4.6, sub: 'DRY GOODS · AMMUNITION', poster: 'right' },
    { x: -17.2, z: 17.5, side: -1, name: 'HOTEL', w: 8.5, d: 12.5, h: 6.8, twoStory: true, roofColor: 'roofRed', tone: 1 },
    { x: -17.2, z: 1.5, side: -1, name: 'SALOON', w: 10, d: 13, h: 5.1, sub: 'WHISKEY · CARDS · TROUBLE', poster: 'left', propsSide: -1 },
    { x: -17.2, z: -15, side: -1, name: 'SHERIFF', w: 8, d: 10.5, h: 4.2, sub: 'TERRITORIAL OFFICE' },
    { x: -17.2, z: -28, side: -1, name: 'ASSAY OFFICE', w: 7.5, d: 10, h: 4.0, sub: 'GOLD · SILVER · BLOOD' },
    { x: 17.2, z: 30, side: 1, name: 'GUNSMITH', w: 8, d: 11.5, h: 4.4, sub: 'FIREARMS & FIXINGS' },
    { x: 17.2, z: 15.8, side: 1, name: 'BATH HOUSE', w: 8.5, d: 12, h: 4.3, roofColor: 'roofRed', tone: 1 },
    { x: 17.2, z: 0.6, side: 1, name: 'LIVERY', w: 9.5, d: 13, h: 4.7, sub: 'HORSES · FEED · BOARD', propsSide: 1 },
    { x: 17.2, z: -15, side: 1, name: 'BANK', w: 8.5, d: 11.5, h: 5.2, twoStory: true, tone: 1 },
    { x: 17.2, z: -29, side: 1, name: 'UNDERTAKER', w: 7.5, d: 9.5, h: 4.0, sub: 'FUNERAL PARLOR', propsSide: 1 },
  ];
  buildings.forEach(makeBuilding);

  // Church at the end of the street
  const church = new THREE.Group();
  church.position.set(-23, 0, -45);
  church.rotation.y = Math.PI / 2.12;
  root.add(church);
  addBox(church, [8, 6.2, 12], [0, 3.1, 0], mat.plaster).castShadow = true;
  const churchRoofL = addBox(church, [5.2, 0.17, 13], [-2.05, 6.65, 0], mat.roof, [0, 0, 0.45]);
  const churchRoofR = addBox(church, [5.2, 0.17, 13], [2.05, 6.65, 0], mat.roof, [0, 0, -0.45]);
  churchRoofL.castShadow = churchRoofR.castShadow = true;
  addBox(church, [1.5, 2.5, 0.2], [0, 1.25, 6.06], mat.darkWood);
  addBox(church, [2.6, 4.4, 2.6], [0, 8.4, -3.0], mat.plaster).castShadow = true;
  const steeple = new THREE.Mesh(new THREE.ConeGeometry(1.95, 4.8, 4), mat.roof);
  steeple.position.set(0, 13, -3);
  steeple.rotation.y = Math.PI / 4;
  steeple.castShadow = true;
  church.add(steeple);
  const crossV = addBox(church, [0.12, 1.6, 0.12], [0, 16.15, -3], mat.metal);
  addBox(church, [0.78, 0.12, 0.12], [0, 16.2, -3], mat.metal);
  crossV.castShadow = true;
  for (const sx of [-2.2, 2.2]) {
    addBox(church, [1, 2.2, 0.1], [sx, 3.2, 6.08], mat.black);
  }
  addCollider(-23, -45, 5.5, 8, 'CHURCH');

  // Water tower
  const tower = new THREE.Group();
  tower.position.set(-31, 0, 23);
  root.add(tower);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = addCylinder(tower, 0.14, 0.2, 6.4, 6, [sx * 1.7, 3.2, sz * 1.7], mat.trim);
    leg.castShadow = true;
  }
  addCylinder(tower, 2.1, 2.1, 3.2, 14, [0, 7.0, 0], mat.wood).castShadow = true;
  addCylinder(tower, 0.2, 2.3, 1.0, 14, [0, 9.1, 0], mat.roof).castShadow = true;
  for (const y of [5.9, 8.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.055, 4, 20), mat.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    tower.add(ring);
  }
  addCollider(-31, 23, 2.2, 2.2, 'WATER TOWER');

  // Windmill
  const windmill = new THREE.Group();
  windmill.position.set(31, 0, -25);
  root.add(windmill);
  addCylinder(windmill, 0.24, 0.48, 9, 6, [0, 4.5, 0], mat.metal).castShadow = true;
  const blades = new THREE.Group();
  blades.position.set(0, 9.2, 0.4);
  windmill.add(blades);
  for (let i = 0; i < 8; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 8) * Math.PI * 2;
    const beam = addBox(arm, [0.12, 2.9, 0.1], [0, 1.45, 0], mat.metal);
    beam.castShadow = true;
    addBox(arm, [1.0, 1.55, 0.04], [0, 2.35, 0.01], mat.wood);
    blades.add(arm);
  }
  animated.push({ type: 'windmill', mesh: blades, speed: 0.55 });
  addCollider(31, -25, 1, 1, 'WINDMILL');

  // Wagon on the street edge
  const wagon = new THREE.Group();
  wagon.position.set(5.8, 0, -8);
  wagon.rotation.y = -0.06;
  root.add(wagon);
  addBox(wagon, [2.7, 0.28, 5], [0, 0.9, 0], mat.wood).castShadow = true;
  for (const sx of [-1, 1]) {
    addBox(wagon, [0.08, 0.8, 4.8], [sx * 1.3, 1.4, 0], mat.trim);
  }
  for (const zz of [-1.6, -0.55, 0.55, 1.6]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.055, 4, 20, Math.PI), mat.trim);
    hoop.rotation.y = Math.PI / 2;
    hoop.rotation.z = 0;
    hoop.position.set(0, 1.35, zz);
    wagon.add(hoop);
  }
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xcbb28a, roughness: 1, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.4, 14, 1, true, 0, Math.PI), canvasMat);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 1.4, 0);
  canopy.castShadow = true;
  wagon.add(canopy);
  for (const sx of [-1, 1]) {
    for (const zz of [-1.55, 1.55]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 5, 14), mat.darkWood);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(sx * 1.44, 0.7, zz);
      wheel.castShadow = true;
      wagon.add(wheel);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.24, 0.04), mat.trim);
        spoke.rotation.x = (i / 4) * Math.PI;
        spoke.position.set(sx * 1.44, 0.7, zz);
        wagon.add(spoke);
      }
    }
  }
  addCollider(5.8, -8, 1.7, 2.7, 'WAGON');

  // Hitching posts / trough
  function makeHitch(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    root.add(g);
    for (const sx of [-1, 1]) addCylinder(g, 0.09, 0.11, 1.15, 5, [sx * 1.5, 0.58, 0], mat.trim).castShadow = true;
    addBox(g, [3.3, 0.12, 0.13], [0, 1.05, 0], mat.trim);
    addCollider(x, z, rot ? 0.2 : 1.65, rot ? 1.65 : 0.2, 'HITCH');
  }
  makeHitch(8.8, 23, 0);
  makeHitch(-8.8, 9, 0);
  makeHitch(8.8, -20, 0);

  const trough = new THREE.Group();
  trough.position.set(-8.6, 0, 25);
  root.add(trough);
  addBox(trough, [1.1, 0.55, 3.4], [0, 0.3, 0], mat.darkWood).castShadow = true;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 3.2), new THREE.MeshStandardMaterial({ color: 0x40585b, roughness: 0.2, metalness: 0.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.53;
  trough.add(water);

  // Street clutter — crates, barrels, and the livery horses.
  function addBarrel(x, z, standing = true) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.43, 0.92, 9), mat.darkWood);
    barrel.position.set(x, 0.46, z);
    if (!standing) {
      barrel.rotation.z = Math.PI / 2;
      barrel.position.y = 0.43;
    }
    barrel.castShadow = true;
    root.add(barrel);
    for (const y of [0.32, 0.62]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.025, 4, 12), mat.metal);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(x, y, z);
      if (!standing) {
        hoop.rotation.set(0, Math.PI / 2, 0);
        hoop.position.set(x, 0.46, z + (y - 0.46));
      }
      root.add(hoop);
    }
  }
  function addCrate(x, z, size = 0.8, rotation = 0) {
    const crate = new THREE.Group();
    crate.position.set(x, 0, z);
    crate.rotation.y = rotation;
    root.add(crate);
    addBox(crate, [size, size, size], [0, size / 2, 0], mat.wood).castShadow = true;
    for (const sx of [-1, 1]) {
      addBox(crate, [0.075, size + 0.09, 0.075], [sx * size * 0.42, size / 2, size * 0.51], mat.trim);
    }
    addBox(crate, [size + 0.1, 0.075, 0.075], [0, size * 0.5, size * 0.51], mat.trim);
    addBox(crate, [size + 0.08, 0.08, 0.08], [0, size * 0.18, -size * 0.51], mat.trim);
  }
  addBarrel(-8.7, 35.2);
  addBarrel(-9.2, 34.35, false);
  addBarrel(8.9, 34.6);
  addBarrel(9.6, 35.45);
  addBarrel(-9.0, 12.5);
  addBarrel(9.2, -1.2);
  addCrate(9.1, 32.8, 0.92, -0.08);
  addCrate(8.55, 31.6, 0.65, 0.18);
  addCrate(-9.25, 15.0, 0.74, 0.1);
  addCrate(-8.6, 14.6, 0.52, -0.2);

  function makeHorse(x, z, rot, tone) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    root.add(g);
    const hide = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.95 });
    const darkHide = new THREE.MeshStandardMaterial({ color: 0x3a2116, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), hide);
    body.scale.set(0.48, 0.58, 1.18);
    body.position.y = 1.4;
    body.castShadow = true;
    g.add(body);
    const neck = addCylinder(g, 0.21, 0.3, 0.9, 6, [0, 1.95, -0.88], hide, [-0.55, 0, 0]);
    neck.castShadow = true;
    const head = addBox(g, [0.32, 0.36, 0.78], [0, 2.33, -1.26], hide);
    head.castShadow = true;
    addBox(g, [0.24, 0.12, 0.5], [0, 2.2, -1.58], darkHide);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.23, 4), hide);
      ear.position.set(sx * 0.12, 2.55, -1.2);
      g.add(ear);
      for (const zz of [-0.65, 0.65]) {
        addCylinder(g, 0.075, 0.09, 1.0, 5, [sx * 0.29, 0.57, zz], darkHide);
      }
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.05, 5), darkHide);
    tail.position.set(0, 1.2, 1.22);
    tail.rotation.x = -0.55;
    g.add(tail);
    const mane = addBox(g, [0.1, 0.16, 0.84], [0, 2.29, -0.86], darkHide, [0.45, 0, 0]);
    const saddle = addBox(g, [0.63, 0.14, 0.75], [0, 1.92, 0.08], mat.darkWood);
    saddle.castShadow = true;
    addBox(g, [0.7, 0.08, 0.22], [0, 1.85, 0.08], mat.trim);
    addCollider(x, z, 0.8, 1.45, 'HORSE');
  }
  makeHorse(8.2, 21.9, Math.PI + 0.12, 0x6f4528);
  makeHorse(9.8, 22.3, Math.PI - 0.07, 0x9b7551);

  // Cacti
  function makeCactus(x, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rnd() * Math.PI * 2;
    g.scale.setScalar(s);
    root.add(g);
    const trunk = addCylinder(g, 0.28, 0.38, 3.7, 7, [0, 1.85, 0], mat.cactus);
    trunk.castShadow = true;
    const arm1 = addCylinder(g, 0.19, 0.22, 1.6, 6, [0.62, 2.3, 0], mat.cactus, [0, 0, -0.15]);
    arm1.castShadow = true;
    addCylinder(g, 0.17, 0.19, 0.9, 5, [0.3, 1.55, 0], mat.cactus, [0, 0, Math.PI / 2]);
    const arm2 = addCylinder(g, 0.16, 0.19, 1.3, 6, [-0.55, 2.7, 0], mat.cactus, [0, 0, 0.12]);
    arm2.castShadow = true;
    addCylinder(g, 0.15, 0.17, 0.72, 5, [-0.25, 2.1, 0], mat.cactus, [0, 0, Math.PI / 2]);
    if (s > 1.1) addCollider(x, z, 0.5 * s, 0.5 * s, 'CACTUS');
  }
  const cactusPositions = [
    [-31, 8, 1.2], [-39, -4, 0.9], [-28, -14, 1.3], [-38, 37, 1.05], [-27, 47, 0.8],
    [32, 8, 1.1], [39, -6, 1.35], [28, 46, 0.95], [43, 23, 1.2], [36, 36, 0.8],
    [-48, 22, 1.4], [48, -18, 1.3], [22, -40, 0.9], [-22, -58, 1.1], [55, 5, 1.5],
    [-57, -12, 1.2], [61, 40, 1.1], [-43, -31, 1.0],
  ];
  cactusPositions.forEach(([x, z, s]) => makeCactus(x, z, s));

  // Rocks and scrub
  for (let i = 0; i < 34; i++) {
    const far = i > 12;
    const x = far ? (rnd() > 0.5 ? rand(38, 78) : rand(-78, -38)) : rand(-34, 34);
    const z = rand(-76, 72);
    if (Math.abs(x) < 9 && z > -60) continue;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rand(0.35, far ? 2.6 : 1.3), 0),
      mat.rock,
    );
    rock.position.set(x, rand(0.1, 0.45), z);
    rock.scale.y = rand(0.45, 0.85);
    rock.rotation.set(rnd(), rnd(), rnd());
    rock.castShadow = !far;
    root.add(rock);
  }

  // Dead trees / scrub silhouettes
  for (let i = 0; i < 10; i++) {
    const x = rnd() > 0.5 ? rand(28, 62) : rand(-62, -28);
    const z = rand(-65, 65);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    const trunk = addCylinder(g, 0.08, 0.16, rand(1.4, 2.5), 5, [0, 0.8, 0], mat.trim);
    trunk.rotation.z = rand(-0.3, 0.3);
    for (let b = 0; b < 4; b++) {
      const branch = addCylinder(g, 0.035, 0.06, rand(0.7, 1.4), 4, [rand(-0.5, 0.5), rand(1.3, 2.2), 0], mat.trim, [0, 0, rand(-1.2, 1.2)]);
      branch.rotation.x = rand(-0.7, 0.7);
    }
  }

  // Tumbleweeds
  const tumbleweeds = [];
  const twMat = new THREE.MeshBasicMaterial({ color: 0x5a3d26, wireframe: true, transparent: true, opacity: 0.72 });
  for (let i = 0; i < 6; i++) {
    const tw = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.6), 1), twMat);
    tw.position.set(rand(-40, 40), 0.45, rand(-30, 60));
    tw.userData.speed = rand(1.2, 3.2);
    tw.userData.drift = rand(-0.2, 0.2);
    root.add(tw);
    tumbleweeds.push(tw);
  }

  // ---------------------------------------------------------------- Mesas & mountains
  function makeMesa(x, z, radius, height, rotation = 0, colorOffset = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotation;
    root.add(g);
    const tiers = 3;
    let baseR = radius;
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      const tierH = height * (i === 0 ? 0.56 : i === 1 ? 0.29 : 0.15);
      const topR = i === 2 ? baseR * 0.5 : baseR * (0.78 + i * 0.04);
      const m = i % 2 === 0 ? mat.mesa : (colorOffset ? mat.mesaTop : mat.mesaDark);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(topR, baseR, tierH, 7, 1), m);
      cyl.position.y = y + tierH / 2;
      cyl.rotation.y = i * 0.25;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      g.add(cyl);
      y += tierH;
      baseR = topR * 0.94;
    }
    // Sedimentary banding gives the buttes a little more scale and texture.
    for (let i = 0; i < 4; i++) {
      const frac = 0.16 + i * 0.2;
      const bandY = height * frac;
      const bandR = radius * (1.02 - frac * 0.46);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(bandR * 1.012, bandR * 1.012, height * 0.035, 7), i % 2 ? mat.mesaDark : mat.mesaTop);
      band.position.y = bandY;
      band.rotation.y = i * 0.2;
      band.receiveShadow = true;
      g.add(band);
    }
    addCollider(x, z, radius * 0.9, radius * 0.9, 'MESA');
    return g;
  }

  makeMesa(-55, -74, 16, 23, 0.5, 0);
  makeMesa(62, -83, 20, 30, 1.2, 1);
  makeMesa(92, -19, 14, 20, 0.2, 0);
  makeMesa(-95, 3, 21, 26, 2.1, 1);
  makeMesa(34, -126, 30, 37, 0.8, 0);
  makeMesa(-28, -131, 22, 29, 1.7, 1);
  makeMesa(-104, 49, 16, 18, 0.3, 0);
  makeMesa(103, 58, 25, 24, 2.5, 1);

  // Distant mountain range silhouettes
  const mountainMatA = new THREE.MeshStandardMaterial({ color: 0x6e4a43, roughness: 1, flatShading: true });
  const mountainMatB = new THREE.MeshStandardMaterial({ color: 0x7d5145, roughness: 1, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + rand(-0.08, 0.08);
    const r = rand(155, 195);
    const h = rand(15, 42);
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(rand(18, 42), h, 5 + (i % 3)),
      i % 2 ? mountainMatA : mountainMatB,
    );
    mountain.position.set(Math.cos(angle) * r, h / 2 - 4, Math.sin(angle) * r);
    mountain.rotation.y = rand(0, Math.PI);
    root.add(mountain);
  }

  // Rail line and a distant locomotive
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3c312a, roughness: 0.6, metalness: 0.7 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 1 });
  for (const zz of [-62.5, -61.2]) {
    addBox(root, [130, 0.08, 0.12], [0, 0.08, zz], railMat);
  }
  for (let x = -64; x <= 64; x += 1.45) {
    addBox(root, [0.95, 0.1, 2.1], [x, 0.04, -61.85], tieMat);
  }
  const train = new THREE.Group();
  train.position.set(21, 0, -61.85);
  root.add(train);
  addBox(train, [7.5, 2.5, 2.7], [0, 1.45, 0], mat.black).castShadow = true;
  addCylinder(train, 0.78, 0.78, 2.5, 12, [2.4, 2.9, 0], mat.black, [0, 0, Math.PI / 2]).castShadow = true;
  addBox(train, [2.5, 2.2, 2.6], [-4.4, 1.35, 0], mat.roofRed).castShadow = true;
  addBox(train, [0.35, 2.4, 0.35], [3.1, 3.8, 0], mat.metal);
  for (const xx of [-2.5, 0.2, 2.7]) {
    for (const sy of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 4, 12), mat.metal);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(xx, 0.55, sy * 1.38);
      train.add(wheel);
    }
  }
  for (const xx of [-1.8, -0.4, 1.0]) {
    addCylinder(train, 0.1, 0.14, 1.1, 6, [xx, 3.1, 0], mat.metal);
  }

  // ---------------------------------------------------------------- Dust & atmosphere
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 340;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = [];
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = rand(-75, 75);
    dustPositions[i * 3 + 1] = rand(0.1, 9);
    dustPositions[i * 3 + 2] = rand(-70, 70);
    dustSeeds.push({ speed: rand(0.25, 1.1), phase: rand(0, Math.PI * 2), y: dustPositions[i * 3 + 1] });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf7d3a0, size: 0.085, transparent: true, opacity: 0.5,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  root.add(dustPoints);

  function addScorch(position, scale = 1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(scale * 2.8, scale * 2.8),
      new THREE.MeshBasicMaterial({ map: splatTex, color: 0x2b1710, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.copy(position);
    mesh.position.y = 0.04;
    root.add(mesh);
    scorches.push({ mesh, life: 18 });
    if (scorches.length > 22) {
      const old = scorches.shift();
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
      old.mesh.removeFromParent();
    }
    return mesh;
  }

  const startPosition = new THREE.Vector3(0.2, 0, 27);

  function update(dt, time) {
    for (const item of animated) {
      if (item.type === 'windmill') {
        item.mesh.rotation.z += dt * item.speed;
      } else if (item.type === 'lantern') {
        const flicker = 0.88 + Math.sin(time * 7.4 + item.offset) * 0.08 + Math.sin(time * 17 + item.offset) * 0.035;
        item.mesh.material.emissiveIntensity = 1.8 + flicker * 0.5;
        item.glow.material.opacity = 0.55 + flicker * 0.18;
      } else if (item.type === 'saloonDoor') {
        item.mesh.rotation.y = Math.sin(time * 0.7 + item.offset) * 0.04 * item.side;
      }
    }

    for (let i = 0; i < tumbleweeds.length; i++) {
      const tw = tumbleweeds[i];
      tw.position.x += tw.userData.speed * dt;
      tw.position.z += tw.userData.drift * dt;
      tw.position.y = 0.38 + Math.abs(Math.sin(time * 3.1 + i)) * 0.19;
      tw.rotation.x += tw.userData.speed * dt * 1.4;
      tw.rotation.z += tw.userData.speed * dt * 0.9;
      if (tw.position.x > 78) tw.position.x = -78;
    }

    const arr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const seed = dustSeeds[i];
      arr[i * 3] += seed.speed * dt;
      arr[i * 3 + 1] = seed.y + Math.sin(time * 0.52 + seed.phase) * 0.7;
      if (arr[i * 3] > 80) arr[i * 3] = -78;
    }
    dustGeo.attributes.position.needsUpdate = true;

    for (const s of scorches) {
      s.life -= dt;
      if (s.life < 2) s.mesh.material.opacity = Math.max(0, s.life / 2) * 0.85;
    }
  }

  // Collapse the town's static geometry into a handful of draw calls.
  const excluded = new Set([sky, sunSprite, dustPoints]);
  for (const item of animated) {
    if (!item.mesh) continue;
    item.mesh.traverse((child) => excluded.add(child));
  }
  for (const tw of tumbleweeds) excluded.add(tw);
  mergeStaticMeshes(root, excluded);

  return {
    root,
    colliders,
    startPosition,
    sun,
    sunDir,
    shadowTex,
    glowTex,
    mat,
    addScorch,
    update,
  };
}
