import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (min, max) => min + Math.random() * (max - min);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, dt, lambda) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function canvasTexture(width, height, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

export function makeSandTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rnd = mulberry32(8241);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const grain = rnd() * 18 - 9;
        const wave = Math.sin(x * 0.06 + Math.sin(y * 0.025) * 2.2) * 4;
        const blotch = Math.sin(x * 0.011 + 1.3) * Math.cos(y * 0.009) * 8;
        img.data[i] = 166 + grain + wave + blotch;
        img.data[i + 1] = 111 + grain * 0.65 + wave * 0.72 + blotch * 0.7;
        img.data[i + 2] = 73 + grain * 0.45 + wave * 0.4 + blotch * 0.45;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 600; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 0.5 + rnd() * 2.2;
      ctx.fillStyle = rnd() > 0.5 ? '#5d3925' : '#e0ad72';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [26, 26] });
}

export function makeWoodTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = mulberry32(923);
    ctx.fillStyle = '#6a4029';
    ctx.fillRect(0, 0, w, h);
    const plank = 32;
    for (let y = 0; y < h; y += plank) {
      const tone = 76 + rnd() * 28;
      ctx.fillStyle = `rgb(${tone + 25}, ${tone - 3}, ${tone - 31})`;
      ctx.fillRect(0, y + 1, w, plank - 2);
      ctx.fillStyle = 'rgba(28, 15, 8, 0.58)';
      ctx.fillRect(0, y, w, 1.5);
      ctx.fillStyle = 'rgba(247, 203, 145, 0.06)';
      ctx.fillRect(0, y + 2, w, 1);
      for (let i = 0; i < 14; i++) {
        const gy = y + 4 + rnd() * (plank - 8);
        ctx.strokeStyle = `rgba(38, 20, 11, ${0.07 + rnd() * 0.15})`;
        ctx.lineWidth = 0.5 + rnd();
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(w * 0.3, gy + rnd() * 3 - 1.5, w * 0.7, gy + rnd() * 3 - 1.5, w, gy + rnd() * 2 - 1);
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) {
        const kx = rnd() * w;
        const ky = y + 8 + rnd() * (plank - 16);
        ctx.strokeStyle = 'rgba(39, 21, 12, 0.3)';
        ctx.beginPath();
        ctx.ellipse(kx, ky, 2 + rnd() * 4, 1 + rnd() * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(21, 12, 7, 0.55)';
      ctx.beginPath();
      ctx.arc(rnd() * w, y + plank / 2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [2, 2] });
}

export function makeSignTexture(text, { bg = '#332016', fg = '#e7c281', sub = '', border = true } = {}) {
  return canvasTexture(512, 160, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, '#1e110b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    if (border) {
      ctx.strokeStyle = 'rgba(231, 194, 129, 0.55)';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeStyle = 'rgba(231, 194, 129, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(19, 19, w - 38, h - 38);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '58px Rye, Georgia, serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h * 0.5);
    if (sub) {
      ctx.shadowBlur = 0;
      ctx.font = '15px Oswald, Arial, sans-serif';
      ctx.fillStyle = 'rgba(231, 194, 129, 0.62)';
      ctx.fillText(sub, w / 2, h * 0.74);
    }
  });
}

export function makePosterTexture() {
  return canvasTexture(256, 340, (ctx, w, h) => {
    ctx.fillStyle = '#d6b57e';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.75);
    grad.addColorStop(0, 'rgba(120,67,28,0.02)');
    grad.addColorStop(1, 'rgba(57,28,10,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38200f';
    ctx.fillStyle = '#38200f';
    ctx.textAlign = 'center';
    ctx.font = '58px Rye, Georgia, serif';
    ctx.fillText('WANTED', w / 2, 64);
    ctx.font = '12px Oswald, Arial, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('DEAD OR ALIVE', w / 2, 84);
    ctx.strokeRect(20, 100, w - 40, 118);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(82, 175);
    ctx.bezierCurveTo(100, 125, 150, 128, 164, 154);
    ctx.bezierCurveTo(154, 144, 142, 150, 136, 165);
    ctx.lineTo(158, 175);
    ctx.lineTo(126, 181);
    ctx.bezierCurveTo(116, 204, 91, 205, 82, 189);
    ctx.closePath();
    ctx.fill();
    ctx.font = '23px Rye, Georgia, serif';
    ctx.fillText('THE MATRIARCH', w / 2, 246);
    ctx.font = '11px Oswald, Arial, sans-serif';
    ctx.fillText('MURDER · ARSON · STOCK THEFT', w / 2, 264);
    ctx.font = '39px Rye, Georgia, serif';
    ctx.fillText('$5,000', w / 2, 311);
  });
}

export function makeGlowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,245,214,0.95)');
    g.addColorStop(0.5, 'rgba(255,180,86,0.38)');
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeSmokeTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(86,65,54,0.62)');
    g.addColorStop(0.55, 'rgba(60,42,34,0.25)');
    g.addColorStop(1, 'rgba(40,28,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeSplatTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = mulberry32(511);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    for (let i = 0; i < 28; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = rnd() * 70;
      const rx = 16 + rnd() * 38;
      const ry = 10 + rnd() * 26;
      ctx.fillStyle = `rgba(52, 26, 15, ${0.03 + rnd() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * dist, Math.sin(angle) * dist, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 50 + rnd() * 52;
      ctx.fillStyle = 'rgba(55,28,15,0.22)';
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1 + rnd() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function makeShadowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(20,10,5,0.48)');
    g.addColorStop(0.55, 'rgba(20,10,5,0.25)');
    g.addColorStop(1, 'rgba(20,10,5,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function cylinderBetween(a, b, radius, material, radialSegments = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function addBox(parent, size, pos, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

export function addCylinder(parent, rTop, rBottom, height, segments, pos, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else if (!child.material.userData?.shared) child.material.dispose();
    }
  });
  object.removeFromParent();
}

export function srgb(hex) {
  return new THREE.Color(hex);
}

/**
 * Collapse static meshes into one draw call per material. Animated props must be
 * passed in `exclude` (or any of their ancestors) so they keep their own transform.
 */
export function mergeStaticMeshes(root, exclude = new Set()) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const originals = [];

  const isInsideExcluded = (object) => {
    let node = object;
    while (node) {
      if (exclude.has(node)) return true;
      node = node.parent;
    }
    return false;
  };

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    if (Array.isArray(object.material)) return;
    if (object.material.transparent && object.material.depthWrite === false && object.material.opacity < 0.5) return;
    if (isInsideExcluded(object)) return;
    const key = [
      object.material.uuid,
      object.castShadow ? 1 : 0,
      object.receiveShadow ? 1 : 0,
      object.renderOrder,
    ].join(':');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: object.material, castShadow: object.castShadow, receiveShadow: object.receiveShadow, renderOrder: object.renderOrder, geometries: [] };
      buckets.set(key, bucket);
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    bucket.geometries.push(geometry);
    originals.push(object);
  });

  for (const bucket of buckets.values()) {
    if (!bucket.geometries.length) continue;
    const merged = mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) geometry.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.renderOrder = bucket.renderOrder;
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  for (const object of originals) {
    object.removeFromParent();
  }
  return originals.length;
}
