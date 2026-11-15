// 월드 빌더: data/level.js → three.js 장면. 정적 형상은 재질별로 병합해 드로우콜을 줄인다.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { ROOMS, DOORS, PROPS, GROUPS, TRIGGERS, TELEPORTS, CCTV_BOUNDS } from '../../data/level.js';
import { mat, model } from './assets.js';
import { drawScreen } from './props.js';

const D2R = Math.PI / 180;
const DEFAULT_H = 2.8;
const DOOR_W = 1.0, DOOR_H = 2.1;

export class World {
  constructor(scene, S) {
    this.scene = scene; this.S = S;
    this.rooms = new Map(); this.doors = new Map(); this.props = new Map();
    this.segs = []; this.boxes = []; this.anchors = []; this.interactables = [];
    this.groups = new Map(); this.dynamicProps = []; this.clocks = []; this.cctvs = []; this.trail = [];
    this.root = new THREE.Group(); scene.add(this.root);
    this._buckets = new Map(); // grp|matId → geometries
    for (const r of ROOMS) this.rooms.set(r.id, { ...r, h: r.h || DEFAULT_H, lightOn: true });
    // 바깥(큰 영역)은 병합 구역 판단에서 제외하기 위해 맨 뒤로

    for (const r of this.rooms.values()) this.buildRoom(r);
    for (const d of DOORS) this.buildDoor(d);
    for (const p of PROPS) this.buildProp(p);
    this.flush();
    this.triggers = TRIGGERS; this.teleports = TELEPORTS;
  }
  // ── 병합 버킷
  addStatic(mesh, grp = '_') {
    mesh.updateWorldMatrix(true, false);
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox(); const c = g.boundingBox.getCenter(_c3); const rid = this._forceRoom !== undefined ? this._forceRoom : this.stableRoom(c.x, c.z);
    const key = grp + '|' + mesh.material.uuid + '|' + rid;
    if (!this._buckets.has(key)) this._buckets.set(key, { grp, mat: mesh.material, geos: [] });
    this._buckets.get(key).geos.push(g);
  }
  // 경계 근처(벽에 붙은 것·문틀)는 어느 방인지 애매하므로 '-'(항상 후보)로 둔다
  stableRoom(x, z, e = .35) { const r = this.roomAt(x, z); if (!r) return '-'; for (const [a, b] of [[e, 0], [-e, 0], [0, e], [0, -e]]) if (this.roomAt(x + a, z + b) !== r) return '-'; return r.id; }
  flush() {
    for (const [key, { grp, mat: m, geos }] of this._buckets.entries()) { const room = key.split('|')[2];
      const merged = mergeGeometries(geos, false); if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, m); mesh.matrixAutoUpdate = false;
      const bs = merged.boundingSphere; (this.cullList ||= []).push({ obj: mesh, c: bs.center, r: bs.radius, room: room });
      if (grp === '_') this.root.add(mesh);
      else { if (!this.groups.has(grp)) { const G = new THREE.Group(); G.userData.fn = GROUPS[grp] || (() => true); this.root.add(G); this.groups.set(grp, G); } this.groups.get(grp).add(mesh); }
    }
    this._buckets.clear();
  }
  // ── 방: 바닥·천장·벽(문 구멍 포함)·조명 앵커
  buildRoom(r) { this._forceRoom = r.id; try { this._buildRoom(r); } finally { this._forceRoom = undefined; } }
  _buildRoom(r) {
    const [x0, z0, x1, z1] = r.box; const H = r.h;
    const fm = mat(r.floor || 'carpet');
    this.quadStatic(fm, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], fm.userData.tile, 'xz', 'room:' + r.id);
    if (r.outdoor) return;
    const cm = mat(r.ceil || 'ceiling');
    this.quadStatic(cm, [x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], [0, -1, 0], cm.userData.tile, 'xz');
    const wm = mat(r.wall || 'wall');
    const sides = [
      { a: [x0, z0], u: [1, 0], n: [0, 1], L: x1 - x0, axis: 'x', line: z0 },   // 북쪽 벽 (안쪽 = +z)
      { a: [x1, z1], u: [-1, 0], n: [0, -1], L: x1 - x0, axis: 'x', line: z1 }, // 남쪽 벽
      { a: [x0, z1], u: [0, -1], n: [1, 0], L: z1 - z0, axis: 'z', line: x0 },  // 서쪽 벽
      { a: [x1, z0], u: [0, 1], n: [-1, 0], L: z1 - z0, axis: 'z', line: x1 },  // 동쪽 벽
    ];
    for (const s of sides) {
      const ops = [];
      for (const d of DOORS) {
        if ((d.axis || 'x') !== s.axis) continue;
        const [dx, dz] = d.at; const onLine = s.axis === 'x' ? Math.abs(dz - s.line) < .01 : Math.abs(dx - s.line) < .01;
        if (!onLine) continue;
        const c = s.axis === 'x' ? dx : dz; const w = d.w || DOOR_W;
        const lo = s.axis === 'x' ? x0 : z0, hi = s.axis === 'x' ? x1 : z1;
        if (c < lo || c > hi) continue;
        // 벽 시작점(a)으로부터의 거리로 변환
        const along = (s.u[0] + s.u[1]) > 0 ? c - (s.axis === 'x' ? s.a[0] : s.a[1]) : (s.axis === 'x' ? s.a[0] : s.a[1]) - c;
        ops.push({ s0: along - w / 2, s1: along + w / 2, h: Math.min(d.h || DOOR_H, H) });
      }
      ops.sort((p, q) => p.s0 - q.s0);
      let cur = 0;
      const piece = (sa, sb, y0, y1, collide) => {
        if (sb - sa < .001 || y1 - y0 < .001) return;
        const s_a = t => s.a[0] + s.u[0] * t, s_b = t => s.a[1] + s.u[1] * t;
        const P = (t, y) => [s_a(t), y, s_b(t)];
        this.quadStatic(wm, P(sa, y0), P(sb, y0), P(sb, y1), P(sa, y1), [s.n[0], 0, s.n[1]], wm.userData.tile, 'wall', null, { sa, sb, y0, y1, H, along: s.axis === 'x' ? s_a(0) : s_b(0), dir: s.u[0] + s.u[1] });
        if (collide) this.segs.push([s_a(sa), s_b(sa), s_a(sb), s_b(sb)]);
      };
      for (const o of ops) { piece(cur, o.s0, 0, H, true); piece(o.s0, o.s1, o.h, H, false); cur = o.s1; }
      piece(cur, s.L, 0, H, true);
    }
    // 조명 앵커 (격자)
    const gap = r.lightGap || 3.2; const w = x1 - x0, d = z1 - z0;
    const nx = Math.max(1, Math.round(w / gap)), nz = Math.max(1, Math.round(d / gap));
    const pm = mat('lightpanel').clone(); r.panelMat = pm;
    const narrow = Math.min(w, d) < 2.5;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = x0 + (i + .5) * w / nx, z = z0 + (j + .5) * d / nz;
      const flick = ((Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5) % 1) < .1;
      this.anchors.push({ room: r.id, x, y: H - .05, z, color: r.lightColor ?? 0xfff6e6, k: r.light ?? 1, flick, seed: Math.random() * 100 });
      const pw = narrow ? .35 : .6, pd = narrow ? 1.2 : .6;
      const ph = new THREE.Mesh(new THREE.BoxGeometry(w < d ? pw : pd, .03, w < d ? pd : pw), pm); ph.position.set(x, H - .015, z);
      this.addStatic(ph, 'panels:' + r.id);
    }
  }
  quadStatic(m, p0, p1, p2, p3, n, tile = 1, mode, grp, wall) {
    const g = new THREE.BufferGeometry();
    const pos = [...p0, ...p1, ...p2, ...p0, ...p2, ...p3];
    // 법선 방향으로 감기 순서 보정
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const P = [p0, p1, p2, p3];
    let uvs;
    if (mode === 'wall') {
      const { sa, sb, y0, y1, H, along, dir } = wall;
      const U = s => (along + dir * s) / tile * dir; const V = y => y / H;
      uvs = [[U(sa), V(y0)], [U(sb), V(y0)], [U(sb), V(y1)], [U(sa), V(y1)]];
    } else uvs = P.map(p => [p[0] / tile, -p[2] / tile]);
    const idx = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    const fp = [], fu = [], fn = [];
    for (const i of idx) { fp.push(...P[i]); fu.push(...uvs[i]); fn.push(...n); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    const mesh = new THREE.Mesh(g, m); this.addStatic(mesh, grp && grp.startsWith('room:') ? '_' : (grp || '_'));
  }
  // ── 문
  buildDoor(d) {
    const w = d.w || DOOR_W, h = d.h || DOOR_H, type = d.type || 'normal';
    const [cx, cz] = d.at; const axis = d.axis || 'x';
    const ra = this.rooms.get(d.a), rb = d.b ? this.rooms.get(d.b) : null;
    const u = axis === 'x' ? [1, 0] : [0, 1];
    // a 방 안쪽 방향
    const rc = r => [(r.box[0] + r.box[2]) / 2, (r.box[1] + r.box[3]) / 2];
    const ac = rc(ra); const na = axis === 'x' ? [0, Math.sign(ac[1] - cz) || 1] : [Math.sign(ac[0] - cx) || 1, 0];
    const door = { ...d, w, h, type, u, na, open: false, locked: type === 'locked' || type === 'keycard' || type === 'keypad' || !!d.locked, anim: 0, target: 0, shown: true };
    const seg = [cx - u[0] * w / 2, cz - u[1] * w / 2, cx + u[0] * w / 2, cz + u[1] * w / 2];
    door.seg = seg;
    if (type === 'open') { this.doors.set(d.id, door); return; }
    if (type === 'fake') { // 통과 가능한 가짜 벽
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(w, this.rooms.get(d.a).h), mat('wallOff').clone()); cover.material.side = THREE.DoubleSide;
      cover.material.map = cover.material.map.clone(); cover.material.map.needsUpdate = true; cover.material.map.repeat.set(w / 2.07, 1); cover.material.map.offset.set(.13, 0);
      cover.position.set(cx, ra.h / 2, cz); if (axis === 'z') cover.rotation.y = Math.PI / 2; this.root.add(cover);
      door.cover = cover; this.doors.set(d.id, door); return;
    }
    const G = new THREE.Group(); G.position.set(cx, 0, cz); if (axis === 'z') G.rotation.y = -Math.PI / 2; this.root.add(G); door.group = G;
    // 문틀 (정적)
    const fr = mat('frame');
    for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(.07, h, .18), fr); j.position.set(s * (w / 2 + .035), h / 2, 0); G.add(j); }
    const hd = new THREE.Mesh(new THREE.BoxGeometry(w + .14, .07, .18), fr); hd.position.set(0, h + .035, 0); G.add(hd);
    G.updateMatrixWorld(true); for (const c of [...G.children]) { this.addStatic(c); G.remove(c); }
    if (type === 'elevator') {
      const L = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h, .05), mat('metal')), R = L.clone();
      L.position.set(-w / 4, h / 2, 0); R.position.set(w / 4, h / 2, 0); G.add(L, R); door.panels = [L, R];
      L.userData.door = R.userData.door = d.id; this.interactables.push(L, R);
    } else {
      const hinge = new THREE.Group(); hinge.position.set(-w / 2, 0, 0); G.add(hinge);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - .02, h - .02, .045), mat(d.mat || 'door')); leaf.position.set(w / 2, h / 2, 0); hinge.add(leaf);
      const kn = new THREE.Mesh(new THREE.BoxGeometry(.12, .03, .09), mat('chrome')); kn.position.set(w - .12, 1.0 * Math.min(1, h / 2.1), 0); leaf.add(kn); kn.position.x = w / 2 - .12; kn.position.y = -(h / 2) + Math.min(1, h * .48);
      leaf.userData.door = d.id; this.interactables.push(leaf); door.hinge = hinge; door.leaf = leaf;
      // 스윙 방향: b 방 쪽으로 (b 없으면 a 쪽)
      const into = d.swing === 'a' || !rb ? ac : rc(rb);
      const s = axis === 'x' ? Math.sign(into[1] - cz) : Math.sign(into[0] - cx);
      door.swingSign = axis === 'x' ? (s < 0 ? 1 : -1) : (s > 0 ? 1 : -1);
    }
    if (d.sign) {
      const sg = model('sign', { w: Math.max(.36, d.sign.length * .11), h: .16, lines: [d.sign], bg: d.signGlow ? '#0d7a3a' : '#1f2a2e', glow: d.signGlow });
      sg.position.set(cx + na[0] * .02, h + .3, cz + na[1] * .02); sg.rotation.y = Math.atan2(na[0], na[1]); this.root.add(sg);
    }
    if (d.show) { // 숨겨진 문: 조건 전까지 벽으로 덮음
      const mk = (room, n) => { const m = mat(room.wall || 'wall'); const p = new THREE.Mesh(new THREE.PlaneGeometry(w + .2, h + .1), m); p.position.set(cx + n[0] * .1, (h + .1) / 2, cz + n[1] * .1); p.rotation.y = Math.atan2(n[0], n[1]); this.root.add(p); return p; };
      door.covers = [mk(ra, na)]; if (rb) door.covers.push(mk(rb, [-na[0], -na[1]]));
      door.showFn = d.show;
    }
    this.doors.set(d.id, door);
  }
  // ── 소품
  buildProp(p) {
    const o = typeof p.o === 'function' ? p.o() : (p.o || {});
    const g = model(p.m, o);
    g.position.set(p.p[0], p.y || 0, p.p[1]); g.rotation.y = (p.r || 0) * D2R;
    if (p.flat) { g.rotation.x = -Math.PI / 2; g.rotation.z = (p.r || 0) * D2R; g.rotation.y = 0; }
    const sz = g.userData.size;
    if (p.col && sz) {
      const a = Math.abs(((p.r || 0) % 180 + 180) % 180); const sw = a > 45 && a < 135;
      let [w, d] = sw ? [sz[1], sz[0]] : sz; if (p.m === 'chair') w = d = .5;
      this.boxes.push({ x0: p.p[0] - w / 2, z0: p.p[1] - d / 2, x1: p.p[0] + w / 2, z1: p.p[1] + d / 2, prop: p.id, on: true });
      if (p.id) this.props.set(p.id + ':box', this.boxes[this.boxes.length - 1]);
    }
    const dynamic = p.id || p.interact || p.show || p.clock || p.cctv || p.inside || p.plant || g.getObjectByName('mirror') || (p.m === 'monitor' && !o.shared);
    if (!dynamic) { // 정적 → 병합
      if (p.m === 'monitor' && o.shared) sharedScreen(g, o);
      g.updateMatrixWorld(true); g.traverse(c => { if (c.isMesh) this.addStatic(c, p.grp || '_'); }); return;
    }
    compactProp(g);
    this.root.add(g);
    const rec = { def: p, obj: g, visible: true, taken: false };
    g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g); rec.cc = bb.getCenter(new THREE.Vector3()); rec.cr = bb.getSize(new THREE.Vector3()).length() / 2 + .2;
    rec.room = p.inside ? '-' : this.stableRoom(rec.cc.x, rec.cc.z, Math.min(.6, rec.cr)); rec.meshes = []; g.traverse(c => { if (c.isMesh && !c.isReflector) rec.meshes.push(c); }); rec.culled = false;
    if (p.id) this.props.set(p.id, rec);
    if (p.interact) { g.userData.prop = p.id; g.traverse(c => { if (c.isMesh) c.userData.prop = p.id; }); this.interactables.push(g); }
    if (p.clock) { const s = g.getObjectByName('screen'); this.clocks.push({ rec, sc: s.userData.sc, fn: p.clock, t0: Date.now() }); }
    if (p.cctv) { const s = g.getObjectByName('screen'); this.cctvs.push({ sc: s.userData.sc, mode: p.cctv }); }
    if (p.inside) { g.visible = false; rec.visible = false; }
    const dr = g.getObjectByName('drawer'); if (dr && p.interact?.type === 'drawer') { rec.drawer = dr; dr.userData.z0 = dr.position.z; }
    const lf = g.getObjectByName('leaf'); if (lf) rec.leaf = lf;
    this.dynamicProps.push(rec);
  }
  // ── 거리 컬링: 안개 끝보다 먼 덩어리는 그리지 않는다 (배경색 = 안개색이라 보이는 차이 없음)
  // + 방 단위 가시성: 지금 방에서 열린 문/개구부로 이어진 방만 그린다 (닫힌 문 너머는 생략)
  visibleRooms(cur) {
    const V = this._vis || (this._vis = new Set()); V.clear(); if (!cur) return null; V.add(cur); V.add('-'); const q = [cur];
    while (q.length) { const r = q.shift(); for (const d of this.doors.values()) {
      if (d.a !== r && d.b !== r) continue; const o = d.a === r ? d.b : d.a; if (!o || V.has(o)) continue;
      const pass = d.type === 'open' ? d.shown !== false : d.type === 'fake' ? false : (d.shown !== false && (d.open || d.anim > .01));
      if (pass) { V.add(o); q.push(o); } } }
    return V;
  }
  cull(cp, far, curRoom) {
    const V = this.visibleRooms(curRoom);
    for (const o of this.cullList || []) { const dx = o.c.x - cp.x, dz = o.c.z - cp.z; o.obj.visible = (!V || V.has(o.room)) && Math.sqrt(dx * dx + dz * dz) - o.r < far; }
    for (const rec of this.dynamicProps) { const dx = rec.cc.x - cp.x, dz = rec.cc.z - cp.z; const cul = (V && !V.has(rec.room)) || Math.sqrt(dx * dx + dz * dz) - rec.cr > far;
      if (cul !== rec.culled) { rec.culled = cul; for (const m of rec.meshes) m.layers.mask = cul ? 2 : 1; } }
  }
  // ── 조건 재평가 (방 입장 시)
  refresh() {
    const S = this.S;
    for (const rec of this.dynamicProps) {
      const p = rec.def; if (rec.taken) { rec.obj.visible = false; continue; }
      let vis = p.show ? !!p.show(S) : true;
      if (p.inside) vis = vis && !!S.run.drawers[p.inside];
      rec.obj.visible = vis; rec.visible = vis;
      const b = this.props.get(p.id + ':box'); if (b) b.on = vis;
    }
    for (const G of this.groups.values()) if (G.userData.fn) G.visible = !!G.userData.fn(S);
    for (const d of this.doors.values()) if (d.showFn) {
      const s = !!d.showFn(S); d.shown = s; d.covers.forEach(c => c.visible = !s); if (d.group) d.group.visible = s;
    }
    // 화분 성장
    const plant = this.props.get('plant'); if (plant) { const f = plant.obj.getObjectByName('foliage'); if (f) f.scale.setScalar(.7 + Math.min(2.2, (S.save.plant || 0) * .25)); }
  }
  // ── 충돌
  doorBlocks(d) { if (d.type === 'open' || d.type === 'fake') return false; if (d.showFn && !d.shown) return true; return !d.open || d.anim < .6; }
  collide(pos, r) {
    for (let it = 0; it < 3; it++) {
      for (const s of this.segs) pushSeg(pos, r, s);
      for (const d of this.doors.values()) if (this.doorBlocks(d)) pushSeg(pos, r, d.seg);
      for (const b of this.boxes) if (b.on) pushBox(pos, r, b);
    }
    // 바깥은 경계
    const R = this.roomAt(pos.x, pos.z);
    return R;
  }
  roomAt(x, z) { for (const r of this.rooms.values()) { const [x0, z0, x1, z1] = r.box; if (x >= x0 - .001 && x <= x1 + .001 && z >= z0 - .001 && z <= z1 + .001) return r; } return null; }
  inBox(b, x, z) { return x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]; }
  // ── 문 조작
  setDoor(id, open) { const d = this.doors.get(id); if (!d) return; d.open = open; d.target = open ? 1 : 0; }
  update(dt, cam) {
    for (const d of this.doors.values()) {
      if (d.anim !== d.target) { const sp = d.type === 'elevator' ? 1.1 : 1.6; d.anim += Math.sign(d.target - d.anim) * dt * sp; d.anim = Math.max(0, Math.min(1, d.anim)); if (Math.abs(d.anim - d.target) < .01) d.anim = d.target; }
      const e = d.anim * d.anim * (3 - 2 * d.anim);
      if (d.hinge) d.hinge.rotation.y = e * 1.62 * d.swingSign;
      if (d.panels) { d.panels[0].position.x = -d.w / 4 - e * d.w * .48; d.panels[1].position.x = d.w / 4 + e * d.w * .48; }
    }
    // 서랍
    for (const rec of this.dynamicProps) {
      const dr = rec.drawer; if (!dr) continue; const t = rec.drawerOpen ? 1 : 0; rec.dA = (rec.dA || 0) + (t - (rec.dA || 0)) * Math.min(1, dt * 8); dr.position.z = dr.userData.z0 + rec.dA * .35;
    }
    for (const rec of this.dynamicProps) if (rec.leaf) { const t = rec.leafOpen ? 1 : 0; rec.lA = (rec.lA || 0) + (t - (rec.lA || 0)) * Math.min(1, dt * 5); rec.leaf.rotation.y = -rec.lA * 1.7; }
  }
  tickClocks(S) {
    const now = new Date();
    for (const c of this.clocks) {
      if (!c.rec.obj.visible) continue;
      const mode = c.fn(S); let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
      if (mode === 'back') { const t = (c.t0 / 1000) - (Date.now() - c.t0) / 1000; const d = new Date(t * 1000); h = d.getHours(); m = d.getMinutes(); s = d.getSeconds(); }
      if (mode === 'stop') { h = 4; m = 27; s = 0; }
      if (mode === 'fast') { const d = new Date(c.t0 + (Date.now() - c.t0) * 60); h = d.getHours(); m = d.getMinutes(); s = d.getSeconds(); }
      drawClock(c.sc, h, m, s);
    }
  }
  tickCctv(player, t) {
    const [bx0, bz0, bx1, bz1] = CCTV_BOUNDS;
    for (const c of this.cctvs) {
      const { ctx: g, canvas: cv } = c.sc; const W = cv.width, H = cv.height;
      if (c.mode === 'noise') { const id = g.createImageData(W, H); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); g.fillStyle = '#ddd'; g.font = '20px monospace'; g.fillText('CAM ' + (Math.floor(t) % 7 + 1) + ' — 신호 없음', 14, 30); c.sc.tex.needsUpdate = true; continue; }
      const sx = W / (bx1 - bx0), sz = H / (bz1 - bz0), sc = Math.min(sx, sz); const ox = (W - (bx1 - bx0) * sc) / 2, oz = (H - (bz1 - bz0) * sc) / 2;
      const P = (x, z) => [ox + (x - bx0) * sc, oz + (z - bz0) * sc];
      g.fillStyle = '#04110c'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#2f8f62'; g.lineWidth = 1.5;
      for (const r of this.rooms.values()) { if (r.outdoor) continue; const [a, b] = P(r.box[0], r.box[1]), [c2, d2] = P(r.box[2], r.box[3]); g.strokeRect(a, b, c2 - a, d2 - b); if (this.S.run.visits[r.id]) { g.fillStyle = 'rgba(60,200,140,.12)'; g.fillRect(a, b, c2 - a, d2 - b); } }
      g.fillStyle = 'rgba(255,80,60,.5)'; for (const [x, z] of this.trail) { const [a, b] = P(x, z); g.fillRect(a - 1, b - 1, 2, 2); }
      const [px, pz] = P(player.pos.x, player.pos.z); g.fillStyle = (t * 2 | 0) % 2 ? '#ff3b2f' : '#ffb0a8'; g.beginPath(); g.arc(px, pz, 4, 0, 7); g.fill();
      g.fillStyle = '#7fe0b0'; g.font = '16px monospace'; g.fillText('정연 7F  관제  ' + new Date().toLocaleTimeString('ko-KR'), 10, 20); g.fillText('0427 추적 중', 10, H - 10);
      c.sc.tex.needsUpdate = true;
    }
  }
}
function sharedScreen(g, o) { const s = g.getObjectByName('screen'); if (!s) return; const key = (o.text || []).join('|'); sharedScreen.cache ??= new Map(); if (!sharedScreen.cache.has(key)) { drawScreen(s.userData.sc, o.text || []); sharedScreen.cache.set(key, s.material); } s.material = sharedScreen.cache.get(key); }
function drawClock(sc, h, m, s) {
  const { ctx: g, canvas: c } = sc; const W = c.width, R = W / 2;
  g.fillStyle = '#f7f6f0'; g.fillRect(0, 0, W, W); g.strokeStyle = '#222'; g.lineWidth = 4; g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#222'; g.fillRect(R + Math.sin(a) * (R - 14) - 2, R - Math.cos(a) * (R - 14) - 2, 4, 4); }
  const hand = (a, l, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(R, R); g.lineTo(R + Math.sin(a) * l, R - Math.cos(a) * l); g.stroke(); };
  hand(((h % 12) + m / 60) / 12 * Math.PI * 2, R * .5, 6, '#222'); hand((m + s / 60) / 60 * Math.PI * 2, R * .75, 4, '#222'); hand(s / 60 * Math.PI * 2, R * .8, 1.5, '#b22');
  sc.tex.needsUpdate = true;
}
function pushSeg(p, r, s) {
  const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az; const L2 = dx * dx + dz * dz || 1;
  let t = ((p.x - ax) * dx + (p.z - az) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t; const ex = p.x - cx, ez = p.z - cz; const d2 = ex * ex + ez * ez;
  if (d2 < r * r && d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + ex / d * r; p.z = cz + ez / d * r; }
}
function pushBox(p, r, b) {
  const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
  const ex = p.x - cx, ez = p.z - cz; const d2 = ex * ex + ez * ez;
  if (d2 < r * r) { if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + ex / d * r; p.z = cz + ez / d * r; } else { // 안쪽: 가장 가까운 면으로
    const m = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z]; const i = m.indexOf(Math.min(...m)); if (i === 0) p.x = b.x0 - r; if (i === 1) p.x = b.x1 + r; if (i === 2) p.z = b.z0 - r; if (i === 3) p.z = b.z1 + r; } }
}

// 동적 소품도 이름 없는(움직이지 않는) 부품은 재질별로 하나의 메시로 합친다 → 드로우콜 감소
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _c3 = new THREE.Vector3();
function compactProp(g) {
  g.updateMatrixWorld(true); _inv.copy(g.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  for (const c of g.children) {
    if (!c.isMesh || c.name || c.isReflector || Array.isArray(c.material) || c.children.length || c.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) continue;
    let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    _rel.multiplyMatrices(_inv, c.matrixWorld); geo.applyMatrix4(_rel);
    const k = c.material.uuid; if (!buckets.has(k)) buckets.set(k, { m: c.material, geos: [], n: 0 }); const B = buckets.get(k); B.geos.push(geo); victims.push(c);
  }
  for (const { m, geos } of buckets.values()) { if (geos.length < 2) { geos.forEach(x => x.dispose()); continue; } const merged = mergeGeometries(geos, false); geos.forEach(x => x.dispose()); if (!merged) continue;
    for (const c of victims.filter(v => v.material === m)) g.remove(c);
    const mesh = new THREE.Mesh(merged, m); g.add(mesh); }
}
