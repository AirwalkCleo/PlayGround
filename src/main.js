import * as THREE from 'three';
import { createWorld } from './world.js';
import { createCowboy, animateCowboy, setCowboyFlash } from './player.js';
import { Dragon } from './dragon.js';
import { Effects } from './effects.js';
import { AudioManager } from './audio.js';
import { clamp, damp, rand, lerp, makeGlowTexture } from './utils.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game-canvas');
const hud = $('hud');
const startScreen = $('start-screen');
const pauseScreen = $('pause-screen');
const endScreen = $('end-screen');
const touchUI = $('touch-ui');
const loadingScreen = $('loading-screen');

const WAVES = [
  {
    label: 'WAVE I',
    title: 'THE FIRST BROOD',
    sub: 'They smell the horses from the mesa.',
    total: 3,
    maxAlive: 2,
    hp: 100,
    objective: 'Clear the skies over Dry Gulch',
  },
  {
    label: 'WAVE II',
    title: 'BLOOD ON THE WIND',
    sub: 'The sky answers with a second shadow.',
    total: 4,
    maxAlive: 2,
    hp: 118,
    objective: 'Hold the street. Break the second flight.',
  },
  {
    label: 'WAVE III',
    title: 'THE MATRIARCH',
    sub: 'She has come to collect what is hers.',
    total: 3,
    maxAlive: 3,
    hp: 108,
    objective: 'Put the Matriarch in the dirt',
  },
];

const isCoarse = window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 1024);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('error-screen').classList.remove('hidden');
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.25 : 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (isCoarse) renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 420);
camera.rotation.order = 'YXZ';

const world = createWorld(scene);
scene.userData.shadowTex = world.shadowTex;
if (isCoarse) {
  world.sun.shadow.mapSize.set(1024, 1024);
  world.sun.castShadow = false;
}

const cowboy = createCowboy();
scene.add(cowboy.group);
const effects = new Effects(scene);
const audio = new AudioManager();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
raycaster.far = 180;
const screenCenter = new THREE.Vector2(0, 0);
const glowMap = makeGlowTexture();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const tempDir = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const upVec = new THREE.Vector3(0, 1, 0);

const state = {
  mode: 'menu',
  wave: 0,
  waveConfig: null,
  waveLeft: 0,
  waveSpawned: 0,
  intermission: false,
  intermissionTimer: 0,
  spawnTimer: 0,
  score: 0,
  shots: 0,
  hits: 0,
  kills: 0,
  headshots: 0,
  elapsed: 0,
  deathTimer: 0,
  endTimer: 0,
  victory: false,
  boss: null,
  menuTime: 0,
  uiEpoch: 0,
};

const player = {
  position: new THREE.Vector3().copy(world.startPosition),
  velocity: new THREE.Vector3(),
  health: 100,
  maxHealth: 100,
  ammo: 6,
  maxAmmo: 6,
  dynamite: 2,
  maxDynamite: 3,
  reloading: false,
  reloadTimer: 0,
  reloadDuration: 1.15,
  autoReload: -1,
  shootCooldown: 0,
  dynamiteCooldown: 0,
  aiming: false,
  aimAssist: isCoarse,
  walkPhase: 0,
  moving: false,
  jumpY: 0,
  jumpVel: 0,
  grounded: true,
  shooting: 0,
  hurtFlash: 0,
  invuln: 0,
  dead: false,
  sprinting: false,
  dustTimer: 0,
};

let cameraYaw = 0;
let cameraPitch = -0.08;
let cameraDistance = 7.1;
let cameraShake = 0;
let aimFov = 62;
let targetDragon = null;
let draggingLook = false;
let dragMoved = false;
let suppressLockPause = false;
let bannerTimer = null;
let bannerHideTimer = null;
let toastTimer = null;
let toastHideTimer = null;
let endTimeout = null;

const dragons = [];
const projectiles = [];
const dynamites = [];
const menuDragons = [];
let menuDragonTime = 0;

const keys = {};
const touchMove = { x: 0, y: 0 };
let joystickPointer = null;
let lookPointer = null;
let lastLookX = 0;
let lastLookY = 0;

const gameApi = {
  player,
  spawnFireball,
  damagePlayer,
  onDragonRoar,
  onDragonBreath,
  onDragonClaw,
  onDragonImpact,
};

// ---------------------------------------------------------------- Utility
function angleLerp(current, target, dt, speed) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, dt * speed);
}

function formatScore(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setBanner(kicker, title, sub, duration = 3.4) {
  clearTimeout(bannerTimer);
  clearTimeout(bannerHideTimer);
  const banner = $('wave-banner');
  $('wave-banner-kicker').textContent = kicker;
  $('wave-banner-title').textContent = title;
  $('wave-banner-sub').textContent = sub;
  banner.classList.remove('hidden', 'out');
  bannerTimer = setTimeout(() => {
    banner.classList.add('out');
    bannerHideTimer = setTimeout(() => banner.classList.add('hidden'), 500);
  }, duration * 1000);
}

function showToast(text, duration = 2.4) {
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  const toast = $('toast');
  toast.textContent = text;
  toast.classList.remove('hidden', 'out');
  toastTimer = setTimeout(() => {
    toast.classList.add('out');
    toastHideTimer = setTimeout(() => toast.classList.add('hidden'), 420);
  }, duration * 1000);
}

function addKillFeed(text, accent = '') {
  const feed = $('kill-feed');
  const line = document.createElement('div');
  line.className = 'kill-line';
  line.innerHTML = `<span>${text}</span>${accent ? `<b>${accent}</b>` : ''}`;
  feed.appendChild(line);
  while (feed.children.length > 4) feed.firstElementChild.remove();
  setTimeout(() => {
    line.classList.add('out');
    setTimeout(() => line.remove(), 430);
  }, 3400);
}

function showDamageNumber(position, amount, crit = false) {
  const v = position.clone().project(camera);
  if (v.z > 1.05 || v.z < -1) return;
  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  const el = document.createElement('div');
  el.className = 'dmg-number' + (crit ? ' crit' : '');
  el.textContent = crit ? `HEAD ${amount}` : `${amount}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('damage-numbers').appendChild(el);
  setTimeout(() => el.remove(), 860);
}

function flashHitmarker(kill = false) {
  const el = $('hitmarker');
  el.classList.remove('show', 'kill');
  void el.offsetWidth;
  el.classList.add('show');
  if (kill) el.classList.add('kill');
}

function flashScreenDamage() {
  const el = $('damage-flash');
  el.classList.remove('hit');
  void el.offsetWidth;
  el.classList.add('hit');
}

function triggerHitFlash() {
  $('hit-flash').style.opacity = '0.55';
}

// ---------------------------------------------------------------- Menu dragons
function createMenuDragons() {
  for (const conf of [
    { variant: 'ember', centerX: 8, centerZ: -18, radius: 20, angle: -1.1, y: 18.5, scale: 1.5, speed: 0.055, phase: 0 },
    { variant: 'rust', centerX: 0, centerZ: -50, radius: 22, angle: -1.55, y: 31, scale: 2.15, speed: -0.035, phase: 2.1 },
  ]) {
    const d = new Dragon(scene, { variant: conf.variant, hp: 9999, angle: conf.angle });
    d.state = 'menu';
    d.group.scale.setScalar(conf.scale);
    d.healthGroup.visible = false;
    d.shadow.material.opacity = 0.16;
    d.userData = conf;
    d.group.position.set(
      conf.centerX + Math.cos(conf.angle) * conf.radius,
      conf.y,
      conf.centerZ + Math.sin(conf.angle) * conf.radius,
    );
    menuDragons.push(d);
  }
}

function updateMenuDragons(dt, time) {
  menuDragonTime += dt;
  for (let i = 0; i < menuDragons.length; i++) {
    const d = menuDragons[i];
    const conf = d.userData;
    const a = conf.angle + menuDragonTime * conf.speed;
    d.group.position.x = conf.centerX + Math.cos(a) * conf.radius;
    d.group.position.z = conf.centerZ + Math.sin(a) * conf.radius;
    d.group.position.y = conf.y + Math.sin(menuDragonTime * 0.55 + conf.phase) * 2.2;
    d.group.rotation.y = Math.PI - a + (conf.speed < 0 ? Math.PI : 0);
    d.group.rotation.x = Math.sin(menuDragonTime * 0.4 + i) * 0.08;
    d.group.rotation.z = Math.sin(menuDragonTime * 0.42 + i) * 0.12;
    const flap = Math.sin(menuDragonTime * 3.6 + conf.phase) * 0.62 + 0.08;
    d.wingRight.root.rotation.z = flap;
    d.wingLeft.root.rotation.z = -flap;
    d.shadow.position.set(d.group.position.x, 0.05, d.group.position.z);
    d.shadow.material.opacity = 0.12;
    d.shadow.scale.setScalar(1.7 * conf.scale);
  }
}

function removeMenuDragons() {
  for (const d of menuDragons) d.dispose();
  menuDragons.length = 0;
}

// ---------------------------------------------------------------- Camera
function snapCamera() {
  const pivot = tempVec.set(player.position.x, player.position.y + 2.62, player.position.z);
  const dir = tempDir.set(
    -Math.sin(cameraYaw) * Math.cos(cameraPitch),
    Math.sin(cameraPitch),
    -Math.cos(cameraYaw) * Math.cos(cameraPitch),
  );
  camera.position.copy(pivot).addScaledVector(dir, -cameraDistance);
  camera.position.x += Math.cos(cameraYaw) * 0.55;
  camera.position.z += -Math.sin(cameraYaw) * 0.55;
  camera.position.y = Math.max(camera.position.y, 1.15);
  camera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
}

function updateGameCamera(dt, time) {
  const pivot = tempVec.set(player.position.x, player.position.y + 2.62, player.position.z);
  const dir = tempDir.set(
    -Math.sin(cameraYaw) * Math.cos(cameraPitch),
    Math.sin(cameraPitch),
    -Math.cos(cameraYaw) * Math.cos(cameraPitch),
  );
  const desired = tempVec2.copy(pivot).addScaledVector(dir, -cameraDistance);
  desired.x += Math.cos(cameraYaw) * 0.55;
  desired.z += -Math.sin(cameraYaw) * 0.55;
  desired.y = Math.max(desired.y, 1.18);
  const follow = 1 - Math.exp(-dt * (state.mode === 'playing' ? 18 : 5));
  camera.position.lerp(desired, follow);

  // Walk bob and breathing sway
  const bobAmount = player.moving ? Math.sin(player.walkPhase * 2) * 0.018 : Math.sin(time * 1.4) * 0.007;
  const shakeX = (Math.sin(time * 74.3) * 0.5 + Math.sin(time * 31.7) * 0.5) * cameraShake;
  const shakeY = (Math.cos(time * 65.1) * 0.5 + Math.sin(time * 47.1) * 0.5) * cameraShake;
  cameraShake = Math.max(0, cameraShake - dt * 2.3);
  camera.position.y += bobAmount + shakeY * 0.14;
  camera.position.x += shakeX * 0.12;

  camera.rotation.set(
    cameraPitch + shakeY * 0.018,
    cameraYaw + shakeX * 0.014,
    Math.sin(player.walkPhase) * (player.moving ? 0.003 : 0) + shakeX * 0.01,
    'YXZ',
  );

  const targetFov = player.aiming ? 48 : (player.sprinting && player.moving ? 69 : 62);
  aimFov = damp(aimFov, targetFov, dt, 8);
  camera.fov = aimFov;
  camera.updateProjectionMatrix();
}

function updateMenuCamera(dt, time) {
  const t = time * 0.075;
  const x = 2.4 + Math.sin(t) * 1.0;
  const y = 6.9 + Math.sin(time * 0.18) * 0.2;
  const z = 41.5 - Math.cos(t) * 0.9;
  camera.position.lerp(tempVec.set(x, y, z), 1 - Math.exp(-dt * 2));
  const look = tempVec2.set(-1.0, 9.0, -30);
  camera.lookAt(look);
  if (camera.fov !== 58) {
    camera.fov = 58;
    camera.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- Input
function requestLock() {
  if (isCoarse) return;
  try {
    const promise = canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (promise?.catch) promise.catch(() => {
      try { canvas.requestPointerLock(); } catch {}
    });
  } catch {
    try { canvas.requestPointerLock(); } catch {}
  }
}

function releaseLock() {
  suppressLockPause = true;
  if (document.pointerLockElement) document.exitPointerLock?.();
  setTimeout(() => { suppressLockPause = false; }, 220);
}

function addLook(dx, dy, sensitivity = 0.0021) {
  cameraYaw -= dx * sensitivity;
  cameraPitch -= dy * sensitivity;
  cameraPitch = clamp(cameraPitch, -0.62, 0.27);
  while (cameraYaw > Math.PI) cameraYaw -= Math.PI * 2;
  while (cameraYaw < -Math.PI) cameraYaw += Math.PI * 2;
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state.mode === 'playing' && !suppressLockPause) {
    pauseGame();
  }
});

document.addEventListener('mousemove', (event) => {
  if (state.mode !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    addLook(event.movementX, event.movementY, player.aiming ? 0.0014 : 0.0021);
  } else if (draggingLook) {
    addLook(event.movementX || 0, event.movementY || 0, 0.0024);
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 1) dragMoved = true;
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') {
    if (state.mode !== 'playing') return;
    if (lookPointer !== null) return;
    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
    return;
  }
  if (state.mode !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    if (event.button === 0) fireWeapon();
    if (event.button === 2) player.aiming = true;
  } else {
    draggingLook = true;
    dragMoved = false;
    if (event.button === 2) player.aiming = true;
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') {
    if (lookPointer === event.pointerId) lookPointer = null;
    return;
  }
  if (!document.pointerLockElement && state.mode === 'playing' && !dragMoved && event.button === 0) {
    fireWeapon();
  }
  draggingLook = false;
  if (event.button === 2) player.aiming = false;
});

canvas.addEventListener('pointercancel', () => {
  draggingLook = false;
  lookPointer = null;
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || state.mode !== 'playing') return;
  if (lookPointer !== event.pointerId) return;
  const dx = event.clientX - lastLookX;
  const dy = event.clientY - lastLookY;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  addLook(dx * 1.15, dy * 1.15, 0.0031);
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
    return;
  }
  if (state.mode !== 'playing') return;
  keys[key] = true;
  if (key === 'r') beginReload();
  if (key === 'g') throwDynamite();
  if (key === 'm') toggleMute();
  if (key === ' ') {
    event.preventDefault();
    jump();
  }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame();
});

// Touch joystick
const joystick = $('joystick');
const joystickKnob = $('joystick-knob');
joystick?.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'playing') return;
  event.preventDefault();
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystick?.addEventListener('pointermove', (event) => {
  if (joystickPointer !== event.pointerId) return;
  event.preventDefault();
  updateJoystick(event);
});
function releaseJoystick(event) {
  if (joystickPointer !== event.pointerId) return;
  joystickPointer = null;
  touchMove.x = 0;
  touchMove.y = 0;
  joystickKnob.style.transform = 'translate(0px, 0px)';
}
joystick?.addEventListener('pointerup', releaseJoystick);
joystick?.addEventListener('pointercancel', releaseJoystick);

function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const max = rect.width * 0.34;
  const dist = Math.hypot(dx, dy);
  if (dist > max) {
    dx = (dx / dist) * max;
    dy = (dy / dist) * max;
  }
  touchMove.x = dx / max;
  touchMove.y = dy / max;
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

for (const btn of document.querySelectorAll('.touch-btn')) {
  btn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (state.mode !== 'playing') return;
    const action = btn.dataset.action;
    if (action === 'fire') fireWeapon();
    if (action === 'reload') beginReload();
    if (action === 'dynamite') throwDynamite();
  });
}

// ---------------------------------------------------------------- Game state
function resetPlayer() {
  player.position.copy(world.startPosition);
  player.velocity.set(0, 0, 0);
  player.health = player.maxHealth;
  player.ammo = player.maxAmmo;
  player.dynamite = 2;
  player.reloading = false;
  player.reloadTimer = 0;
  player.autoReload = -1;
  player.shootCooldown = 0;
  player.dynamiteCooldown = 0;
  player.aiming = false;
  player.walkPhase = 0;
  player.moving = false;
  player.jumpY = 0;
  player.jumpVel = 0;
  player.grounded = true;
  player.shooting = 0;
  player.hurtFlash = 0;
  player.invuln = 0;
  player.dead = false;
  player.sprinting = false;
  player.dustTimer = 0;
  cowboy.group.position.copy(player.position);
  cowboy.group.rotation.set(0, 0, 0);
  cameraYaw = 0;
  cameraPitch = -0.08;
  cameraShake = 0;
  aimFov = 62;
  keys.w = keys.a = keys.s = keys.d = keys.shift = false;
  touchMove.x = touchMove.y = 0;
  if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  setCowboyFlash(cowboy, 0);
}

function clearRunEntities() {
  for (const d of dragons) d.dispose();
  dragons.length = 0;
  for (const p of projectiles) p.group.removeFromParent(), p.trail?.removeFromParent(), disposeProjectile(p);
  projectiles.length = 0;
  for (const d of dynamites) d.group.removeFromParent(), disposeDynamite(d);
  dynamites.length = 0;
  effects.clear();
  state.boss = null;
  targetDragon = null;
}

function startGame() {
  audio.ensure();
  audio.click();
  clearTimeout(endTimeout);
  removeMenuDragons();
  clearRunEntities();
  resetPlayer();
  state.mode = 'playing';
  state.wave = 0;
  state.waveConfig = null;
  state.waveLeft = 0;
  state.waveSpawned = 0;
  state.intermission = false;
  state.intermissionTimer = 0;
  state.spawnTimer = 0;
  state.score = 0;
  state.shots = 0;
  state.hits = 0;
  state.kills = 0;
  state.headshots = 0;
  state.elapsed = 0;
  state.deathTimer = 0;
  state.endTimer = 0;
  state.victory = false;
  state.boss = null;

  startScreen.classList.add('fade-out');
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  endScreen.classList.remove('defeat');
  hud.classList.remove('hidden');
  $('kill-feed').innerHTML = '';
  $('damage-numbers').innerHTML = '';
  $('score').textContent = '$0';
  $('timer').textContent = '00:00';
  $('damage-flash').classList.remove('hit');

  if (isCoarse) {
    touchUI.classList.remove('hidden');
    touchUI.setAttribute('aria-hidden', 'false');
  } else {
    touchUI.classList.add('hidden');
  }

  snapCamera();
  updateHUD();
  beginWave(0);
  requestLock();
}

function beginWave(index) {
  state.wave = index;
  const cfg = WAVES[index];
  state.waveConfig = cfg;
  state.waveLeft = cfg.total;
  state.waveSpawned = 0;
  state.spawnTimer = 0.65;
  state.intermission = false;
  state.boss = null;
  setBanner(cfg.label, cfg.title, cfg.sub, 3.4);
  $('objective-text').textContent = cfg.objective;
  $('wave-label').textContent = cfg.label;
  document.querySelectorAll('#wave-pips i').forEach((el, i) => {
    el.classList.toggle('active', i === index);
    el.classList.toggle('done', i < index);
  });
  showToast(index === 2 ? 'THE AIR TURNS TO ASH. KILL THE MATRIARCH.' : 'DRAGONS INBOUND. HOLD THE STREET.', 3.2);
  audio.waveHorn();
  updateHUD();
}

function completeWave() {
  if (state.mode !== 'playing') return;
  clearProjectiles();
  if (state.wave >= WAVES.length - 1) {
    triggerVictory();
    return;
  }
  state.intermission = true;
  state.intermissionTimer = 5.2;
  player.health = Math.min(player.maxHealth, player.health + 22);
  player.dynamite = Math.min(player.maxDynamite, player.dynamite + 1);
  player.ammo = player.maxAmmo;
  state.score += 250;
  setBanner('THE SKY CLEARS', 'CATCH YOUR BREATH', 'Reload. Patch up. They will come again.', 3.2);
  showToast('WAVE CLEARED  ·  +$250 BOUNTY  ·  GRIT RESTORED', 3.4);
  addKillFeed('WAVE CLEARED', '+$250');
  updateHUD();
}

function triggerVictory() {
  state.mode = 'victory';
  state.endTimer = 0;
  state.victory = true;
  player.aiming = false;
  releaseLock();
  touchUI.classList.add('hidden');
  setBanner('THE GULCH STANDS', 'BROOD BROKEN', 'Not a wing left in the sky.', 3.2);
  state.score += 1200;
  audio.victory();
  updateHUD();
  endTimeout = setTimeout(() => showEnd(true), 3200);
}

function triggerDefeat() {
  if (state.mode !== 'playing') return;
  state.mode = 'dying';
  state.deathTimer = 0;
  player.dead = true;
  player.aiming = false;
  player.health = 0;
  audio.defeat();
  touchUI.classList.add('hidden');
  releaseLock();
  clearProjectiles();
  showToast('THE WIND TAKES YOU', 2.4);
  endTimeout = setTimeout(() => showEnd(false), 2300);
}

function showEnd(victory) {
  if (state.mode === 'over') return;
  state.mode = 'over';
  state.victory = victory;
  hud.classList.add('hidden');
  touchUI.classList.add('hidden');
  const accuracy = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
  $('end-kicker').textContent = victory ? 'THE GULCH STANDS' : 'THE GULCH FALLS';
  $('end-title').textContent = victory ? 'BROOD BROKEN' : 'ASH ON THE WIND';
  $('end-copy').textContent = victory
    ? 'The last of the Matriarch’s line falls into the dust. Dry Gulch will sing about this one for a hundred years.'
    : 'The Matriarch’s shadow swallows the street. They will find your hat in the dust come morning.';
  $('end-score').textContent = formatScore(state.score);
  $('end-time').textContent = formatTime(state.elapsed);
  $('end-accuracy').textContent = `${accuracy}%`;
  endScreen.classList.toggle('defeat', !victory);
  endScreen.classList.remove('hidden');
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  player.aiming = false;
  draggingLook = false;
  touchUI.classList.add('hidden');
  pauseScreen.classList.remove('hidden');
  releaseLock();
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  audio.ensure();
  audio.click();
  state.mode = 'playing';
  pauseScreen.classList.add('hidden');
  if (isCoarse) {
    touchUI.classList.remove('hidden');
    touchUI.setAttribute('aria-hidden', 'false');
  }
  requestLock();
}

// ---------------------------------------------------------------- Combat
function fireWeapon() {
  if (state.mode !== 'playing' || player.reloading || player.dead) return;
  if (player.shootCooldown > 0) return;
  if (player.ammo <= 0) {
    audio.dryFire();
    beginReload();
    return;
  }

  player.ammo--;
  player.shootCooldown = 0.23;
  player.shooting = 0.17;
  player.shootTime = 0.05;
  state.shots++;
  audio.shot();
  cameraShake = Math.max(cameraShake, 0.13);
  const crosshair = $('crosshair');
  crosshair.classList.add('recoil');
  setTimeout(() => crosshair.classList.remove('recoil'), 95);
  triggerHitFlash();

  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(screenCenter, camera);
  const hitMeshes = [];
  for (const d of dragons) {
    if (d.alive && !d.dying) {
      for (const mesh of d.hitMeshes) {
        if (mesh.visible) hitMeshes.push(mesh);
      }
    }
  }
  const intersections = raycaster.intersectObjects(hitMeshes, false);
  let hit = intersections.length ? intersections[0] : null;
  let hitDragon = null;
  let hitPart = 'body';

  const cameraDir = camera.getWorldDirection(tempDir).clone();
  if (hit) {
    const mesh = hit.object;
    hitDragon = mesh.userData.dragon;
    hitPart = mesh.userData.part || 'body';
  } else {
    // Forgiving aim assist for touch and a subtle nudge for controllers/mouse.
    const threshold = isCoarse ? Math.cos(THREE.MathUtils.degToRad(11)) : Math.cos(THREE.MathUtils.degToRad(4.2));
    let best = threshold;
    for (const d of dragons) {
      if (!d.alive || d.dying) continue;
      const to = d.center.sub(camera.position);
      const dist = to.length();
      if (dist > 120) continue;
      to.normalize();
      const dot = to.dot(cameraDir);
      if (dot > best) {
        best = dot;
        hitDragon = d;
        hitPart = 'body';
        hit = { point: d.center.clone(), distance: dist };
      }
    }
  }

  const muzzlePos = new THREE.Vector3();
  cowboy.parts.muzzle.getWorldPosition(muzzlePos);
  const gunDir = cameraDir.clone();

  if (hitDragon && hit) {
    const damage = hitDragon.takeDamage(34, hitPart);
    if (damage > 0) {
      state.hits++;
      if (hitPart === 'head') state.headshots++;
      audio.hit(hitPart === 'head');
      effects.impact(hit.point, hitPart === 'head' ? 0xffd087 : 0xffa24d, hitPart === 'head' ? 11 : 7);
      showDamageNumber(hit.point.clone().add(new THREE.Vector3(0, 0.32, 0)), damage, hitPart === 'head');
      flashHitmarker(false);
      if (hitPart === 'head') showToast('HEADSHOT  ·  DOUBLE BOUNTY', 1.1);
      if (!hitDragon.alive) flashHitmarker(true);
    }
    effects.tracer(muzzlePos, hit.point, 0xffd89a);
  } else {
    effects.tracer(muzzlePos, camera.position.clone().addScaledVector(cameraDir, 130), 0xffd89a);
  }

  effects.muzzle(muzzlePos, gunDir);
  if (player.ammo <= 0) player.autoReload = 0.45;

  // cylinder flick
  cowboy.parts.cylinder.rotation.x += 0.65;
  updateHUD();
}

function beginReload() {
  if (state.mode !== 'playing' || player.reloading || player.ammo === player.maxAmmo) return;
  player.reloading = true;
  player.reloadTimer = 0;
  player.autoReload = -1;
  audio.reload();
  updateHUD();
}

function throwDynamite() {
  if (state.mode !== 'playing' || player.dynamite <= 0 || player.dynamiteCooldown > 0 || player.dead) return;
  player.dynamite--;
  player.dynamiteCooldown = 0.8;
  audio.dynamiteFuse();
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a2419, roughness: 0.85 });
  const band = new THREE.MeshStandardMaterial({ color: 0xcba267, roughness: 0.75 });
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.42, 7), dark);
    stick.position.set((i - 1) * 0.075, (i === 1 ? 0.035 : 0), 0);
    stick.rotation.z = (i - 1) * 0.06;
    group.add(stick);
  }
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8), band);
  tie.position.y = 0.04;
  group.add(tie);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), band);
  fuse.position.set(0.06, 0.24, 0);
  fuse.rotation.z = -0.35;
  group.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color: 0xffbd63, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  spark.position.set(0.12, 0.35, 0);
  spark.scale.set(0.38, 0.38, 1);
  group.add(spark);
  group.position.copy(player.position).add(new THREE.Vector3(0, 1.35, 0));
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const startPos = group.position.clone();
  group.position.addScaledVector(dir, 0.7);
  scene.add(group);
  dynamites.push({
    group,
    spark,
    velocity: dir.multiplyScalar(14).add(new THREE.Vector3(0, 5.1, 0)),
    fuse: 1.35,
    landed: false,
    startPos,
  });
  showToast('DYNAMITE LIT  ·  GET CLEAR', 1.2);
  updateHUD();
}

function spawnFireball(origin, target, damage = 16, scale = 1, boss = false) {
  if (state.mode !== 'playing') return;
  const dir = target.clone().sub(origin).normalize();
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24 * scale, 1),
    new THREE.MeshBasicMaterial({ color: boss ? 0xff5d1e : 0xff7d28, transparent: true, opacity: 0.96 }),
  );
  group.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color: boss ? 0xff5b1d : 0xff9e3d,
    transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(2.1 * scale, 2.1 * scale, 1);
  group.add(glow);
  group.position.copy(origin);
  scene.add(group);
  projectiles.push({
    group,
    core,
    glow,
    velocity: dir.multiplyScalar(boss ? 28 : 24),
    damage,
    scale,
    life: 5.5,
    trailTimer: 0,
    boss,
  });
  effects.fireball(origin, scale);
  audio.fireWhoosh();
}

function clearProjectiles() {
  for (const p of projectiles) {
    disposeProjectile(p);
    p.group.removeFromParent();
  }
  projectiles.length = 0;
}

function disposeProjectile(p) {
  p.group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

function disposeDynamite(d) {
  d.group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

function explodeDynamite(d) {
  const pos = d.group.position.clone();
  pos.y = Math.max(0.32, pos.y);
  effects.explosion(pos, 1.25, false);
  effects.dragonDeath(pos, false);
  audio.explosion(false);
  cameraShake = Math.max(cameraShake, 0.65);
  world.addScorch(pos, 1.8);
  for (const dragon of dragons) {
    if (!dragon.alive || dragon.dying) continue;
    const dist = dragon.center.distanceTo(pos);
    if (dist < 10.5) {
      const damage = Math.round(120 * (1 - dist / 13.5));
      const dealt = dragon.takeDamage(damage, 'body');
      if (dealt) showDamageNumber(dragon.center, dealt, false);
    }
  }
  // Big booms singe the gunslinger's boots a little.
  const selfDist = player.position.distanceTo(pos);
  if (selfDist < 4.3 && state.mode === 'playing') damagePlayer(Math.round(12 * (1 - selfDist / 5.2)), null, true);
}

function damagePlayer(amount, source = null, selfDamage = false) {
  if (state.mode !== 'playing' || player.dead) return;
  if (player.invuln > 0 && !selfDamage) return;
  player.health = Math.max(0, player.health - amount);
  player.invuln = 0.65;
  player.hurtFlash = 0.2;
  cameraShake = Math.max(cameraShake, 0.42);
  audio.hurt();
  flashScreenDamage();
  updateHUD();
  if (source === null && !selfDamage) showToast('MIND THE BLAST RADIUS', 1.5);
  if (player.health <= 0) triggerDefeat();
}

// ---------------------------------------------------------------- Dragon events
function spawnDragonForWave() {
  const cfg = state.waveConfig;
  const isBoss = state.wave === 2 && state.waveSpawned === 0;
  const variant = state.wave === 0 ? 'rust' : (state.wave === 1 ? (Math.random() > 0.45 ? 'ash' : 'ember') : 'ash');
  const d = new Dragon(scene, {
    boss: isBoss,
    variant,
    hp: isBoss ? 620 : cfg.hp + (state.wave === 2 ? 25 : 0),
    angle: state.waveSpawned === 0 ? -Math.PI / 2 : rand(0, Math.PI * 2),
    spawnRadius: state.waveSpawned === 0 && state.wave === 0 ? 37 : undefined,
    spawnY: state.waveSpawned === 0 && state.wave === 0 ? 19 : undefined,
  });
  d.onKilled = handleDragonKilled;
  dragons.push(d);
  state.waveSpawned++;
  state.spawnTimer = isBoss ? 1.5 : rand(1.5, 2.7);
  if (isBoss) {
    state.boss = d;
    setBanner('THE SKY DARKENS', 'THE MATRIARCH', 'She is older than the town. She is not afraid of you.', 3.6);
    showToast('KILL THE MATRIARCH', 3);
  }
  setTimeout(() => {
    if (state.mode === 'playing') audio.roar(isBoss);
  }, isBoss ? 100 : 550);
  updateHUD();
}

function handleDragonKilled(dragon) {
  state.kills++;
  state.waveLeft = Math.max(0, state.waveLeft - 1);
  const boss = dragon.isBoss;
  if (boss) state.boss = null;
  effects.dragonDeath(dragon.center, boss);
  effects.explosion(dragon.center, boss ? 1.8 : 0.9, boss);
  audio.explosion(boss);
  addKillFeed(boss ? 'THE MATRIARCH FALLS' : 'WYVERN DOWN', boss ? '+$1,200' : '+$150');
  if (boss) showToast('THE MATRIARCH IS DOWN  ·  FINISH THE BROOD', 3);
  updateHUD();
  if (state.waveLeft <= 0) {
    if (state.wave >= WAVES.length - 1) {
      endTimeout = setTimeout(() => {
        if (state.mode === 'playing') triggerVictory();
      }, 1900);
    } else {
      endTimeout = setTimeout(() => {
        if (state.mode === 'playing') completeWave();
      }, 600);
    }
  }
}

function onDragonImpact(dragon) {
  effects.explosion(dragon.group.position.clone(), dragon.isBoss ? 2.4 : 1.3, dragon.isBoss);
  effects.dragonDeath(dragon.group.position.clone(), dragon.isBoss);
  audio.explosion(dragon.isBoss);
  cameraShake = Math.max(cameraShake, dragon.isBoss ? 0.8 : 0.35);
  world.addScorch(dragon.group.position, dragon.isBoss ? 2.5 : 1.3);
  showToast(dragon.isBoss ? 'THE MATRIARCH HITS THE DIRT' : 'WYVERN DOWN', 1.8);
}

function onDragonRoar(dragon, extra = false) {
  if (state.mode !== 'playing') return;
  audio.roar(dragon.isBoss || extra);
}

function onDragonBreath(dragon) {
  effects.fireball(dragon.mouth.getWorldPosition(new THREE.Vector3()), dragon.isBoss ? 1.4 : 1);
}

function onDragonClaw(dragon) {
  cameraShake = Math.max(cameraShake, 0.6);
  effects.impact(player.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xc54626, 10);
}

// ---------------------------------------------------------------- Update
function updatePlayer(dt, time) {
  if (player.dead) return;
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.dynamiteCooldown = Math.max(0, player.dynamiteCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  player.shooting = Math.max(0, player.shooting - dt);
  if (player.autoReload >= 0) {
    player.autoReload -= dt;
    if (player.autoReload <= 0) {
      player.autoReload = -1;
      beginReload();
    }
  }

  if (player.reloading) {
    player.reloadTimer += dt;
    if (player.reloadTimer >= player.reloadDuration) {
      player.reloading = false;
      player.reloadTimer = 0;
      player.ammo = player.maxAmmo;
      showToast('SIX IN THE CYLINDER', 1.1);
      updateHUD();
    }
  }

  const forwardInput = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  const strafeInput = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let moveX = touchMove.x;
  let moveZ = -touchMove.y;
  const analog = Math.hypot(moveX, moveZ);
  if (analog > 0.12) {
    moveZ = -touchMove.y;
  } else {
    moveX = 0;
    moveZ = 0;
  }

  if (forwardInput || strafeInput) {
    moveX = strafeInput;
    moveZ = forwardInput;
  }
  const moveLen = Math.hypot(moveX, moveZ);
  const analogSprint = analog > 0.86;
  const wantSprint = (keys.shift || analogSprint) && moveLen > 0.1;
  player.sprinting = wantSprint;
  const speed = wantSprint ? 9.1 : 5.55;
  const moving = moveLen > 0.08;

  const fwd = tempVec.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = tempVec2.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  const targetVel = new THREE.Vector3();
  if (moving) {
    const normX = moveX / Math.max(1, moveLen);
    const normZ = moveZ / Math.max(1, moveLen);
    targetVel.addScaledVector(right, normX).addScaledVector(fwd, normZ).normalize().multiplyScalar(speed);
    player.walkPhase += dt * (wantSprint ? 12.5 : 9.4);
  }
  const control = moving ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 18);
  player.velocity.x = lerp(player.velocity.x, targetVel.x, control);
  player.velocity.z = lerp(player.velocity.z, targetVel.z, control);
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.moving = moving && Math.hypot(player.velocity.x, player.velocity.z) > 0.2;

  resolveCollisions(player.position);
  player.position.x = clamp(player.position.x, -64, 64);
  player.position.z = clamp(player.position.z, -62, 64);

  // Jumping
  if (!player.grounded) {
    player.jumpVel -= 19 * dt;
    player.jumpY += player.jumpVel * dt;
    if (player.jumpY <= 0) {
      player.jumpY = 0;
      player.jumpVel = 0;
      player.grounded = true;
      effects.dust(player.position, 0.8);
    }
  }
  cowboy.group.position.set(player.position.x, player.jumpY, player.position.z);

  // Face aim direction when aiming or firing; otherwise face direction of travel.
  let targetYaw = cameraYaw;
  if (player.moving && !player.aiming && player.shooting <= 0) {
    targetYaw = Math.atan2(-player.velocity.x, -player.velocity.z);
  }
  cowboy.group.rotation.y = angleLerp(cowboy.group.rotation.y, targetYaw, dt, player.aiming ? 18 : 10);

  const aim = player.aiming || player.shooting > 0;
  animateCowboy(cowboy, dt, {
    moving: player.moving,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    aiming: aim,
    shooting: player.shooting > 0,
    dead: player.dead,
    time,
    walkPhase: player.walkPhase,
  });
  setCowboyFlash(cowboy, player.hurtFlash > 0 ? clamp(player.hurtFlash / 0.2, 0, 1) : 0, 0xff3b20);

  // Foot dust
  if (player.moving && player.grounded) {
    player.dustTimer -= dt;
    if (player.dustTimer <= 0) {
      player.dustTimer = wantSprint ? 0.15 : 0.29;
      effects.dust(player.position.clone().add(new THREE.Vector3(rand(-0.14, 0.14), 0, rand(-0.14, 0.14))), 0.55);
    }
  }

  // Slow health regen after danger
  if (player.invuln <= 0 && player.health > 0 && player.health < 45) {
    player.health = Math.min(45, player.health + dt * 1.1);
  }

  updateAimTarget();
}

function jump() {
  if (!player.grounded || player.dead) return;
  player.grounded = false;
  player.jumpVel = 6.25;
  effects.dust(player.position, 0.7);
}

function resolveCollisions(pos) {
  const radius = 0.43;
  for (const c of world.colliders) {
    if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
      const dl = pos.x - (c.minX - radius);
      const dr = (c.maxX + radius) - pos.x;
      const dt = pos.z - (c.minZ - radius);
      const db = (c.maxZ + radius) - pos.z;
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) pos.x = c.minX - radius;
      else if (min === dr) pos.x = c.maxX + radius;
      else if (min === dt) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}

function updateAimTarget() {
  camera.updateMatrixWorld();
  const dir = camera.getWorldDirection(tempDir);
  let bestDot = isCoarse ? Math.cos(THREE.MathUtils.degToRad(13)) : Math.cos(THREE.MathUtils.degToRad(6));
  let found = null;
  for (const d of dragons) {
    if (!d.alive || d.dying) continue;
    const to = d.center.sub(camera.position).normalize();
    const dot = to.dot(dir);
    if (dot > bestDot && d.group.position.distanceTo(camera.position) < 125) {
      bestDot = dot;
      found = d;
    }
  }
  targetDragon = found;
  const crosshair = $('crosshair');
  crosshair.classList.toggle('target', !!found);
  crosshair.classList.toggle('aiming', player.aiming);
  const label = $('target-label');
  if (found) {
    label.classList.remove('hidden');
    label.innerHTML = found.isBoss ? 'THE MATRIARCH <span>LETHAL</span>' : `${found.variant.toUpperCase()} WYVERN <span>IN RANGE</span>`;
  } else {
    label.classList.add('hidden');
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.group.position.addScaledVector(p.velocity, dt);
    p.group.rotation.x += dt * 5;
    p.group.rotation.z += dt * 3.3;
    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.035;
      effects.addSprite(
        glowMap,
        p.group.position.clone(),
        p.boss ? 0xff5a1d : 0xff8a2f,
        0.55 * p.scale,
        { life: 0.42, drag: 1.8, gravity: 0.2, opacity: 0.55 },
      );
    }
    let remove = false;
    const target = player.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    if (state.mode === 'playing' && !player.dead && p.group.position.distanceTo(target) < 1.08 * p.scale) {
      damagePlayer(p.damage, p);
      effects.explosion(p.group.position.clone(), p.scale, p.boss);
      audio.explosion(false);
      remove = true;
    }
    if (p.group.position.y <= 0.24) {
      effects.explosion(p.group.position.clone(), p.scale * 0.9, p.boss);
      world.addScorch(p.group.position, 0.9);
      audio.explosion(false);
      remove = true;
    }
    if (p.life <= 0 || p.group.position.length() > 160) remove = true;
    if (remove) {
      disposeProjectile(p);
      p.group.removeFromParent();
      projectiles.splice(i, 1);
    }
  }
}

function updateDynamites(dt) {
  for (let i = dynamites.length - 1; i >= 0; i--) {
    const d = dynamites[i];
    d.fuse -= dt;
    d.velocity.y -= 18.5 * dt;
    d.group.position.addScaledVector(d.velocity, dt);
    d.group.rotation.x += dt * 8;
    d.group.rotation.z += dt * 4;
    d.spark.material.opacity = 0.5 + Math.random() * 0.5;
    if (d.group.position.y <= 0.15) {
      d.group.position.y = 0.15;
      if (!d.landed) {
        d.landed = true;
        effects.dust(d.group.position, 0.8);
      }
      d.velocity.y *= -0.32;
      d.velocity.x *= 0.62;
      d.velocity.z *= 0.62;
      if (Math.abs(d.velocity.y) < 0.7) d.velocity.y = 0;
    }
    if (d.fuse <= 0) {
      explodeDynamite(d);
      disposeDynamite(d);
      d.group.removeFromParent();
      dynamites.splice(i, 1);
    }
  }
}

function updateSimulation(dt, time) {
  for (let i = dragons.length - 1; i >= 0; i--) {
    const d = dragons[i];
    d.update(dt, time, gameApi, camera);
    if (d.quit) dragons.splice(i, 1);
  }
  updateProjectiles(dt);
  updateDynamites(dt);

  const alive = dragons.filter((d) => d.alive && !d.dying).length;
  if (state.mode === 'playing' && !state.intermission) {
    state.spawnTimer -= dt;
    if (state.waveLeft > 0 && state.waveSpawned < state.waveConfig.total && alive < state.waveConfig.maxAlive && state.spawnTimer <= 0) {
      spawnDragonForWave();
    }
  }
  if (state.intermission) {
    state.intermissionTimer -= dt;
    if (state.intermissionTimer <= 0) {
      beginWave(state.wave + 1);
    }
  }
}

function updateHUD() {
  if (state.mode === 'menu') return;
  const health = Math.ceil(player.health);
  $('health-number').textContent = health;
  $('health-fill').style.width = `${clamp(health, 0, 100)}%`;
  $('health-fill').classList.toggle('low', health <= 30);
  $('health-state').textContent = health > 70 ? 'STEADY' : health > 35 ? 'BLOODIED' : health > 0 ? 'GUT SHOT' : 'DEAD';
  $('score').textContent = formatScore(state.score);
  $('timer').textContent = formatTime(state.elapsed);
  $('ammo-count').textContent = player.ammo;
  $('dynamite-count').textContent = player.dynamite;
  const bullets = document.querySelectorAll('#cylinder i');
  bullets.forEach((bullet, i) => bullet.classList.toggle('spent', i >= player.ammo));
  $('reload-panel').classList.toggle('hidden', !player.reloading);
  if (player.reloading) $('reload-fill').style.width = `${clamp(player.reloadTimer / player.reloadDuration, 0, 1) * 100}%`;
  const count = state.waveConfig ? Math.max(0, state.waveLeft) : 0;
  $('enemy-count').textContent = state.intermission
    ? 'THE SKY CLEARS'
    : `${count} ${count === 1 ? (state.boss ? 'MATRIARCH' : 'WYVERN') : 'DRAGONS'}`;
  $('wave-label').textContent = state.waveConfig?.label || 'WAVE I';
  const bossWrap = $('boss-wrap');
  const boss = state.boss;
  if (boss && boss.alive && !boss.dying && !state.intermission) {
    bossWrap.classList.remove('hidden');
    const pct = Math.ceil((boss.hp / boss.maxHp) * 100);
    $('boss-fill').style.width = `${pct}%`;
    $('boss-percent').textContent = `${pct}%`;
  } else {
    bossWrap.classList.add('hidden');
  }
}

// ---------------------------------------------------------------- Loop
function updatePlaying(dt, time) {
  state.elapsed += dt;
  updatePlayer(dt, time);
  updateSimulation(dt, time);
  updateHUD();
  if ($('hit-flash').style.opacity !== '0') {
    $('hit-flash').style.opacity = String(Math.max(0, parseFloat($('hit-flash').style.opacity) - dt * 5.5));
  }
  if (player.hurtFlash <= 0) setCowboyFlash(cowboy, 0);
}

function updateCinematic(dt, time) {
  updateSimulation(dt, time);
  state.deathTimer += dt;
  if (player.dead) {
    const targetRot = cowboy.group.rotation;
    cowboy.group.rotation.z = damp(cowboy.group.rotation.z, 1.25, dt, 2.2);
  }
  const angle = state.deathTimer * 0.12;
  const radius = 8.5;
  const center = player.position;
  camera.position.x = center.x + Math.sin(angle) * radius;
  camera.position.z = center.z + Math.cos(angle) * radius;
  camera.position.y = 3.3 - Math.min(1.4, state.deathTimer * 0.25);
  camera.lookAt(center.x, 1.1, center.z);
  camera.fov = damp(camera.fov, 58, dt, 2);
  camera.updateProjectionMatrix();
  updateHUD();
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (state.mode === 'menu') {
    updateMenuDragons(dt, time);
    updateMenuCamera(dt, time);
    world.update(dt, time);
    effects.update(dt);
  } else if (state.mode === 'playing') {
    updatePlaying(dt, time);
    updateGameCamera(dt, time);
    world.update(dt, time);
    effects.update(dt);
  } else if (state.mode === 'paused') {
    // Render a frozen frame while the menu is up.
  } else if (state.mode === 'dying' || state.mode === 'victory') {
    updateCinematic(dt, time);
    world.update(dt, time);
    effects.update(dt);
  } else if (state.mode === 'over') {
    world.update(dt * 0.35, time);
    effects.update(dt);
  }

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- UI events
$('start-btn').addEventListener('click', () => startGame());
$('pause-btn').addEventListener('click', () => pauseGame());
$('resume-btn').addEventListener('click', () => resumeGame());
$('restart-btn').addEventListener('click', () => {
  audio.ensure();
  startGame();
});
$('again-btn').addEventListener('click', () => startGame());
$('mute-btn').addEventListener('click', () => toggleMute());
$('pause-mute-btn').addEventListener('click', () => toggleMute());
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function toggleMute() {
  const muted = audio.toggleMuted();
  document.querySelectorAll('#mute-btn').forEach((el) => el.classList.toggle('muted', muted));
  $('pause-mute-btn').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  if (!muted) audio.ensure();
}

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'm') {
    if (state.mode !== 'playing') toggleMute();
  }
});

// Prevent page scroll / zoom gestures on the play surface.
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('touchmove', (event) => {
  if (state.mode === 'playing' && event.target === canvas) event.preventDefault();
}, { passive: false });

// ---------------------------------------------------------------- Boot
createMenuDragons();
snapCamera();
camera.position.set(10.5, 9.4, 47.5);
camera.lookAt(-1.8, 3.9, -18);
camera.fov = 55;
camera.updateProjectionMatrix();
renderer.setAnimationLoop(loop);
setTimeout(() => loadingScreen.classList.add('gone'), 140);
setTimeout(() => loadingScreen.classList.add('hidden'), 620);

// Expose a small debug/read surface for automated checks.
window.__DRY_GULCH__ = {
  get state() { return state; },
  get player() { return player; },
  get dragons() { return dragons; },
  get camera() { return camera; },
  get scene() { return scene; },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  fire: fireWeapon,
  version: '1.0.0',
};
