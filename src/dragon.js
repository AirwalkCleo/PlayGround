import * as THREE from 'three';
import { addBox, addCylinder, cylinderBetween, rand, clamp, damp, makeGlowTexture } from './utils.js';

const GLOW = makeGlowTexture();

const PALETTES = {
  rust: {
    body: 0x67372c, wing: 0x7d4030, belly: 0xa4734c, spike: 0x2b1c16,
    horn: 0x35251d, eye: 0xffb347, membraneEmissive: 0x341008, crack: 0x8b3a1b,
  },
  ash: {
    body: 0x4d4442, wing: 0x5b4a42, belly: 0x8b7862, spike: 0x241b18,
    horn: 0x312823, eye: 0xffd06b, membraneEmissive: 0x1d0d09, crack: 0xa94b25,
  },
  ember: {
    body: 0x5d2e24, wing: 0x71352a, belly: 0xb77c4f, spike: 0x271a14,
    horn: 0x33251c, eye: 0xffe17a, membraneEmissive: 0x4a1508, crack: 0xc25922,
  },
  boss: {
    body: 0x2c2022, wing: 0x382523, belly: 0x5c3b31, spike: 0x171012,
    horn: 0x1e1516, eye: 0xff7a2d, membraneEmissive: 0x4c1607, crack: 0xff6b2c,
  },
};

function makeWing(palette, side) {
  const root = new THREE.Group();
  root.name = side > 0 ? 'rightWing' : 'leftWing';

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.1, 0.72);
  shape.lineTo(3.0, 1.38);
  shape.lineTo(5.2, 1.11);
  shape.lineTo(4.48, 0.55);
  shape.lineTo(5.9, 0.23);
  shape.lineTo(4.48, -0.16);
  shape.lineTo(5.25, -0.68);
  shape.lineTo(3.55, -0.6);
  shape.lineTo(4.25, -1.18);
  shape.lineTo(2.35, -1.06);
  shape.lineTo(2.62, -1.63);
  shape.lineTo(1.27, -1.22);
  shape.lineTo(0.77, -0.56);
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape, 12);
  geo.rotateX(-Math.PI / 2);

  const wingMat = new THREE.MeshStandardMaterial({
    color: palette.wing,
    emissive: palette.membraneEmissive,
    emissiveIntensity: 0.38,
    roughness: 0.79,
    metalness: 0.03,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    flatShading: true,
  });
  const membrane = new THREE.Mesh(geo, wingMat);
  membrane.castShadow = true;
  membrane.receiveShadow = true;
  root.add(membrane);

  const boneMat = new THREE.MeshStandardMaterial({ color: palette.spike, roughness: 0.8 });
  const bones = [
    [[0, 0, 0], [1.05, 0, -0.68]],
    [[1.05, 0, -0.68], [3.0, 0, -1.33]],
    [[3.0, 0, -1.33], [5.05, 0, -1.06]],
    [[1.05, 0, -0.68], [3.5, 0, -0.56]],
    [[3.5, 0, -0.56], [5.7, 0, -0.23]],
    [[2.28, 0, -1.02], [4.1, 0, -1.14]],
    [[2.28, 0, -1.02], [2.5, 0, -1.58]],
  ];
  for (const [a, b] of bones) {
    const bone = cylinderBetween(
      new THREE.Vector3(...a),
      new THREE.Vector3(...b),
      side > 0 ? 0.045 : 0.045,
      boneMat,
      5,
    );
    bone.castShadow = true;
    root.add(bone);
  }
  // wing claw
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 5), boneMat);
  claw.position.set(5.58, 0.04, -0.3);
  claw.rotation.z = -Math.PI / 2.3;
  root.add(claw);

  return { root, membrane, wingMat, boneMat };
}

export class Dragon {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.isBoss = !!opts.boss;
    this.variant = this.isBoss ? 'boss' : (opts.variant || 'rust');
    this.palette = PALETTES[this.variant] || PALETTES.rust;
    this.size = this.isBoss ? 1.62 : rand(0.88, 1.12);
    this.maxHp = opts.hp ?? (this.isBoss ? 560 : 100);
    this.hp = this.maxHp;
    this.speed = opts.speed ?? (this.isBoss ? 10.5 : rand(13.5, 17.5));
    this.orbitRadius = this.isBoss ? 31 : rand(24, 37);
    this.orbitAltitude = this.isBoss ? 18 : rand(13.5, 20);
    this.orbitSpeed = (this.isBoss ? 0.19 : rand(0.2, 0.32)) * (Math.random() > 0.5 ? 1 : -1);
    this.orbitAngle = opts.angle ?? rand(0, Math.PI * 2);
    this.state = 'enter';
    this.stateTime = 0;
    this.attackTimer = this.isBoss ? 5.5 : rand(4.2, 7.5);
    this.breathed = false;
    this.dealtDamage = false;
    this.flash = 0;
    this.deadTimer = 0;
    this.alive = true;
    this.dying = false;
    this.quit = false;
    this.removed = false;
    this.volleyTimer = 4.5;
    this.bank = 0;
    this.pitch = 0;
    this.prevYaw = 0;
    this.hover = rand(0, 10);
    this.hitMeshes = [];
    this.materials = [];
    this.wingLeft = null;
    this.wingRight = null;
    this.healthGroup = null;

    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.group.scale.setScalar(this.size);
    this.group.name = this.isBoss ? 'dragon-boss' : 'dragon';

    this.buildModel();
    scene.add(this.group);

    const spawnAngle = this.orbitAngle + rand(-0.38, 0.38);
    const spawnRadius = opts.spawnRadius ?? (this.isBoss ? 58 : rand(52, 64));
    this.group.position.set(
      Math.cos(spawnAngle) * spawnRadius,
      opts.spawnY ?? (this.orbitAltitude + rand(7, 13)),
      Math.sin(spawnAngle) * spawnRadius,
    );
    this.state = 'enter';
    this.enterTime = 0;

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 4.4),
      new THREE.MeshBasicMaterial({
        map: scene.userData.shadowTex,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);

    this.buildHealthBar();
  }

  buildModel() {
    const p = this.palette;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: p.body, roughness: 0.72, metalness: 0.04, flatShading: true,
      emissive: p.crack, emissiveIntensity: this.isBoss ? 0.12 : 0.02,
    });
    const wingPaletteMat = null;
    const bellyMat = new THREE.MeshStandardMaterial({ color: p.belly, roughness: 0.82, flatShading: true });
    const spikeMat = new THREE.MeshStandardMaterial({ color: p.spike, roughness: 0.76, flatShading: true });
    const hornMat = new THREE.MeshStandardMaterial({ color: p.horn, roughness: 0.7, flatShading: true });
    const eyeMat = new THREE.MeshStandardMaterial({ color: p.eye, emissive: p.eye, emissiveIntensity: 2.7, roughness: 0.25 });
    this.bodyMat = bodyMat;
    this.bellyMat = bellyMat;
    this.spikeMat = spikeMat;
    this.hornMat = hornMat;
    this.eyeMat = eyeMat;
    this.materials = [bodyMat, bellyMat, spikeMat, hornMat];

    const model = new THREE.Group();
    model.name = 'dragon-model';
    this.model = model;
    this.group.add(model);

    // torso
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bodyMat);
    body.scale.set(1.0, 0.8, 2.02);
    body.position.set(0, 0, -0.1);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.part = 'body';
    this.hitMeshes.push(body);
    model.add(body);
    this.bodyMesh = body;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), bodyMat);
    chest.scale.set(0.83, 0.7, 1.03);
    chest.position.set(0, 0.03, -1.25);
    chest.castShadow = true;
    chest.userData.part = 'body';
    this.hitMeshes.push(chest);
    model.add(chest);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), bellyMat);
    belly.scale.set(0.76, 0.44, 1.75);
    belly.position.set(0, -0.45, -0.2);
    belly.castShadow = true;
    belly.userData.part = 'body';
    this.hitMeshes.push(belly);
    model.add(belly);

    // neck
    const neckPts = [
      [0, 0.22, -1.62, 0.55],
      [0, 0.42, -2.12, 0.44],
      [0, 0.63, -2.56, 0.34],
    ];
    for (const [x, y, z, r] of neckPts) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.72, 8), bodyMat);
      neck.rotation.x = Math.PI / 2 + 0.22;
      neck.position.set(x, y, z);
      neck.castShadow = true;
      neck.userData.part = 'body';
      this.hitMeshes.push(neck);
      model.add(neck);
    }

    // head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.79, -2.92);
    headGroup.rotation.x = -0.08;
    model.add(headGroup);
    this.headGroup = headGroup;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 9), bodyMat);
    head.scale.set(0.9, 0.86, 1.13);
    head.castShadow = true;
    head.userData.part = 'head';
    head.userData.head = true;
    this.hitMeshes.push(head);
    headGroup.add(head);
    this.headMesh = head;

    const snout = addBox(headGroup, [0.48, 0.3, 0.78], [0, -0.07, -0.68], bodyMat);
    snout.castShadow = true;
    snout.userData.part = 'head';
    this.hitMeshes.push(snout);
    addBox(headGroup, [0.38, 0.15, 0.28], [0, 0.15, -0.42], bodyMat).castShadow = true;

    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.2, -0.18);
    headGroup.add(jawGroup);
    this.jawGroup = jawGroup;
    const jaw = addBox(jawGroup, [0.4, 0.13, 0.75], [0, -0.04, -0.36], bellyMat);
    jaw.userData.part = 'head';
    this.hitMeshes.push(jaw);

    // teeth
    for (let i = 0; i < 5; i++) {
      for (const sx of [-1, 1]) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.15, 4), hornMat);
        tooth.position.set(sx * (0.12 + i * 0.028), 0.13 - i * 0.012, -0.25 - i * 0.1);
        tooth.rotation.z = Math.PI;
        tooth.rotation.x = Math.PI;
        headGroup.add(tooth);
      }
    }

    // eyes
    for (const sx of [-1, 1]) {
      const socket = addBox(headGroup, [0.15, 0.12, 0.08], [sx * 0.235, 0.16, -0.39], spikeMat, [0, sx * 0.2, sx * 0.15]);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat);
      eye.scale.set(1, 0.68, 0.5);
      eye.position.set(sx * 0.255, 0.165, -0.44);
      headGroup.add(eye);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: p.eye, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(0.42, 0.42, 1);
      glow.position.copy(eye.position);
      headGroup.add(glow);
    }

    // horns
    for (const sx of [-1, 1]) {
      const hornBase = new THREE.Group();
      hornBase.position.set(sx * 0.3, 0.35, -0.05);
      hornBase.rotation.z = sx * 0.55;
      hornBase.rotation.x = -0.8;
      headGroup.add(hornBase);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 6), hornMat);
      horn.position.y = 0.32;
      horn.castShadow = true;
      hornBase.add(horn);
      // secondary horn
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.46, 5), hornMat);
      horn2.position.set(sx * 0.13, 0.6, 0.04);
      horn2.rotation.z = sx * 0.35;
      horn2.rotation.x = -0.4;
      headGroup.add(horn2);
    }
    // nose horn
    const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 5), hornMat);
    noseHorn.position.set(0, 0.17, -0.88);
    noseHorn.rotation.x = -0.28;
    headGroup.add(noseHorn);

    // mouth glow
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, -0.12, -0.88);
    headGroup.add(this.mouth);
    this.mouthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color: this.isBoss ? 0xff5b20 : 0xff9b3d,
      transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.mouthGlow.scale.set(0.8, 0.8, 1);
    this.mouthGlow.position.copy(this.mouth.position);
    headGroup.add(this.mouthGlow);

    // spine spikes
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const z = 1.45 - t * 3.3;
      const y = 0.65 + Math.sin(t * Math.PI) * 0.17;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11 + (1 - t) * 0.06, 0.38 + Math.sin(t * Math.PI) * 0.28, 5), spikeMat);
      spike.position.set(0, y, z);
      spike.rotation.x = -0.16;
      spike.castShadow = true;
      model.add(spike);
    }

    // legs / claws
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.52, -0.23, -1.24);
      model.add(arm);
      const upper = addCylinder(arm, 0.1, 0.14, 0.58, 6, [0, -0.27, 0], bodyMat, [0.35, 0, sx * 0.3]);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), hornMat);
      claw.position.set(sx * 0.08, -0.65, -0.08);
      claw.rotation.x = 1.3;
      arm.add(claw);

      const leg = new THREE.Group();
      leg.position.set(sx * 0.62, -0.27, 0.9);
      model.add(leg);
      addCylinder(leg, 0.14, 0.22, 0.7, 6, [0, -0.32, 0], bodyMat, [-0.35, 0, sx * 0.12]);
      const foot = addBox(leg, [0.32, 0.16, 0.4], [0, -0.67, -0.12], spikeMat);
      for (let c = 0; c < 3; c++) {
        const toe = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), hornMat);
        toe.position.set((c - 1) * 0.1, -0.72, -0.36);
        toe.rotation.x = 1.2;
        leg.add(toe);
      }
    }

    // tail chain
    let tailParent = new THREE.Group();
    tailParent.position.set(0, 0.08, 1.7);
    model.add(tailParent);
    this.tailSegments = [];
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      if (i > 0) seg.position.z = 0.6;
      const r = 0.32 * (1 - i / 8.2);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, 0.65, 7), bodyMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = 0.3;
      mesh.castShadow = true;
      mesh.userData.part = 'body';
      this.hitMeshes.push(mesh);
      seg.add(mesh);
      if (i % 2 === 1 && i < 6) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), spikeMat);
        spike.position.set(0, r + 0.15, 0.28);
        seg.add(spike);
      }
      tailParent.add(seg);
      this.tailSegments.push(seg);
      tailParent = seg;
    }
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 5), spikeMat);
    tailTip.rotation.x = -Math.PI / 2;
    tailTip.position.z = 0.72;
    tailParent.add(tailTip);

    // wings
    this.wingRight = makeWing(p, 1);
    this.wingRight.root.position.set(0.62, 0.33, 0.1);
    model.add(this.wingRight.root);
    this.wingLeft = makeWing(p, 1);
    this.wingLeft.root.position.set(-0.62, 0.33, 0.1);
    this.wingLeft.root.scale.x = -1;
    model.add(this.wingLeft.root);

    // boss crown / lava cracks
    if (this.isBoss) {
      for (let i = 0; i < 4; i++) {
        const crack = new THREE.Mesh(
          new THREE.TorusGeometry(0.92, 0.025, 4, 20, Math.PI * 1.1),
          new THREE.MeshBasicMaterial({ color: 0xff5b22 }),
        );
        crack.rotation.x = Math.PI / 2;
        crack.rotation.z = rand(-0.3, 0.3);
        crack.position.set(rand(-0.45, 0.45), rand(-0.55, 0.25), rand(-1.2, 1.2));
        crack.scale.set(rand(0.4, 0.85), rand(0.2, 0.45), 1);
        model.add(crack);
      }
      for (const sx of [-1, 1]) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.95, 5), hornMat);
        crown.position.set(sx * 0.16, 0.64, -0.02);
        crown.rotation.x = -0.8;
        crown.rotation.z = sx * 0.28;
        headGroup.add(crown);
      }
      const bossMark = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.035, 4, 24),
        new THREE.MeshBasicMaterial({ color: 0xff6a2a }),
      );
      bossMark.rotation.x = Math.PI / 2;
      bossMark.position.set(0, 0.05, -2.2);
      model.add(bossMark);
    }

    // assign references for hit detection
    for (const mesh of this.hitMeshes) {
      mesh.userData.dragon = this;
      if (!mesh.userData.part) mesh.userData.part = 'body';
    }
    for (const wing of [this.wingLeft, this.wingRight]) {
      const membrane = wing.membrane;
      membrane.userData.dragon = this;
      membrane.userData.part = 'wing';
      this.hitMeshes.push(membrane);
      this.materials.push(wing.wingMat);
    }
  }

  buildHealthBar() {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x160b08, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }),
    );
    bg.renderOrder = 20;
    group.add(bg);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(3.24, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x4b2b20, transparent: true, opacity: 0.94, depthWrite: false, depthTest: false }),
    );
    back.position.z = 0.001;
    back.renderOrder = 21;
    group.add(back);
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(3.16, 0.11),
      new THREE.MeshBasicMaterial({ color: this.isBoss ? 0xe35e28 : 0xd48f45, transparent: true, opacity: 1, depthWrite: false, depthTest: false }),
    );
    fill.position.z = 0.002;
    fill.renderOrder = 22;
    group.add(fill);
    group.visible = false;
    group.scale.setScalar(this.isBoss ? 1.4 : 1);
    this.scene.add(group);
    this.healthGroup = group;
    this.healthBg = bg;
    this.healthBack = back;
    this.healthFill = fill;
  }

  get center() {
    return new THREE.Vector3(this.group.position.x, this.group.position.y + 0.15, this.group.position.z);
  }

  get radius() {
    return 2.05 * this.size;
  }

  takeDamage(amount, part = 'body') {
    if (!this.alive || this.dying) return 0;
    const isHead = part === 'head';
    const dmg = Math.round(amount * (isHead ? 2 : 1));
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.12;
    this.healthGroup.visible = true;
    this.updateHealthBar();
    if (this.hp <= 0) this.die();
    return dmg;
  }

  updateHealthBar() {
    const ratio = clamp(this.hp / this.maxHp, 0, 1);
    this.healthFill.scale.x = ratio;
    this.healthFill.position.x = -(1 - ratio) * 1.58;
    this.healthFill.material.color.setHex(ratio < 0.28 ? 0xc43122 : (this.isBoss ? 0xe35e28 : 0xd48f45));
  }

  die() {
    if (this.dying) return;
    this.dying = true;
    this.alive = false;
    this.state = 'dying';
    this.deadTimer = 0;
    this.fallSpeed = 4;
    this.spin = rand(-4, 4);
    this.healthGroup.visible = false;
    this.impacted = false;
    if (this.onKilled) this.onKilled(this);
  }

  beginDive(game) {
    this.state = 'dive';
    this.stateTime = 0;
    this.breathed = false;
    this.dealtDamage = false;
    const player = game.player.position;
    const dir = new THREE.Vector3().subVectors(player, this.group.position);
    dir.y = 0;
    dir.normalize();
    this.diveStart = this.group.position.clone();
    this.diveTarget = new THREE.Vector3(
      player.x + dir.x * 2.4,
      2.9 + (this.isBoss ? 1.1 : 0),
      player.z + dir.z * 2.4,
    );
    this.diveDuration = this.isBoss ? 2.15 : 1.8;
    game.onDragonRoar(this, false);
  }

  update(dt, time, game, camera) {
    if (this.removed) return;
    this.stateTime += dt;
    const player = game.player.position;
    const playerVel = game.player.velocity;

    if (this.dying) {
      this.updateDeath(dt, game);
      return;
    }

    if (this.flash > 0) {
      this.flash -= dt;
      const on = this.flash > 0;
      this.bodyMat.emissive.setHex(on ? 0xff3b20 : this.palette.crack);
      this.bodyMat.emissiveIntensity = on ? 1.1 : (this.isBoss ? 0.12 : 0.02);
      this.bellyMat.emissive.setHex(on ? 0xff3b20 : 0x000000);
      this.bellyMat.emissiveIntensity = on ? 0.55 : 0;
    }

    // wing flap speed varies by state
    const flapSpeed = this.state === 'dive' ? 9.5 : (this.state === 'recover' ? 8.2 : 4.6);
    const flapAmp = this.state === 'dive' ? 0.36 : 0.58;
    const flap = Math.sin(time * flapSpeed + this.hover) * flapAmp + 0.1;
    if (this.wingRight) this.wingRight.root.rotation.z = flap;
    if (this.wingLeft) this.wingLeft.root.rotation.z = -flap;
    if (this.wingRight) this.wingRight.root.rotation.y = -0.12 + Math.sin(time * 2 + this.hover) * 0.05;
    if (this.wingLeft) this.wingLeft.root.rotation.y = 0.12 - Math.sin(time * 2 + this.hover) * 0.05;

    // body / tail animation
    this.model.position.y = Math.sin(time * 2.2 + this.hover) * 0.1;
    if (this.tailSegments) {
      for (let i = 0; i < this.tailSegments.length; i++) {
        this.tailSegments[i].rotation.y = Math.sin(time * 2.1 + i * 0.55 + this.hover) * 0.07;
        this.tailSegments[i].rotation.x = Math.sin(time * 1.4 + i * 0.45) * 0.035;
      }
    }
    if (this.jawGroup) {
      const jawOpen = this.state === 'dive' ? 0.45 : 0.08 + Math.sin(time * 1.1 + this.hover) * 0.012;
      this.jawGroup.rotation.x = damp(this.jawGroup.rotation.x, jawOpen, dt, 8);
    }

    if (this.state === 'enter') {
      this.enterTime += dt;
      this.enterToOrbit(dt, player, time);
    } else if (this.state === 'orbit') {
      this.updateOrbit(dt, player, time, game);
    } else if (this.state === 'dive') {
      this.updateDive(dt, player, playerVel, game);
    } else if (this.state === 'recover') {
      this.updateRecover(dt, player, time, game);
    }

    // keep general bounds
    this.group.position.x = clamp(this.group.position.x, -105, 105);
    this.group.position.z = clamp(this.group.position.z, -110, 105);

    // health bar / shadow
    const hbY = this.isBoss ? 4.5 : 3.0;
    this.healthGroup.position.set(
      this.group.position.x,
      this.group.position.y + hbY * this.size,
      this.group.position.z,
    );
    this.healthGroup.quaternion.copy(camera.quaternion);
    this.shadow.position.set(this.group.position.x, 0.045, this.group.position.z);
    const alt = clamp(this.group.position.y, 0, 30);
    this.shadow.scale.setScalar(1 + alt * 0.035);
    this.shadow.material.opacity = 0.33 * (1 - alt / 44);
  }

  enterToOrbit(dt, player, time) {
    const angle = this.orbitAngle;
    const target = new THREE.Vector3(
      player.x + Math.cos(angle) * this.orbitRadius,
      this.orbitAltitude + Math.sin(time * 0.6) * 1.3,
      player.z + Math.sin(angle) * this.orbitRadius,
    );
    const desired = target.clone().sub(this.group.position);
    const dist = desired.length();
    desired.normalize().multiplyScalar(this.speed);
    this.group.position.addScaledVector(desired, dt);
    this.orient(desired, dt);
    if (dist < 10 || this.enterTime > 6.5) {
      this.state = 'orbit';
      this.stateTime = 0;
      this.attackTimer = this.breathed ? rand(3.2, 5.8) : rand(2.2, 4.4);
    }
  }

  updateOrbit(dt, player, time, game) {
    this.orbitAngle += this.orbitSpeed * dt;
    const angle = this.orbitAngle;
    const target = new THREE.Vector3(
      player.x + Math.cos(angle) * this.orbitRadius,
      this.orbitAltitude + Math.sin(time * 0.62 + this.hover) * 1.7,
      player.z + Math.sin(angle) * this.orbitRadius,
    );
    const desired = target.clone().sub(this.group.position);
    const dist = desired.length();
    desired.normalize().multiplyScalar(this.speed * (this.isBoss ? 0.9 : 1));
    this.group.position.addScaledVector(desired, dt);

    const yawTarget = Math.atan2(-desired.x, -desired.z);
    this.turnTowards(yawTarget, dt, 1.65);
    this.pitch = damp(this.pitch, clamp(desired.y * 0.04, -0.16, 0.16), dt, 2.2);
    this.group.rotation.x = this.pitch;
    this.bank = damp(this.bank, clamp(this.orbitSpeed * 0.9, -0.32, 0.32), dt, 2.4);
    this.group.rotation.z = this.bank;

    // face the player more directly when near target position
    if (dist < 4.2) this.facePoint(player, dt, 1.6);

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      if (this.isBoss) {
        if (this.attackTimer < -2.1) this.beginDive(game);
      } else if (Math.random() < 0.72 && this.group.position.distanceTo(player) < 55) {
        this.beginDive(game);
      } else {
        this.attackTimer = rand(3.5, 5.2);
      }
    }

    if (this.isBoss) {
      this.volleyTimer -= dt;
      if (this.volleyTimer <= 0) {
        this.bossVolley(game);
        this.volleyTimer = rand(3.8, 5.6);
      }
    }
  }

  bossVolley(game) {
    if (this.state !== 'orbit') return;
    const player = game.player.position;
    const origin = new THREE.Vector3();
    this.mouth.getWorldPosition(origin);
    const base = player.clone().add(new THREE.Vector3(0, 1.2, 0));
    for (let i = -1; i <= 1; i++) {
      const target = base.clone();
      const lateral = new THREE.Vector3(-(base.z - origin.z), 0, base.x - origin.x).normalize().multiplyScalar(i * 2.4);
      target.add(lateral);
      game.spawnFireball(origin, target, 14, 1.15, true);
    }
    this.mouthGlow.material.opacity = 1;
    setTimeout(() => { if (!this.removed) this.mouthGlow.material.opacity = 0; }, 210);
    game.onDragonRoar(this, true);
  }

  updateDive(dt, player, playerVel, game) {
    const t = clamp(this.stateTime / this.diveDuration, 0, 1);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const end = this.diveTarget;
    this.group.position.x = this.diveStart.x + (end.x - this.diveStart.x) * ease;
    this.group.position.z = this.diveStart.z + (end.z - this.diveStart.z) * ease;
    const arc = Math.sin(t * Math.PI);
    this.group.position.y = this.diveStart.y + (end.y - this.diveStart.y) * ease + arc * 1.5;

    const vel = new THREE.Vector3(
      end.x - this.diveStart.x,
      end.y - this.diveStart.y,
      end.z - this.diveStart.z,
    ).normalize();
    const yawTarget = Math.atan2(-vel.x, -vel.z);
    this.turnTowards(yawTarget, dt, 5.5);
    this.pitch = damp(this.pitch, -0.36, dt, 5);
    this.group.rotation.x = this.pitch;
    this.bank = damp(this.bank, 0, dt, 4);
    this.group.rotation.z = Math.sin(t * Math.PI) * 0.1;

    if (this.jawGroup) this.jawGroup.rotation.x = damp(this.jawGroup.rotation.x, 0.42, dt, 10);
    if (t > 0.66 && !this.breathed) {
      this.breathed = true;
      this.breathFire(game, player, playerVel);
    }

    if (!this.dealtDamage) {
      const dx = this.group.position.x - player.x;
      const dz = this.group.position.z - player.z;
      const dy = this.group.position.y - (player.y + 1.2);
      if (Math.sqrt(dx * dx + dz * dz) < 4.2 * this.size && Math.abs(dy) < 3.6 * this.size) {
        this.dealtDamage = true;
        game.damagePlayer(this.isBoss ? 28 : 18, this);
        game.onDragonClaw(this);
      }
    }

    if (t >= 1) {
      this.state = 'recover';
      this.stateTime = 0;
      this.climbStart = this.group.position.clone();
      game.onDragonRoar(this, false);
    }
  }

  breathFire(game, player, playerVel) {
    const origin = new THREE.Vector3();
    this.mouth.getWorldPosition(origin);
    const target = new THREE.Vector3(player.x, player.y + 1.15, player.z)
      .addScaledVector(playerVel, 0.32);
    game.spawnFireball(origin, target, this.isBoss ? 23 : 16, this.isBoss ? 1.4 : 1.05, this.isBoss);
    if (this.isBoss) {
      const offset = new THREE.Vector3(1.8, 0, 0);
      game.spawnFireball(origin, target.clone().add(offset), 16, 1.0, true);
      game.spawnFireball(origin, target.clone().sub(offset), 16, 1.0, true);
    }
    this.mouthGlow.material.opacity = 1;
    setTimeout(() => { if (!this.removed) this.mouthGlow.material.opacity = 0; }, 260);
    game.onDragonBreath(this);
  }

  updateRecover(dt, player, time, game) {
    const t = clamp(this.stateTime / 2.2, 0, 1);
    const target = new THREE.Vector3(
      player.x + Math.cos(this.orbitAngle + t * 1.2) * this.orbitRadius,
      this.orbitAltitude + 2 + Math.sin(time) * 0.7,
      player.z + Math.sin(this.orbitAngle + t * 1.2) * this.orbitRadius,
    );
    const desired = target.clone().sub(this.group.position);
    const dist = desired.length();
    desired.normalize().multiplyScalar(this.speed * 1.18);
    this.group.position.addScaledVector(desired, dt);
    this.turnTowards(Math.atan2(-desired.x, -desired.z), dt, 3);
    this.pitch = damp(this.pitch, clamp(desired.y * 0.08, -0.3, 0.35), dt, 3.2);
    this.group.rotation.x = this.pitch;
    this.bank = damp(this.bank, 0, dt, 3);
    this.group.rotation.z = 0;
    if (t >= 1 || dist < 5) {
      this.state = 'orbit';
      this.stateTime = 0;
      this.attackTimer = rand(4.6, 7.2);
      this.orbitAngle += this.orbitSpeed > 0 ? 0.5 : -0.5;
    }
  }

  updateDeath(dt, game) {
    this.deadTimer += dt;
    this.fallSpeed += 17 * dt;
    this.group.position.y -= this.fallSpeed * dt;
    this.group.position.y = Math.max(this.group.position.y, 0.85);
    this.group.rotation.x += this.spin * dt * 0.28;
    this.group.rotation.z += this.spin * dt;
    this.model.position.y += Math.sin(this.deadTimer * 7) * 0.002;

    if (this.wingRight) this.wingRight.root.rotation.z = damp(this.wingRight.root.rotation.z, 0.9, dt, 2);
    if (this.wingLeft) this.wingLeft.root.rotation.z = damp(this.wingLeft.root.rotation.z, -0.9, dt, 2);
    this.shadow.material.opacity = 0;
    this.healthGroup.visible = false;

    if (this.group.position.y <= 0.86 && !this.impacted) {
      this.impacted = true;
      this.spin = 0;
      game.onDragonImpact(this);
    }
    if (this.deadTimer > 3.1) {
      this.quit = true;
      this.removed = true;
      this.dispose();
    }
  }

  orient(direction, dt) {
    const yaw = Math.atan2(-direction.x, -direction.z);
    this.turnTowards(yaw, dt, 2.2);
    this.pitch = damp(this.pitch, clamp(direction.y * 0.08, -0.2, 0.2), dt, 2);
    this.group.rotation.x = this.pitch;
    this.bank = damp(this.bank, 0, dt, 2);
    this.group.rotation.z = this.bank;
  }

  turnTowards(target, dt, rate) {
    let diff = target - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * rate);
    this.turnDelta = diff;
  }

  facePoint(point, dt, rate) {
    const dir = new THREE.Vector3().subVectors(point, this.group.position);
    const yaw = Math.atan2(-dir.x, -dir.z);
    this.turnTowards(yaw, dt, rate);
    this.pitch = damp(this.pitch, clamp((dir.y - 1) * 0.02, -0.2, 0.12), dt, 2);
    this.group.rotation.x = this.pitch;
  }

  dispose() {
    if (!this.group || this.disposed) return;
    this.disposed = true;
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.group.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.shadow.removeFromParent();
    if (this.healthGroup) {
      this.healthGroup.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.healthGroup.removeFromParent();
    }
  }
}
