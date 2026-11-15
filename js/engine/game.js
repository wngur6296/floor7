// 게임 코어: 렌더링 루프, 상호작용, 불순종 감지(Tracker), 이야기 API(G).
// 이야기 자체는 data/story.js 에 있고, 여기서는 그걸 실행하는 장치만 제공한다.
import * as THREE from 'three';
import { World } from './world.js';
import { Player, Input } from './player.js';
import { Post } from './post.js';
import { LINES } from '../../data/lines.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { ENDINGS } from '../../data/endings.js';
import { COMPUTERS, MAILS, DOCS } from '../../data/docs.js';
import { SPAWNS } from '../../data/level.js';
import { STORY, REACT } from '../../data/story.js';
import { writeSave, newRun } from './save.js';
import { writeSlot } from './slots.js';
import { updateTextTexture } from './proctex.js';
import { mirrorCfg } from './props.js';

const POOL = 5; // 동시에 켜는 점광원 수 (모바일 성능)

export class Game {
  constructor({ canvas, ui, audio, save }) {
    this.ui = ui; this.audio = audio; this.save = save; this.run = newRun();
    this.S = { save, run: this.run };
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x111110);
    this.scene.fog = new THREE.Fog(0x22231f, 5, 24);
    this.camera = new THREE.PerspectiveCamera(72, 1, .05, 120);
    this.hemi = new THREE.HemisphereLight(0xf4f2e8, 0x3a3833, .9); this.scene.add(this.hemi);
    this.pool = []; for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xfff6e6, 0, 10, 1.5); l.userData = { anchor: null, cur: 0 }; this.scene.add(l); this.pool.push(l); }
    this.world = new World(this.scene, this.S);
    this.input = new Input(canvas, ui);
    this.player = new Player(this.camera, this.world, audio);
    this.player.onStand = () => this.emit('stand', {});
    this.post = new Post(r);
    this.ray = new THREE.Raycaster(); this.ray.far = 2.5;
    this.ts = 1; this.timers = []; this.expectSpec = null; this.running = false; this.paused = false; this.t = 0;
    this.fx = { distort: 0, ca: .35, desat: .12, fade: 1, grain: .06 }; this.fxT = { ...this.fx, fade: 0 };
    this.trk = { hist: [], turn: 0, lastAng: null, ceil: 0, idleLv: 0, lastSample: 0 };
    this.narr = { token: 0, chain: Promise.resolve(), busy: false, lastEnd: 0 };
    this.inspectScene = new THREE.Scene(); this.inspectCam = new THREE.PerspectiveCamera(40, 1, .01, 10); this.inspectCam.position.set(0, 0, .9);
    this.inspectScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(1, 2, 2); this.inspectScene.add(dl);
    this.quality(save.settings.quality); this.resize(); addEventListener('resize', () => this.resize());
    this.fpsAcc = { t: 0, n: 0, up: 0, lvl: matchMedia('(pointer: coarse)').matches ? 1 : 2 };
    this.G = this.makeAPI();
    this.bindInspectDrag(canvas);
  }
  // ── 화질
  quality(q) {
    this.q = q; const dpr = Math.min(devicePixelRatio || 1, 3);
    const lv = q === 'high' ? 2 : q === 'medium' ? 1 : q === 'low' ? 0 : (this.fpsAcc?.lvl ?? 2);
    const rs = this.save.settings.resScale || 1;
    const mobile = matchMedia('(pointer: coarse)').matches; // 모바일은 픽셀 비율 상한을 더 낮게 (아이폰 dpr 3 → 최대 1.6)
    this.pr = (mobile ? [Math.min(dpr, .8), Math.min(dpr, 1.2), Math.min(dpr, 1.6)] : [Math.min(dpr, .85), Math.min(dpr, 1.3), Math.min(dpr, 2)])[lv] * rs;
    this.qLevel = lv; mirrorCfg.everyOther = lv < 2;
    this.post.enabled = lv > 0; this.renderer.setPixelRatio(this.pr); this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    const fov = this.save.settings.fov || 72; this.camera.fov = w < h ? fov + 8 : fov - 2; this.camera.updateProjectionMatrix(); this.post?.setSize(w, h, this.pr || 1);
    this.inspectCam.aspect = w / h; this.inspectCam.updateProjectionMatrix();
  }
  // ── 회차 시작
  startRun() {
    const s = this.save; const now = Date.now();
    s.prevVisit = s.lastVisit; s.lastVisit = now; s.runs++;
    this.run = newRun(); this.S.run = this.run; this.expectSpec = null; this.clearTimers();
    for (const d of this.world.doors.values()) { d.open = false; d.anim = d.target = 0; d.locked = d.type === 'locked' || d.type === 'keycard' || d.type === 'keypad' || !!d.locked0; }
    for (const rec of this.world.dynamicProps) { rec.taken = !!(rec.def.interact?.type === 'duck' && s.ducks[rec.def.id]); rec.drawerOpen = false; rec.leafOpen = false; }
    this.player.spawn(SPAWNS.start.p, SPAWNS.start.yaw); this.player.frozen = false; this.player.roll = 0;
    this.room = null; this.trail = this.world.trail = []; this.lastRoomId = null;
    this.blackout = false; this.fxT = { distort: 0, ca: .35, desat: .12, fade: 0, grain: .06 }; this.fx.fade = 1; this.post.u.fadeColor.value.set(0);
    this.world.refresh(); this.ui.inv([]); this.ui.subtitle(null); this.ui.closeModal(true);
    this.running = true; this.paused = false; this.input.enabled = true; this.input.lastInput = performance.now();
    this.ach('first_day'); writeSave(s); this._cullT = 1;
    this.enterRoom(this.world.roomAt(this.player.pos.x, this.player.pos.z), null);
    this.emit('start', {});
  }
  // ── 이벤트 → data/story.js
  emit(name, e = {}) {
    const h = STORY[name]; let p;
    if (h) try { p = h(this.G, e); } catch (err) { console.error(name, err); }
    const star = STORY[name.split(':')[0] + ':*']; if (star) try { star(this.G, { ...e, name }); } catch (err) { console.error(err); }
    if (p?.catch) p.catch(err => console.error(name, err));
    return !!h;
  }
  enterRoom(room, from) {
    if (!room) return; const run = this.run; const v = (run.visits[room.id] || 0) + 1; run.visits[room.id] = v;
    this.room = room; this.world.refresh();
    // 안개·주변광
    const f = room.fog || [0x22231f, 5, room.loopRoom ? 13 : 24]; this.fogT = f;
    this.audio.loop('amb', this.blackout ? null : room.amb || 'amb_hum');
    let handled = false;
    const back = from && room.order != null && from.order != null && room.order < from.order && run.maxOrder > room.order;
    if (room.order != null) run.maxOrder = Math.max(run.maxOrder, room.order);
    const ex = this.expectSpec;
    if (ex && from) {
      if (ex.to.includes(room.id)) { this.expectSpec = null; handled = true; ex.onRight?.(room.id); }
      else if (!(ex.allow || []).includes(room.id) && !ex.hit.has(room.id)) {
        ex.hit.add(room.id); handled = true;
        const line = typeof ex.wrong === 'function' ? ex.wrong(room.id) : ex.wrong?.[room.id];
        if (line === undefined && !ex.strict) { ex.hit.delete(room.id); handled = false; }
        else { if (line !== null) this.defy(back ? 'back' : 'wrong', line, room.id); else { this.run.defy++; this.save.totalDefy++; } ex.onWrong?.(room.id); }
      }
    }
    this.emit('enter:' + room.id, { visit: v, from: from?.id, handled, back });
    if (from && this.running && performance.now() - (this.lastAuto || 0) > 6000) { this.lastAuto = performance.now(); setTimeout(() => this.autosave(), 50); }
    if (!handled && back) this.defy('back', null, room.id);
    else if (!handled && room.order != null && [2, 3, 5].includes(v) && !this.narr.busy) this.say(REACT.revisit[[2, 3, 5].indexOf(v)], { ifIdle: true });
  }
  // ── 불순종
  tier() { const d = this.run.defy + Math.min(3, Math.floor(this.save.totalDefy / 15)); return d < 3 ? 0 : d < 6 ? 1 : d < 10 ? 2 : 3; }
  defy(kind, line, where) {
    const run = this.run; run.defy++; this.save.totalDefy++;
    if (kind === 'back') run.back++;
    if (run.back >= 5) this.ach('backtrack'); if (run.defy >= 10) this.ach('rebel10'); if (this.save.totalDefy >= 50) this.ach('rebel50');
    let id = line;
    if (!id && kind === 'back') { const L = REACT.back; id = L[(run.back - 1) % L.length]; }
    if (!id) { const t = this.tier(); const L = REACT.defy[t]; run.dIdx = (run.dIdx || 0) + 1; id = L[run.dIdx % L.length]; }
    this.emit('defy', { kind, where, tier: this.tier() });
    // 톤이 높아질수록 화면이 미세하게 일그러진다
    const t = this.tier(); this.fxT.ca = .35 + t * .25; this.fxT.desat = .12 + t * .08;
    if (t >= 2) this.audio.silence(1.2);
    return this.say(id, { interrupt: true });
  }
  // ── 내레이션
  say(ids, o = {}) {
    if (!ids) return Promise.resolve(true); ids = [].concat(ids).filter(Boolean);
    if (o.ifIdle && this.narr.busy) return Promise.resolve(false);
    if (o.once) { ids = ids.filter(i => !this.run.said[i]); if (!ids.length) return Promise.resolve(false); }
    const N = this.narr; N.pending = (N.pending || 0) + 1; N.busy = true;
    if (o.interrupt) { N.token++; this.audio.stopVoice(); N.cancel?.(); N.chain = Promise.resolve(); }
    const tok = N.token; for (const id of ids.slice(0, 4)) if (/[\p{L}\p{N}]/u.test(LINES[id] ?? "")) this.audio.prefetchVoice(id);
    const p = N.chain.then(async () => {
      for (const id of ids) {
        if (tok !== N.token || !this.running) return false;
        this.run.said[id] = (this.run.said[id] || 0) + 1;
        let txt = LINES[id] ?? id; let who = null; const m = /^@([AB])\s+/.exec(txt); if (m) { who = m[1] === 'A' ? '0425 서민지' : '관리실'; txt = txt.slice(m[0].length); if (id.startsWith('radio')) who = '라디오'; if (id === 'hold_music') who = '안내 방송'; }
        if (o.reverse) txt = [...txt].reverse().join('');
        N.busy = true; this.ui.subtitle(txt, who);
        const v = !/[\p{L}\p{N}]/u.test(txt) ? null : await this.audio.voice(id, { reverse: o.reverse, phone: o.phone || (who && id.startsWith('radio')), rate: o.rate });
        const dur = v ? v.dur : Math.max(1.6, txt.length * .11);
        await new Promise(res => { const tm = setTimeout(res, (dur * 1000 + 120) / this.ts); N.cancel = () => { clearTimeout(tm); v?.stop(); res(); }; });
        if (tok !== N.token) return false;
        this.ui.subtitle(null); await new Promise(r => setTimeout(r, (o.gap ?? 380) / this.ts));
      }
      return true;
    }).finally(() => { N.pending--; if (N.pending <= 0) { N.pending = 0; N.busy = false; N.lastEnd = performance.now(); } });
    N.chain = p.catch(() => { }); return p;
  }
  async choice(promptId, opts, timeout = 9) {
    await this.say(promptId);
    if (!this.running) return 'quiet';
    let i = await this.ui.choice(opts, timeout / this.ts); if (i === -2) return 'cancel';
    const o = i < 0 ? opts.find(x => x.type === 'quiet') || { type: 'quiet' } : opts[i];
    const run = this.run; run.stats[o.type]++;
    if (o.type === 'ask') { this.save.totalAsk++; if (this.save.totalAsk >= 10) this.ach('ask10'); }
    if (o.type === 'quiet' && run.stats.quiet >= 5) this.ach('quiet5');
    if (o.type === 'defy') { run.defy++; this.save.totalDefy++; if (run.defy >= 10) this.ach('rebel10'); }
    const L = REACT.reply[o.type]; const reply = o.reply !== undefined ? o.reply : L[(run.stats[o.type] - 1) % L.length];
    if (reply) await this.say(reply);
    return o.type;
  }
  // ── 도전과제 / 결말
  ach(id) {
    const s = this.save; if (s.ach[id]) return; const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
    s.ach[id] = Date.now(); writeSave(s); this.ui.toast('도전과제: ' + a.name, a.desc); this.audio.sfx('achieve');
    if (Object.keys(s.ach).length === 10) setTimeout(() => this.say('achievement_many', { ifIdle: true }), 4000);
  }
  async ending(id, o = {}) {
    if (!this.running) return; this.running = false; this.input.enabled = false; this.player.frozen = true; this.clearTimers(); this.ui.closeModal(true);
    const E = ENDINGS.find(e => e.id === id); const s = this.save;
    s.endings[id] = (s.endings[id] || 0) + 1; s.lastEnding = id; writeSave(s);
    this.ach('first_end'); const n = Object.keys(s.endings).length; if (n >= 6) this.ach('half_end'); if (n >= ENDINGS.length) this.ach('all_end');
    this.post.u.fadeColor.value.set(E.color); this.fxT.fade = 1; this.audio.sfx('ending');
    for (const c of ['amb2', 'phone', 'radio', 'elev']) this.audio.loop(c, null);
    if (!o.keepAmb) this.audio.loop('amb', null, { fade: 3 });
    document.exitPointerLock?.();
    await new Promise(r => setTimeout(r, (o.delay ?? 2600) / this.ts));
    this.ui.subtitle(null);
    this.onEnding?.(E, ENDINGS.indexOf(E) + 1, n, s.endings[id] === 1);
  }
  // ── 저장 / 불러오기
  applyLabel(id, patch) { const rec = this.world.props.get(id); const lab = rec?.obj.getObjectByName('label'); if (lab) updateTextTexture(lab.userData.tex, patch); }
  serialize() {
    const p = this.player; const ex = this.expectSpec;
    return { v: 1, run: JSON.parse(JSON.stringify(this.run)), pos: [p.pos.x, p.pos.z], yaw: p.yaw, pitch: p.pitch, room: (this.world.roomAt(p.pos.x, p.pos.z) || this.room)?.id,
      doors: [...this.world.doors.values()].map(d => [d.id, d.open ? 1 : 0, d.locked ? 1 : 0]),
      props: this.world.dynamicProps.filter(x => x.def.id).map(x => [x.def.id, x.taken ? 1 : 0, x.drawerOpen ? 1 : 0, x.leafOpen ? 1 : 0]),
      expect: ex ? { to: ex.to, wrong: ex.wrong && typeof ex.wrong === 'object' ? ex.wrong : null, allow: ex.allow, strict: ex.strict, hit: [...ex.hit] } : null };
  }
  loadState(st) {
    this.clearTimers(); this.narr.token++; this.audio.stopVoice(); this.ui.subtitle(null); this.ui.closeModal(true);
    for (const c of ['phone', 'radio', 'elev', 'amb2']) this.audio.loop(c, null);
    this.run = Object.assign(newRun(), st.run); this.S.run = this.run;
    for (const k of ['onCall', 'ringing', 'copying', 'stairBusy', 'ended', 'outEnd', 'metaEnd', 'archEnd']) delete this.run.flags[k];
    const D = new Map(st.doors.map(d => [d[0], d])); for (const d of this.world.doors.values()) { const x = D.get(d.id); d.open = !!x?.[1]; d.anim = d.target = d.open ? 1 : 0; d.locked = x ? !!x[2] : d.locked; }
    const P = new Map(st.props.map(x => [x[0], x])); for (const rec of this.world.dynamicProps) { const x = P.get(rec.def.id); rec.taken = !!x?.[1]; rec.drawerOpen = !!x?.[2]; rec.leafOpen = !!x?.[3]; }
    this.expectSpec = st.expect ? { ...st.expect, allow: st.expect.allow || [], hit: new Set(st.expect.hit || []) } : null;
    for (const [id, patch] of Object.entries(this.run.labels || {})) this.applyLabel(id, patch);
    this.player.spawn(st.pos, st.yaw); this.player.pitch = st.pitch || 0; this.player.frozen = false; this.player.roll = 0;
    this.blackout = false; this.fxT = { distort: 0, ca: .35, desat: .12, fade: 0, grain: .06 }; this.fx.fade = 1; this.post.u.fadeColor.value.set(0);
    this.world.trail = []; this.world.refresh(); this.updInv();
    this.running = true; this.paused = false; this.input.enabled = true; this.input.lastInput = performance.now(); this.lastAuto = performance.now();
    const room = this.world.roomAt(st.pos[0], st.pos[1]) || this.world.rooms.get(st.room); this.room = room;
    this.fogT = room.fog || [0x22231f, 5, room.loopRoom ? 13 : 24]; this.audio.loop('amb', room.amb || 'amb_hum');
    this._cullT = 1; this.emit('resume', { room: room.id });
  }
  capture(w = 256, h = 144) {
    try {
      this.post.render(this.scene, this.camera, null);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const src = this.renderer.domElement;
      const sa = src.width / src.height, da = w / h; let sw = src.width, sh = src.height, sx = 0, sy = 0;
      if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; } else { sh = sw / da; sy = (src.height - sh) / 2; }
      g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h); return c.toDataURL('image/jpeg', .62);
    } catch { return null; }
  }
  saveTo(slot, thumb) {
    if (!this.running) return false;
    const R = this.world.roomAt(this.player.pos.x, this.player.pos.z) || this.room; const data = { ts: Date.now(), time: this.run.time, room: R?.id, roomName: R?.name || '', runs: this.save.runs, defy: this.run.defy, thumb: thumb ?? this.capture(), state: this.serialize() };
    writeSave(this.save); return writeSlot(slot, data);
  }
  autosave() { if (!this.running || this.paused || this.ui.modalOpen) return; if (this.saveTo('auto')) this.onAutosave?.(); }
  // ── 타이머
  after(sec, fn) { const t = { at: this.t + sec, fn }; this.timers.push(t); return () => t.dead = true; }
  clearTimers() { this.timers.length = 0; }
  wait(sec) { return new Promise(r => this.after(sec, r)); }
  // ── 상호작용
  pick(sx, sy) {
    const v = tmpV2.set(sx == null ? 0 : (sx / innerWidth) * 2 - 1, sy == null ? 0 : -(sy / innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera); const cp = this.camera.position;
    const cand = this.world.interactables.filter(o => { if (!o.visible) return false; let p = o.parent; while (p) { if (!p.visible) return false; p = p.parent; } const wp = o.getWorldPosition(tmpV); return wp.distanceTo(cp) < 3.4; });
    const hits = this.ray.intersectObjects(cand, true);
    // 벽 너머를 고르지 않도록 정적 지오메트리와 비교는 생략(거리 2.5m 로 충분)
    for (const h of hits) { let o = h.object; while (o && !o.userData.prop && !o.userData.door) o = o.parent; if (o) return { prop: o.userData.prop, door: o.userData.door, dist: h.distance }; }
    return null;
  }
  nameOf(hit) {
    if (!hit) return null;
    if (hit.door) { const d = this.world.doors.get(hit.door); if (d.type === 'elevator') return '엘리베이터 문'; if (d.type === 'stair') return '계단 문'; return d.sign ? `문 (${d.sign})` : '문'; }
    const rec = this.world.props.get(hit.prop); const it = rec?.def.interact; if (!it) return null;
    if (it.type === 'drawer') return rec.drawerOpen ? '서랍 닫기' : it.name; if (it.type === 'fridge') return rec.leafOpen ? '냉장고 닫기' : it.name;
    return it.name;
  }
  async use(hit) {
    if (!hit || !this.running) return; const G = this.G;
    if (hit.door) return this.useDoor(this.world.doors.get(hit.door));
    const rec = this.world.props.get(hit.prop); const it = rec.def.interact; const id = rec.def.id;
    switch (it.type) {
      case 'drawer': rec.drawerOpen = !rec.drawerOpen; this.audio.sfx('drawer'); if (rec.drawerOpen) { this.run.drawers[id] = true; this.world.refresh(); } else { this.run.drawers[id] = false; setTimeout(() => this.world.refresh(), 250); } break;
      case 'fridge': rec.leafOpen = !rec.leafOpen; this.audio.sfx('door_open', { rate: 1.6, vol: .5 }); break;
      case 'computer': this.openComputer(it.pc); break;
      case 'doc': this.openDoc(it.doc); break;
      case 'inspect': this.inspect(rec, it); break;
      case 'take': case 'duck': this.inspect(rec, it, true); break;
      case 'inspectWall': { const line = typeof it.line === 'function' ? it.line(this.S) : it.line; if (line) this.say(line, { interrupt: !this.narr.busy }); if (it.ach) this.ach(it.ach); break; }
      case 'sit': { const p = rec.obj.position; const r = rec.obj.rotation.y; this.player.sit(p.x, p.z, r + Math.PI); this.audio.sfx('click', { rate: .5 }); break; }
    }
    this.emit('use:' + id, { type: it.type, rec });
    if (it.type === 'sit') this.emit('sit:' + id, {});
  }
  useDoor(d) {
    if (!d) return;
    if (d.type === 'elevator') { this.emit('door:' + d.id, { result: 'elevator' }); return; }
    if (d.type === 'stair') { this.emit('door:' + d.id, { result: 'use' }); return; }
    if (d.locked) {
      if (d.type === 'keycard' && this.run.items.includes('keycard')) { d.locked = false; this.audio.sfx('beep'); this.emit('door:' + d.id, { result: 'unlock' }); }
      else { this.audio.sfx('door_locked'); this.emit('door:' + d.id, { result: 'locked' }) || this.say(d.type === 'keycard' ? 'card_need' : 'locked', { ifIdle: true }); return; }
    }
    const open = !d.open; this.world.setDoor(d.id, open); this.audio.sfx(open ? 'door_open' : 'door_close');
    this.emit('door:' + d.id, { result: open ? 'open' : 'close' });
  }
  openDoc(docId) {
    const D = DOCS[docId]; const body = typeof D.body === 'function' ? D.body(this.S) : D.body;
    this.ui.doc(D.title, body); this.audio.sfx('pickup'); this.gotDigit(D.digit); this.emit('read:' + docId, {});
  }
  openComputer(pc) {
    const C = COMPUTERS[pc]; const mails = C.mails.map(k => ({ id: k, ...MAILS[k] })).filter(m => !m.cond || m.cond(this.S)).map(m => ({ ...m, bodyText: typeof m.body === 'function' ? m.body(this.S) : m.body, read: this.run.flags['read_' + m.id] }));
    this.audio.sfx('click');
    this.ui.computer(C.title, mails, m => { this.run.flags['read_' + m.id] = true; this.audio.sfx('click'); this.gotDigit(m.digit); this.emit('read:' + m.id, {}); });
    this.emit('pc:' + pc, {});
  }
  gotDigit(dg) { if (!dg) return; const s = this.save; if (s.digits[dg[0]]) return; s.digits[dg[0]] = dg[1]; writeSave(s); const n = Object.keys(s.digits).length; this.ui.toast('암호 조각 ' + n + '/4', `${dg[0] + 1}번째 자리: ${dg[1]}`, '✎'); if (n >= 4) this.ach('code'); }
  inspect(rec, it, take) {
    const obj = rec.obj.clone(true); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.visible = true;
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()).length() || .3; const c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); obj.position.sub(c); holder.add(obj); holder.scale.setScalar(.42 / size); holder.rotation.set(.35, .6, 0);
    this.inspectScene.add(holder); this.inspecting = holder; this.audio.sfx('pickup');
    const btns = take ? [{ a: 'take', t: it.type === 'duck' ? '주머니에 넣기' : '가져가기' }] : [];
    this.ui.inspect(it.name, it.desc || '', btns, a => { if (a === 'take') { this.take(rec, it); this.ui.closeModal(); } });
    this.ui._onClose = () => { this.inspectScene.remove(holder); this.inspecting = null; };
    if (it.line && !take) this.say(it.line, { interrupt: !this.narr.busy });
    if (it.ach && !take) this.ach(it.ach);
  }
  take(rec, it) {
    rec.taken = true; rec.obj.visible = false; this.audio.sfx('pickup');
    if (it.type === 'duck') { const s = this.save; const first = !Object.keys(s.ducks).length; s.ducks[rec.def.id] = true; writeSave(s); const n = Object.keys(s.ducks).length; this.ach('duck1'); this.ui.toast('고무 오리 ' + n + '/5', '꽥.', '🦆'); if (n >= 5) { this.ach('ducks'); this.say('duck_all', { interrupt: true }); } else if (first) this.say('duck_1', { interrupt: !this.narr.busy }); }
    if (it.item) { this.run.items.push(it.item); this.updInv(); if (it.line) this.say(it.line, { interrupt: true }); if (it.ach) this.ach(it.ach); }
    this.emit('take:' + rec.def.id, {});
  }
  updInv() { const N = { keycard: '카드키', cup: '물 한 컵', can: '0427 캔' }; this.ui.inv(this.run.items.map(i => N[i] || i)); }
  bindInspectDrag(el) {
    let last = null; const down = (x, y) => { if (this.inspecting) last = [x, y]; }, move = (x, y) => { if (!last || !this.inspecting) return; this.inspecting.rotation.y += (x - last[0]) * .01; this.inspecting.rotation.x += (y - last[1]) * .01; last = [x, y]; };
    const m = document.getElementById('modal');
    m.addEventListener('pointerdown', e => down(e.clientX, e.clientY)); addEventListener('pointermove', e => move(e.clientX, e.clientY)); addEventListener('pointerup', () => last = null);
  }
  // ── 이야기 API
  makeAPI() {
    const g = this;
    return {
      get S() { return g.S; }, get run() { return g.run; }, get save() { return g.save; }, get room() { return g.room; }, get player() { return g.player; }, get world() { return g.world; }, get t() { return g.t; },
      ui: g.ui, audio: g.audio,
      say: (ids, o) => g.say(ids, o), once: (ids, o) => g.say(ids, { ...o, once: true }), busy: () => g.narr.busy,
      choice: (p, opts, t) => g.choice(p, opts, t), defy: (k, l) => g.defy(k, l), tier: () => g.tier(),
      expect: spec => { g.expectSpec = spec ? { hit: new Set(), allow: [], ...spec } : null; }, expecting: () => g.expectSpec,
      ending: (id, o) => g.ending(id, o), ach: id => g.ach(id), flag: (k, v) => v === undefined ? g.run.flags[k] : (g.run.flags[k] = v),
      door: (id, op) => { const d = g.world.doors.get(id); if (!d) return; if (op === 'open') { g.world.setDoor(id, true); } else if (op === 'close') g.world.setDoor(id, false); else if (op === 'lock') d.locked = true; else if (op === 'unlock') d.locked = false; return d; },
      sfx: (id, o) => g.audio.sfx(id, o), loop: (c, id, o) => g.audio.loop(c, id, o), silence: (s, d) => g.audio.silence(s, d),
      fx: (o) => Object.assign(g.fxT, o), wait: s => g.wait(s), after: (s, fn) => g.after(s, fn),
      lights: (room, on) => { g.run.lightsOff[room] = !on; }, blackout: on => { g.blackout = on; },
      teleport: (x, z, yaw) => { g.player.pos.x = x; g.player.pos.z = z; if (yaw != null) g.player.yaw = yaw; const r = g.world.roomAt(x, z); if (r && r !== g.room) g.enterRoom(r, g.room); },
      freeze: on => { g.player.frozen = on; }, refresh: () => g.world.refresh(), prop: id => g.world.props.get(id),
      setLabel: (id, patch) => { (g.run.labels ||= {})[id] = patch; g.applyLabel(id, patch); },
      item: (k, add) => { if (add === undefined) return g.run.items.includes(k); if (add) g.run.items.push(k); else g.run.items = g.run.items.filter(i => i !== k); g.updInv(); },
      doc: id => g.openDoc(id), stand: () => g.player.stand(), lookAt: (x, z) => { g.player.yaw = Math.atan2(-(x - g.player.pos.x), -(z - g.player.pos.z)); },
      emit: (n, e) => g.emit(n, e), persist: () => writeSave(g.save), fadeColor: hex => g.post.u.fadeColor.value.set(hex),
      hush: () => { g.narr.token++; g.audio.stopVoice(); g.narr.cancel?.(); g.narr.chain = Promise.resolve(); g.ui.subtitle(null); }, sit: (x, z, yaw, eye) => g.player.sit(x, z, yaw, eye),
    };
  }
  // ── 프레임
  frame(dt) {
    if (this.paused) return;
    dt *= this.ts; this.t += dt; const run = this.run;
    if (this.running) {
      run.time += dt; this.save.totalTime = (this.save.totalTime || 0) + dt;
      for (const tm of [...this.timers]) if (!tm.dead && this.t >= tm.at) { tm.dead = true; try { tm.fn(); } catch (e) { console.error(e); } }
      this.timers = this.timers.filter(t => !t.dead);
    }
    const modal = this.ui.modalOpen; this.input.enabled = this.running && !modal;
    // 탭 → 상호작용
    for (const tp of this.input.taps.splice(0)) { if (modal || !this.running) continue; const hit = tp.center ? this.pick() : this.pick(tp.x, tp.y); if (hit) this.use(hit); }
    const mv = this.running ? this.player.update(dt, this.input) : 0;
    // 방 변화
    const R = this.world.roomAt(this.player.pos.x, this.player.pos.z);
    if (R && R !== this.room && this.running) { const from = this.room; this.enterRoom(R, from); }
    // 트리거·순간이동
    if (this.running) {
      const { x, z } = this.player.pos;
      for (const tr of this.world.triggers) { const inside = this.world.inBox(tr.box, x, z); if (inside && !tr._in) this.emit('trigger:' + tr.id, {}); tr._in = inside; }
      for (const tp of this.world.teleports) if (this.world.inBox(tp.box, x, z)) { this.player.pos.x += tp.d[0]; this.player.pos.z += tp.d[1]; const r2 = this.world.roomAt(this.player.pos.x, this.player.pos.z); this.room = r2; this.run.visits[r2.id] = (this.run.visits[r2.id] || 0) + 1; this._cullT = 1; this.emit('teleport:' + tp.id, {}); }
      this.track(dt, mv);
    }
    // 마우스오버 안내
    if ((this._hov = (this._hov || 0) + dt) > .12) { this._hov = 0; const h = this.running && !modal ? this.pick() : null; this.hover = h; const nm = this.nameOf(h); if (nm !== this._lastPrompt) { this._lastPrompt = nm; this.ui.prompt(nm); } }
    this.world.update(dt);
    this.updateLights(dt);
    // 효과 보간
    const k = Math.min(1, dt * 2.2); for (const key in this.fxT) this.fx[key] += (this.fxT[key] - this.fx[key]) * (key === 'fade' ? Math.min(1, dt * 1.2) : k);
    const u = this.post.u; u.time.value = this.t; const st = this.save.settings; const rm = st.reduceMotion;
    u.distort.value = rm ? 0 : this.fx.distort; u.ca.value = this.fx.ca * (rm ? .3 : 1); u.desat.value = this.fx.desat; u.fade.value = this.fx.fade;
    u.grain.value = st.grain ? this.fx.grain : 0; u.vig.value = st.vignette ? .55 : .12; this.player.bobScale = rm ? 0 : 1;
    if (this.fogT) { const F = this.scene.fog; F.color.lerp(tmpC.set(this.fogT[0]), k); F.near += (this.fogT[1] - F.near) * k; F.far += (this.fogT[2] - F.far) * k; this.scene.background.copy(F.color); }
    if ((this._slow = (this._slow || 0) + dt) > 1) { this._slow = 0; this.world.tickClocks(this.S); if (this.running) { this.world.trail.push([this.player.pos.x, this.player.pos.z]); if (this.world.trail.length > 600) this.world.trail.shift(); } }
    if ((this._cc = (this._cc || 0) + dt) > .25 && this.room?.id === 'control') { this._cc = 0; this.world.tickCctv(this.player, this.t); }
    if (this.inspecting) this.inspecting.rotation.y += dt * .15;
    if ((this._cullT = (this._cullT || 0) + dt) > .1) { this._cullT = 0; const cp = this.camera.position; this.world.cull(cp, this.scene.fog.far + 2, (this.world.roomAt(cp.x, cp.z) || this.room)?.id); }
    const RI = this.renderer.info; RI.autoReset = false; RI.reset();
    this.post.render(this.scene, this.camera, this.inspecting ? { scene: this.inspectScene, camera: this.inspectCam } : null);
    this.stats = { calls: RI.render.calls, tris: RI.render.triangles };
    this.autoQuality();
  }
  updateLights(dt) {
    const cp = this.camera.position; const room = this.room;
    if ((this._lt = (this._lt || 0) + dt) > .2) {
      this._lt = 0;
      const scored = this.world.anchors.map(a => ({ a, d: Math.hypot(a.x - cp.x, a.z - cp.z) + (a.room === room?.id ? 0 : 5) })).filter(s => s.d < 16).sort((p, q) => p.d - q.d).slice(0, POOL).map(s => s.a);
      const free = this.pool.filter(l => !scored.includes(l.userData.anchor));
      for (const a of scored) if (!this.pool.some(l => l.userData.anchor === a)) { const l = free.shift(); if (l) { l.userData.anchor = a; l.userData.cur = 0; l.position.set(a.x, a.y - .85, a.z); l.color.setHex(a.color); } }
      for (const l of free) l.userData.anchor = l.userData.anchor && scored.includes(l.userData.anchor) ? l.userData.anchor : null;
    }
    for (const l of this.pool) {
      const a = l.userData.anchor; let target = 0;
      if (a && !this.blackout && !this.run.lightsOff[a.room]) { target = 5.2 * a.k; if ((a.flick || (this.titleMode && a === this.titleFlick)) && !this.save.settings.reduceFlicker) { const n = Math.sin(this.t * 37 + a.seed) * Math.sin(this.t * 3.1 + a.seed * 2); if (n > .82) target *= .15; } }
      l.userData.cur += (target - l.userData.cur) * Math.min(1, dt * 6); l.intensity = l.userData.cur; l.visible = l.intensity > .01;
    }
    // 방 조명 패널 / 주변광
    for (const r of this.world.rooms.values()) if (r.panelMat) { const off = this.blackout || this.run.lightsOff[r.id]; r.panelMat.emissive.setHex(off ? 0x000000 : 0xfffff4); r.panelMat.color.setHex(off ? 0x333333 : 0xffffff); }
    const dark = this.blackout || this.run.lightsOff[room?.id];
    const hT = room?.outdoor ? 2.2 : dark ? .03 : .55 * (room?.light ?? 1);
    this.hemi.intensity += (hT - this.hemi.intensity) * Math.min(1, dt * 3);
  }
  // ── Tracker: 가만히 있기 / 맴돌기 / 천장 보기
  track(dt, mv) {
    const T = this.trk; const now = performance.now(); const p = this.player;
    const idle = (now - this.input.lastInput) / 1000; this.run.idle = idle;
    const lv = [20, 45, 90, 180, 300].filter(s => idle >= s).length;
    if (lv > T.idleLv) { T.idleLv = lv; this.emit('idle', { level: lv, secs: idle }); if (lv >= 5) this.ach('idle5'); }
    if (lv < T.idleLv) T.idleLv = lv;
    // 맴돌기: 0.15초마다 이동 방향 누적 회전
    if (now - T.lastSample > 150) {
      T.lastSample = now; T.hist.push([p.pos.x, p.pos.z, now]); while (T.hist.length && now - T.hist[0][2] > 9000) T.hist.shift();
      const n = T.hist.length;
      if (n >= 3) {
        const [ax, az] = T.hist[n - 2], [bx, bz] = T.hist[n - 1]; const dx = bx - ax, dz = bz - az;
        if (Math.hypot(dx, dz) > .05) { const ang = Math.atan2(dz, dx); if (T.lastAng != null) { let d = ang - T.lastAng; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; T.turn += d; } T.lastAng = ang; }
        let cx = 0, cz = 0; for (const h of T.hist) { cx += h[0]; cz += h[1]; } cx /= n; cz /= n; const rad = Math.max(...T.hist.map(h => Math.hypot(h[0] - cx, h[1] - cz)));
        if (rad > 3.2) { T.turn = 0; }
        if (Math.abs(T.turn) > Math.PI * 4) { T.turn = 0; T.hist.length = 0; this.emit('circle', {}); }
      }
      T.turn *= .995;
    }
    // 천장 보기
    if (p.pitch > .95) { T.ceil += dt; if (T.ceil > 6) { T.ceil = -30; this.emit('ceiling', {}); } } else if (T.ceil > 0) T.ceil = 0; else if (T.ceil < 0) T.ceil = Math.min(0, T.ceil + dt);
  }
  // 적응형 화질: 실제 프레임 시간(ms)의 이동 평균으로 판단. 2초 창마다 평가, 내린 직후엔 잠시 유예.
  autoQuality() {
    const now = performance.now(), A = this.fpsAcc; const ms = now - (A.last || now); A.last = now;
    if (this.q !== 'auto' || !this.running || this.paused || ms <= 0 || ms > 250) return;
    A.ft = A.ft ? A.ft * .95 + ms * .05 : ms; A.t += ms;
    if (A.t < 2000) return; A.t = 0; if (now < (A.hold || 0)) return;
    if (A.ft > 24 && A.lvl > 0) { A.lvl--; A.up = 0; A.hold = now + 3000; this.quality('auto'); }
    else if (A.ft < 15 && A.lvl < 2) { if (++A.up >= 3) { A.up = 0; A.lvl++; A.hold = now + 3000; this.quality('auto'); } }
    else A.up = 0;
  }
}
const tmpV = new THREE.Vector3(), tmpC = new THREE.Color(), tmpV2 = new THREE.Vector2();
