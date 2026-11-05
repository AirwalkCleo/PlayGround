import * as THREE from 'three';
import { makeGlowTexture, makeSmokeTexture, rand } from './utils.js';

const GLOW = makeGlowTexture();
const SMOKE = makeSmokeTexture();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.rings = [];
    this.lights = [];
    this.lowQuality = window.matchMedia('(pointer: coarse)').matches;
    this.flashLight = new THREE.PointLight(0xffb15b, 0, 18, 2);
    this.flashLight.castShadow = false;
    scene.add(this.flashLight);
    this.flashLightLife = 0;
  }

  addSprite(texture, position, color, scale, opts = {}) {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(scale, scale, 1);
    this.scene.add(sprite);
    this.particles.push({
      sprite,
      vel: opts.vel || new THREE.Vector3(),
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 0,
      life: opts.life ?? 0.6,
      maxLife: opts.life ?? 0.6,
      grow: opts.grow ?? 1,
      fade: opts.fade ?? 1,
      baseOpacity: opts.opacity ?? 1,
      spin: opts.spin || 0,
      texture: opts.textureName || 'glow',
    });
    return sprite;
  }

  muzzle(position, direction) {
    const d = direction ? direction.clone().normalize() : new THREE.Vector3(0, 0, -1);
    const p = position.clone().addScaledVector(d, 0.15);
    const flash = this.addSprite(GLOW, p, 0xffc776, 0.85, { life: 0.08, grow: 1.8 });
    const core = this.addSprite(GLOW, p, 0xfff3cf, 0.28, { life: 0.05, grow: 1.1 });
    core.material.blending = THREE.AdditiveBlending;
    for (let i = 0; i < 4; i++) {
      const vel = d.clone().multiplyScalar(rand(2, 5)).add(new THREE.Vector3(rand(-1, 1), rand(-0.3, 0.8), rand(-1, 1)));
      this.addSprite(GLOW, p, 0xffae4c, rand(0.08, 0.16), { life: rand(0.1, 0.2), vel, gravity: -3, drag: 1.5 });
    }
    this.flashLight.position.copy(p);
    this.flashLight.intensity = 3.2;
    this.flashLightLife = 0.06;
    return flash;
  }

  tracer(start, end, color = 0xffd59a) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 10;
    this.scene.add(line);
    this.tracers.push({ line, life: 0.085, maxLife: 0.085 });
  }

  impact(position, color = 0xffa54d, count = 7) {
    const p = position.clone();
    this.addSprite(GLOW, p, color, 0.45, { life: 0.16, grow: 2.3 });
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3(rand(-4.5, 4.5), rand(-0.5, 5.5), rand(-4.5, 4.5));
      this.addSprite(GLOW, p, i % 3 ? 0xffa345 : 0xffe0a5, rand(0.05, 0.12), {
        life: rand(0.3, 0.68), vel, gravity: -8, drag: 1.2,
      });
    }
    for (let i = 0; i < 2; i++) {
      this.addSprite(SMOKE, p, 0x5f4434, rand(0.18, 0.35), {
        life: rand(0.4, 0.8), vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.3, 0.9), rand(-0.4, 0.4)), grow: -0.2, additive: false, opacity: 0.45,
      });
    }
  }

  dust(position, scale = 1) {
    for (let i = 0; i < 4; i++) {
      this.addSprite(SMOKE, position.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), 0xa57a58, rand(0.28, 0.5) * scale, {
        life: rand(0.5, 1.0), vel: new THREE.Vector3(rand(-0.6, 0.6), rand(0.1, 0.45), rand(-0.6, 0.6)),
        gravity: 0.1, drag: 2.2, grow: 0.5, additive: false, opacity: 0.22,
      });
    }
  }

  fireball(position, scale = 1) {
    this.addSprite(GLOW, position, 0xff6a22, 1.65 * scale, { life: 0.32, grow: 0.5 });
    this.addSprite(GLOW, position, 0xffd37a, 0.72 * scale, { life: 0.2, grow: 0.9 });
    this.flashLight.position.copy(position);
    this.flashLight.intensity = 2.1;
    this.flashLightLife = 0.06;
  }

  explosion(position, scale = 1, boss = false) {
    const p = position.clone();
    p.y = Math.max(p.y, 0.4);
    const count = this.lowQuality ? 0.55 : 1;
    this.addSprite(GLOW, p, boss ? 0xff6b22 : 0xff9b3c, 1.8 * scale, { life: 0.22, grow: 4.2 });
    this.addSprite(GLOW, p, 0xfff2c0, 0.8 * scale, { life: 0.15, grow: 5.5 });
    this.flashLight.position.copy(p);
    this.flashLight.intensity = scale * 9;
    this.flashLightLife = 0.45;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.58, 40),
      new THREE.MeshBasicMaterial({ color: 0xffc784, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(p);
    ring.position.y = 0.08;
    this.scene.add(ring);
    this.rings.push({ ring, life: 0.65, maxLife: 0.65, scale: 8 * scale });

    const emberCount = Math.round((boss ? 38 : 22) * count);
    for (let i = 0; i < emberCount; i++) {
      const vel = new THREE.Vector3(rand(-9, 9), rand(1, 11), rand(-9, 9)).multiplyScalar(scale * 0.9);
      this.addSprite(GLOW, p.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.2, 0.5), rand(-0.4, 0.4))), i % 4 ? 0xff8a34 : 0xffdc8f, rand(0.06, 0.18) * scale, {
        life: rand(0.6, 1.6), vel, gravity: -13, drag: 0.8,
      });
    }

    const smokeCount = Math.round((boss ? 13 : 8) * count);
    for (let i = 0; i < smokeCount; i++) {
      const vel = new THREE.Vector3(rand(-2.5, 2.5), rand(0.2, 3.8), rand(-2.5, 2.5)).multiplyScalar(scale);
      this.addSprite(SMOKE, p.clone().add(new THREE.Vector3(rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5))), 0x47352a, rand(0.8, 1.65) * scale, {
        life: rand(1.4, 2.7), vel, gravity: 0.5, drag: 0.8, grow: 0.9, additive: false, opacity: 0.55,
      });
    }
  }

  dragonDeath(position, boss = false) {
    const scale = boss ? 2.2 : 1.25;
    this.explosion(position, scale, boss);
    this.addSprite(GLOW, position, 0xff7130, 2.4 * scale, { life: 0.65, grow: 2.2, opacity: 0.7 });
    const count = this.lowQuality ? 16 : 36;
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3(rand(-4, 4), rand(0, 7), rand(-4, 4));
      this.addSprite(GLOW, position.clone().add(new THREE.Vector3(rand(-1, 1), rand(-0.5, 1.5), rand(-1, 1))), i % 3 ? 0xff7a2c : 0xffd48a, rand(0.06, 0.14), {
        life: rand(0.7, 1.9), vel, gravity: -3, drag: 1.1,
      });
    }
  }

  blast(position, scale = 1) {
    this.explosion(position, scale, false);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.material.dispose();
        p.sprite.removeFromParent();
        this.particles.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.vel.y += p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.sprite.position.addScaledVector(p.vel, dt);
      const baseScale = p.sprite.scale.x;
      p.sprite.scale.x = Math.max(0.005, baseScale * (1 + p.grow * dt * 2.1));
      p.sprite.scale.y = p.sprite.scale.x;
      p.sprite.material.opacity = (1 - t) * p.baseOpacity;
      if (p.spin) p.sprite.material.rotation += p.spin * dt;
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / tr.maxLife) * 0.85;
      if (tr.life <= 0) {
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        tr.line.removeFromParent();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - r.life / r.maxLife;
      const s = 1 + t * r.scale;
      r.ring.scale.set(s, s, s);
      r.ring.material.opacity = (1 - t) * 0.85;
      if (r.life <= 0) {
        r.ring.geometry.dispose();
        r.ring.material.dispose();
        r.ring.removeFromParent();
        this.rings.splice(i, 1);
      }
    }

    if (this.flashLightLife > 0) {
      this.flashLightLife -= dt;
      this.flashLight.intensity *= Math.exp(-dt * 30);
      if (this.flashLightLife <= 0) this.flashLight.intensity = 0;
    }
  }

  clear() {
    for (const p of this.particles) {
      p.sprite.material.dispose();
      p.sprite.removeFromParent();
    }
    for (const tr of this.tracers) {
      tr.line.geometry.dispose();
      tr.line.material.dispose();
      tr.line.removeFromParent();
    }
    for (const r of this.rings) {
      r.ring.geometry.dispose();
      r.ring.material.dispose();
      r.ring.removeFromParent();
    }
    this.particles = [];
    this.tracers = [];
    this.rings = [];
    this.flashLight.intensity = 0;
  }
}
