import * as THREE from 'three';
import { addBox, addCylinder, damp } from './utils.js';

export function createCowboy() {
  const group = new THREE.Group();
  group.name = 'cowboy';

  const mats = {
    coat: new THREE.MeshStandardMaterial({ color: 0x3f271e, roughness: 0.93 }),
    coatDark: new THREE.MeshStandardMaterial({ color: 0x2b1a14, roughness: 0.95 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0xbda77f, roughness: 0.96 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x403b36, roughness: 0.95 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x24150f, roughness: 0.86 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb97b52, roughness: 0.9 }),
    hat: new THREE.MeshStandardMaterial({ color: 0x7a5533, roughness: 0.96 }),
    hatDark: new THREE.MeshStandardMaterial({ color: 0x3a2617, roughness: 0.95 }),
    scarf: new THREE.MeshStandardMaterial({ color: 0x8d2c20, roughness: 0.94 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x7c7970, roughness: 0.35, metalness: 0.85 }),
    woodGun: new THREE.MeshStandardMaterial({ color: 0x3b2014, roughness: 0.82 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x241913, roughness: 0.88 }),
    buckle: new THREE.MeshStandardMaterial({ color: 0xc89b52, roughness: 0.4, metalness: 0.8 }),
  };

  const torso = new THREE.Group();
  torso.position.y = 1.1;
  group.add(torso);

  // torso / vest
  addBox(torso, [0.62, 0.78, 0.35], [0, 0.2, 0], mats.coat).castShadow = true;
  addBox(torso, [0.39, 0.45, 0.37], [0, 0.23, -0.005], mats.shirt);
  addBox(torso, [0.12, 0.72, 0.385], [0, 0.2, 0.0], mats.coatDark, [0, 0, 0.06]);
  // belt
  addBox(torso, [0.65, 0.12, 0.39], [0, -0.21, 0], mats.belt);
  addBox(torso, [0.14, 0.11, 0.03], [0, -0.21, -0.21], mats.buckle);
  // coat tails
  const tailL = addBox(torso, [0.28, 0.62, 0.08], [-0.18, -0.48, 0.18], mats.coat, [0.08, 0, 0.12]);
  const tailR = addBox(torso, [0.28, 0.62, 0.08], [0.18, -0.48, 0.18], mats.coat, [0.08, 0, -0.12]);
  tailL.castShadow = tailR.castShadow = true;
  // scarf
  addBox(torso, [0.5, 0.15, 0.38], [0, 0.56, 0], mats.scarf);
  addBox(torso, [0.15, 0.28, 0.07], [0.09, 0.39, -0.2], mats.scarf, [0.1, 0, -0.2]);

  // head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.74, 0);
  torso.add(headGroup);
  addCylinder(headGroup, 0.1, 0.12, 0.18, 6, [0, 0.01, 0], mats.skin);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 9), mats.skin);
  head.scale.set(0.9, 1.05, 0.9);
  head.position.y = 0.19;
  head.castShadow = true;
  headGroup.add(head);
  // nose / jaw hint
  addBox(headGroup, [0.075, 0.07, 0.08], [0, 0.16, -0.235], mats.skin);
  // eyes
  for (const sx of [-1, 1]) {
    addBox(headGroup, [0.035, 0.028, 0.02], [sx * 0.075, 0.235, -0.214], mats.hatDark);
    // moustache
    addBox(headGroup, [0.09, 0.022, 0.018], [sx * 0.055, 0.105, -0.226], mats.hatDark, [0, 0, sx * 0.16]);
  }
  // hat
  const hatGroup = new THREE.Group();
  hatGroup.position.y = 0.43;
  hatGroup.rotation.x = -0.05;
  headGroup.add(hatGroup);
  addCylinder(hatGroup, 0.44, 0.46, 0.055, 14, [0, 0, 0], mats.hat).castShadow = true;
  addCylinder(hatGroup, 0.205, 0.25, 0.26, 10, [0, 0.15, 0], mats.hat).castShadow = true;
  addCylinder(hatGroup, 0.252, 0.255, 0.07, 10, [0, 0.062, 0], mats.hatDark);
  addBox(hatGroup, [0.38, 0.025, 0.006], [0, 0.01, -0.43], mats.hatDark);
  headGroup.rotation.x = 0.08;

  // Legs
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.17, 0.9, 0);
    group.add(leg);
    const thigh = addBox(leg, [0.21, 0.54, 0.25], [0, -0.25, 0], mats.pants);
    thigh.castShadow = true;
    const shin = addBox(leg, [0.18, 0.46, 0.21], [0, -0.71, 0], mats.pants);
    shin.castShadow = true;
    const boot = addBox(leg, [0.21, 0.22, 0.38], [0, -0.97, -0.06], mats.boots);
    boot.castShadow = true;
    addBox(leg, [0.23, 0.05, 0.4], [0, -1.09, -0.06], mats.hatDark);
    legs.push(leg);
  }

  // Arms
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.39, 1.55, 0);
    group.add(arm);
    const upper = addBox(arm, [0.19, 0.5, 0.22], [0, -0.21, 0], mats.coat);
    upper.castShadow = true;
    const fore = addBox(arm, [0.155, 0.42, 0.17], [0, -0.54, 0], mats.coat);
    fore.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mats.skin);
    hand.position.y = -0.78;
    arm.add(hand);
    arms.push(arm);
  }

  // Revolver in right hand, barrel points down the arm (-Y local)
  const gun = new THREE.Group();
  gun.position.set(0, -0.78, 0);
  const rightArm = arms[1];
  rightArm.add(gun);
  addBox(gun, [0.055, 0.33, 0.06], [0, -0.18, 0], mats.metal);
  addBox(gun, [0.075, 0.12, 0.075], [0, -0.35, 0], mats.metal);
  addBox(gun, [0.09, 0.2, 0.11], [0, -0.05, 0.05], mats.woodGun, [0.2, 0, 0]);
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), mats.metal);
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.set(0, -0.08, 0);
  gun.add(cylinder);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.38, 0);
  gun.add(muzzle);
  // holster
  addBox(group, [0.12, 0.34, 0.13], [0.34, 0.65, 0.12], mats.leather ?? mats.belt, [0.2, 0, 0.1]);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    group,
    parts: {
      torso, headGroup, hatGroup, legs, arms, gun, muzzle, tailL, tailR, cylinder,
      materials: mats,
    },
    flashMaterials: [mats.coat, mats.shirt, mats.skin, mats.hat],
  };
}

export function animateCowboy(cowboy, dt, state) {
  const { parts } = cowboy;
  const { moving, speed, aiming, shooting, dead, time } = state;
  const walk = state.walkPhase || 0;
  const amp = moving ? Math.min(1, speed / 6.5) * 0.65 : 0;
  const aimFactor = aiming ? 1 : 0;

  // legs stride
  parts.legs[0].rotation.x = damp(parts.legs[0].rotation.x, Math.sin(walk) * amp, dt, 14);
  parts.legs[1].rotation.x = damp(parts.legs[1].rotation.x, -Math.sin(walk) * amp, dt, 14);

  // arms swing, right arm locks toward aim while aiming
  const leftTarget = moving ? -Math.sin(walk) * amp * 0.8 : Math.sin(time * 1.5) * 0.025;
  parts.arms[0].rotation.x = damp(parts.arms[0].rotation.x, leftTarget + aimFactor * 0.25, dt, 12);
  parts.arms[0].rotation.z = damp(parts.arms[0].rotation.z, -0.08 - aimFactor * 0.08, dt, 9);
  const rightTarget = aimFactor ? Math.PI / 2 + 0.02 : (moving ? Math.sin(walk) * amp * 0.55 : 0.06);
  parts.arms[1].rotation.x = damp(parts.arms[1].rotation.x, rightTarget + (shooting ? -0.16 : 0), dt, 18);
  parts.arms[1].rotation.z = damp(parts.arms[1].rotation.z, aimFactor ? -0.02 : 0.09, dt, 10);

  // subtle torso life
  const bob = moving ? Math.abs(Math.sin(walk)) * 0.035 : Math.sin(time * 1.6) * 0.012;
  parts.torso.position.y = 1.1 + bob;
  parts.torso.rotation.z = damp(parts.torso.rotation.z, moving ? Math.sin(walk) * 0.025 : 0, dt, 8);
  parts.torso.rotation.x = damp(parts.torso.rotation.x, aimFactor ? -0.055 : 0, dt, 8);
  parts.headGroup.rotation.y = damp(parts.headGroup.rotation.y, aimFactor ? 0 : Math.sin(time * 0.55) * 0.1, dt, 5);

  if (dead) {
    parts.torso.rotation.x = damp(parts.torso.rotation.x, -1.1, dt, 4);
  }

  // coat tails react to motion
  parts.tailL.rotation.x = damp(parts.tailL.rotation.x, 0.08 + Math.sin(walk * 0.9) * amp * 0.2, dt, 6);
  parts.tailR.rotation.x = damp(parts.tailR.rotation.x, 0.08 - Math.sin(walk * 0.9) * amp * 0.2, dt, 6);
}

export function setCowboyFlash(cowboy, amount, color = 0xff4626) {
  const { materials } = cowboy.parts;
  const intensity = amount * 1.2;
  materials.coat.emissive.setHex(color);
  materials.shirt.emissive.setHex(color);
  materials.skin.emissive.setHex(color);
  materials.coat.emissiveIntensity = intensity;
  materials.shirt.emissiveIntensity = intensity;
  materials.skin.emissiveIntensity = intensity;
}
