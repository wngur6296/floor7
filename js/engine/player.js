// 입력(터치 조이스틱·드래그 시점·탭 / WASD·마우스) + 1인칭 이동·충돌·시점.
import * as THREE from 'three';

export class Input {
  constructor(el, ui) {
    this.el = el; this.move = { x: 0, y: 0 }; this.look = { dx: 0, dy: 0 }; this.keys = new Set();
    this.taps = []; this.enabled = true; this.sens = 1; this.locked = false; this.lastInput = performance.now();
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; this.lookT = { id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: 0 };
    this.joyEl = document.getElementById('joy'); this.knobEl = document.getElementById('joyKnob');
    const opt = { passive: false };
    el.addEventListener('touchstart', e => this.ts(e), opt); el.addEventListener('touchmove', e => this.tm(e), opt);
    el.addEventListener('touchend', e => this.te(e), opt); el.addEventListener('touchcancel', e => this.te(e), opt);
    addEventListener('keydown', e => { if (e.repeat) return; this.keys.add(e.code); this.lastInput = performance.now(); if (e.code === 'KeyE' || e.code === 'Space') this.taps.push({ center: true }); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    el.addEventListener('mousedown', e => {
      if (e.button !== 0 || this.isTouch) return; this.lastInput = performance.now();
      if (document.pointerLockElement !== el) { if (this.enabled) el.requestPointerLock?.(); this.taps.push({ x: e.clientX, y: e.clientY }); }
      else this.taps.push({ center: true });
    });
    addEventListener('mousemove', e => { if (document.pointerLockElement === el && this.enabled && (e.movementX || e.movementY)) { this.look.dx += e.movementX * .0022 * this.sens; this.look.dy += e.movementY * .0022 * this.sens; this.lastInput = performance.now(); } });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; if (!this.locked) this.onUnlock?.(); });
  }
  ts(e) {
    e.preventDefault(); this.isTouch = true; this.lastInput = performance.now();
    for (const t of e.changedTouches) {
      const onSide = this.joySide === 'right' ? t.clientX > innerWidth * .55 : t.clientX < innerWidth * .45; const left = onSide && t.clientY > innerHeight * .3;
      if (left && this.joy.id === null && this.enabled) { this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 }; this.joyEl.style.display = 'block'; this.joyEl.style.left = t.clientX + 'px'; this.joyEl.style.top = t.clientY + 'px'; this.knobEl.style.transform = 'translate(-50%,-50%)'; }
      else if (this.lookT.id === null) this.lookT = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: 0 };
    }
  }
  tm(e) {
    e.preventDefault(); this.lastInput = performance.now();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy; const R = 55 * (this.joySize || 1); const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
        this.joy.x = dx / R; this.joy.y = dy / R; this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === this.lookT.id) {
        const dx = t.clientX - this.lookT.x, dy = t.clientY - this.lookT.y; this.lookT.x = t.clientX; this.lookT.y = t.clientY;
        this.lookT.moved += Math.abs(dx) + Math.abs(dy);
        if (this.enabled) { this.look.dx += dx * .0055 * this.sens; this.look.dy += dy * .0055 * this.sens; }
      }
    }
  }
  te(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) { this.joy = { id: null, x: 0, y: 0 }; this.joyEl.style.display = 'none'; }
      else if (t.identifier === this.lookT.id) { if (this.lookT.moved < 12 && performance.now() - this.lookT.t < 350) this.taps.push({ x: t.clientX, y: t.clientY }); this.lookT.id = null; }
    }
  }
  axes() {
    let x = this.joy.x || 0, y = this.joy.y || 0; const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1; if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return this.enabled ? { x, y } : { x: 0, y: 0 };
  }
  reset() { this.joy = { id: null, x: 0, y: 0 }; this.joyEl.style.display = 'none'; this.look.dx = this.look.dy = 0; this.taps.length = 0; this.keys.clear(); }
}

export class Player {
  constructor(camera, world, audio) {
    this.cam = camera; this.world = world; this.audio = audio;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.eye = 1.62; this.eyeT = 1.62;
    this.speed = 2.1; this.r = .28; this.bob = 0; this.stepDist = 0; this.vel = new THREE.Vector2(); this.sitting = null; this.frozen = false;
    this.room = null; this.moved = 0; this.roll = 0; this.bobScale = 1;
  }
  spawn(p, yaw = 0) { this.pos.set(p[0], 0, p[1]); this.yaw = yaw; this.pitch = 0; this.vel.set(0, 0); this.sitting = null; this.room = this.world.roomAt(p[0], p[1]); }
  update(dt, input) {
    // 시점
    this.yaw -= input.look.dx; this.pitch -= input.look.dy * (input.invertY ? -1 : 1); input.look.dx = input.look.dy = 0;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    const ax = this.frozen ? { x: 0, y: 0 } : input.axes();
    if (this.sitting && (Math.abs(ax.x) + Math.abs(ax.y) > .5)) this.stand();
    let mv = 0;
    if (!this.sitting) {
      const run = input.keys.has('ShiftLeft') ? 1.5 : 1; const sp = this.speed * run * (this.eyeT < 1.2 ? .55 : 1) * (this.speedMul ?? 1);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const tx = (ax.x * c + ax.y * s) * sp, tz = (-ax.x * s + ax.y * c) * sp;
      const k = Math.min(1, dt * 10); this.vel.x += (tx - this.vel.x) * k; this.vel.y += (tz - this.vel.y) * k;
      const ox = this.pos.x, oz = this.pos.z;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
      this.room = this.world.collide(this.pos, this.r) || this.room;
      mv = Math.hypot(this.pos.x - ox, this.pos.z - oz); this.moved += mv;
      this.stepDist += mv; this.bob += mv * 5.2;
      if (this.stepDist > .78) { this.stepDist = 0; this.audio?.sfx('step_' + ((Math.random() * 4) | 0), { vol: this.eyeT < 1.2 ? .5 : 1, rate: .9 + Math.random() * .2 }); if (this.eyeT < 1.2) this.audio?.sfx('crawl', { vol: .5 }); }
      // 낮은 천장/작은 문 → 자동으로 숙임
      let target = 1.62; const R = this.room; if (R && !R.outdoor) target = Math.min(target, R.h - .28);
      for (const d of this.world.doors.values()) if (d.h < 1.8) { const dd = Math.hypot(this.pos.x - d.at[0], this.pos.z - d.at[1]); if (dd < 1.1) target = Math.min(target, d.h - .3); }
      this.eyeT = target;
    } else this.eyeT = this.sitting.eye;
    this.eye += (this.eyeT - this.eye) * Math.min(1, dt * 6);
    const sp2 = this.vel.length(); const bobA = Math.min(1, sp2 / 2) * .035 * this.bobScale;
    const bx = this.sitting ? this.sitting.x : this.pos.x, bz = this.sitting ? this.sitting.z : this.pos.z;
    this.cam.position.set(bx, this.eye + Math.sin(this.bob) * bobA, bz);
    this.cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * .5) * bobA * .25 + this.roll, 'YXZ');
    return mv;
  }
  sit(x, z, yaw, eye = 1.12) { this.sitting = { x, z, eye }; this.yaw = yaw; this.pitch = -.05; this.vel.set(0, 0); }
  stand() { if (!this.sitting) return; this.sitting = null; this.onStand?.(); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
}
