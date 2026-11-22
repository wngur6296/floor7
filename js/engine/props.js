// 기본 도형(프리미티브) 모델 빌더 — GLB 모델이 없을 때 쓰는 대체 모델.
// 규칙: 원점 = 바닥 중심, 앞면 = +Z. userData.size=[폭,깊이] 는 충돌 영역.
// 상호작용 부품에는 name 을 붙인다: 'drawer', 'screen', 'leaf', 'handset' 등.
import * as THREE from 'three';
import { textTexture, screenCanvas } from './proctex.js';
import { Reflector } from '../../vendor/Reflector.js';

const gcache = new Map();
function boxG(w, h, d) { const k = `b${w},${h},${d}`; if (!gcache.has(k)) gcache.set(k, new THREE.BoxGeometry(w, h, d)); return gcache.get(k); }
function cylG(rt, rb, h, s = 10) { const k = `c${rt},${rb},${h},${s}`; if (!gcache.has(k)) gcache.set(k, new THREE.CylinderGeometry(rt, rb, h, s)); return gcache.get(k); }

export function makeBuilders(M) {
  const B = (g, w, h, d, m, x, y, z, name) => { const o = new THREE.Mesh(boxG(w, h, d), M(m)); o.position.set(x, y, z); if (name) o.name = name; g.add(o); return o; };
  const C = (g, rt, rb, h, m, x, y, z, s) => { const o = new THREE.Mesh(cylG(rt, rb, h, s), M(m)); o.position.set(x, y, z); g.add(o); return o; };
  const P = (g, w, h, tex, x, y, z, name, basic = true) => { const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshLambertMaterial({ map: tex }); const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); o.position.set(x, y, z); if (name) o.name = name; g.add(o); return o; };
  const G = (size) => { const g = new THREE.Group(); g.userData.size = size; return g; };
  const textPlane = (g, o, w, h, x, y, z, lit = true) => { const t = textTexture({ ...o, w: o.pw || 512, h: o.ph || Math.round(512 * h / w) }); const p = P(g, w, h, t, x, y, z, 'label', !lit); p.userData.tex = t; return p; };

  const L = {
    desk(o) { const g = G([1.4, .7]);
      B(g, 1.4, .04, .7, 'deskTop', 0, .74, 0); B(g, .04, .72, .66, 'deskLeg', -.68, .36, 0);
      B(g, .42, .66, .66, 'deskLeg', .48, .35, 0); B(g, 1.3, .4, .02, 'deskLeg', 0, .5, -.33);
      // 서랍은 위가 열린 트레이. 속이 찬 상자면 메모·오리가 면을 뚫고 나온다.
      const dr = new THREE.Group(); dr.name = 'drawer'; dr.position.set(.48, .58, .03); g.add(dr);
      B(dr, .36, .012, .56, 'deskTop', 0, -.084, 0);           // 바닥
      B(dr, .012, .16, .56, 'deskTop', -.174, -.01, 0);         // 옆
      B(dr, .012, .16, .56, 'deskTop', .174, -.01, 0);
      B(dr, .36, .16, .012, 'deskTop', 0, -.01, -.274);         // 뒤
      B(dr, .38, .18, .02, 'deskTop', 0, 0, .29);               // 앞판
      B(dr, .14, .02, .02, 'chrome', 0, 0, .31);
      return g; },
    chair(o) { const g = G([.55, .55]);
      C(g, .3, .3, .04, 'dark', 0, .03, 0, 5); C(g, .03, .03, .42, 'chrome', 0, .25, 0, 6);
      B(g, .5, .08, .48, o.mat || 'fabric', 0, .48, 0); B(g, .46, .55, .06, o.mat || 'fabric', 0, .82, -.24); return g; },
    monitor(o) { const g = G([.5, .25]);
      B(g, .2, .02, .16, 'dark', 0, .01, 0); B(g, .04, .3, .03, 'dark', 0, .16, -.03);
      B(g, .56, .36, .03, 'dark', 0, .36, 0); const sc = screenCanvas(256, 160); drawScreen(sc, o.text || ['정연 인트라넷', '', '로그인 됨: ' + (o.user || '0427')]);
      const s = P(g, .52, .32, sc.tex, 0, .36, .017, 'screen'); s.userData.sc = sc; return g; },
    keyboard() { const g = G(null); B(g, .44, .02, .14, 'dark', 0, .01, 0); return g; },
    phone() { const g = G(null); B(g, .2, .06, .22, 'dark', 0, .03, 0); B(g, .2, .045, .06, 'dark', 0, .085, -.06, 'handset'); B(g, .12, .005, .08, 'chrome', 0, .062, .05); return g; },
    partition(o) { const w = o.w || 1.6, h = o.h || 1.25; const g = G([w, .08]); B(g, w, h, .06, 'fabric', 0, h / 2, 0); B(g, w, .03, .08, 'chrome', 0, h, 0); return g; },
    cabinet(o) { const h = o.h || 1.3; const g = G([.5, .6]); B(g, .48, h, .6, 'cabinet', 0, h / 2, 0); const n = Math.round(h / .33);
      for (let i = 0; i < n; i++) { const d = B(g, .44, h / n - .03, .02, 'cabinet', 0, (i + .5) * h / n, .305, i === n - 1 ? 'drawer' : null); B(d, .12, .02, .02, 'chrome', 0, h / n * .3, .015); } return g; },
    plant(o) { const s = o.scale || 1; const g = G([.4, .4]); C(g, .17, .13, .32, 'pot', 0, .16, 0, 8);
      const f = new THREE.Group(); f.name = 'foliage'; f.position.y = .32; g.add(f);
      const ico = new THREE.IcosahedronGeometry(.18, 0);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(ico, M('leaf')); const a = i * 1.1; m.position.set(Math.cos(a) * .1, .15 + i * .09, Math.sin(a) * .1); m.scale.setScalar(.9 - i * .08); f.add(m); }
      f.scale.setScalar(s); return g; },
    copier() { const g = G([1, .7]); B(g, 1, .9, .7, 'plasticW', 0, .45, 0); B(g, .9, .12, .6, 'plasticG', 0, .96, 0); B(g, .3, .06, .2, 'dark', .3, 1.05, .2); B(g, .4, .02, .3, 'plasticW', -.6, .8, 0); return g; },
    vending(o) { const g = G([1, .8]); B(g, 1, 1.9, .8, 'vend', 0, .95, 0); const t = textTexture({ w: 256, h: 512, bg: '#1d2a3a', fg: '#e8f4ff', lines: ['#정연', '음료', '', '0427 ₩0', '', '커피 ₩600', '물 ₩500'] });
      P(g, .7, 1.4, t, -.08, 1.15, .401, 'screen'); B(g, .16, .5, .02, 'dark', .38, 1.1, .41); B(g, .6, .18, .05, 'dark', -.08, .3, .41); return g; },
    fridge() { const g = G([.7, .7]); B(g, .7, 1.8, .66, 'plasticW', 0, .9, -.02); const d = new THREE.Group(); d.name = 'leaf'; d.position.set(-.35, 0, .32); g.add(d); B(d, .7, 1.78, .04, 'plasticW', .35, .9, 0); B(d, .03, .4, .04, 'chrome', .62, 1.2, .04); return g; },
    cooler() { const g = G([.35, .35]); B(g, .32, 1, .32, 'plasticW', 0, .5, 0); C(g, .14, .14, .42, 'water', 0, 1.22, 0, 10); return g; },
    radio() { const g = G(null); B(g, .36, .2, .14, 'wood', 0, .1, 0); const t = textTexture({ w: 256, h: 128, bg: '#222', fg: '#f7b54a', lines: ['FM 88.0'], size: 46, grain: false }); const p = P(g, .14, .07, t, .08, .12, .071, 'label'); p.userData.tex = t; C(g, .045, .045, .01, 'dark', -.09, .1, .072, 10).rotation.x = Math.PI / 2; return g; },
    arcade() { const g = G([.7, .8]); B(g, .7, 1.0, .8, 'arcade', 0, .5, 0); B(g, .7, .8, .5, 'arcade', 0, 1.4, -.15); B(g, .7, .12, .9, 'arcade', 0, 1.86, -.05); B(g, .62, .08, .3, 'dark', 0, 1.02, .3);
      const sc = screenCanvas(256, 200); const s = P(g, .54, .42, sc.tex, 0, 1.42, .105, 'screen'); s.rotation.x = -.18; s.userData.sc = sc;
      const t = textTexture({ w: 256, h: 64, bg: '#2a0838', fg: '#ff74e8', lines: ['HEXMOON'], size: 40, grain: false }); P(g, .66, .12, t, 0, 1.86, .41); return g; },
    table(o) { const w = o.w || 1.2, d = o.d || .8; const g = G([w, d]); B(g, w, .04, d, o.mat || 'laminate', 0, .74, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, .04, .72, .04, 'chrome', sx * (w / 2 - .05), .36, sz * (d / 2 - .05)); return g; },
    shelf(o) { const w = o.w || 1.2; const g = G([w, .45]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, .04, 2, .04, 'chrome', sx * (w / 2 - .02), 1, sz * .2);
      for (let i = 0; i < 5; i++) { B(g, w, .03, .45, 'metal', 0, .1 + i * .45, 0); if (i < 4) for (let k = 0; k < 3; k++) if ((i * 3 + k) % 4 !== 1) B(g, w / 3 - .06, .3, .35, o.box || 'cardboard', (k - 1) * w / 3, .27 + i * .45, 0); }
      return g; },
    box(o) { const s = o.s || .5; const g = G([s, s]); B(g, s, s * .8, s, 'cardboard', 0, s * .4, 0); return g; },
    keypad() { const g = G(null); B(g, .14, .2, .03, 'metal', 0, 0, 0); for (let i = 0; i < 12; i++) B(g, .03, .025, .01, 'dark', ((i % 3) - 1) * .038, .055 - Math.floor(i / 3) * .035, .02); B(g, .04, .01, .01, 'red', 0, .085, .02); return g; },
    cardreader() { const g = G(null); B(g, .1, .15, .03, 'dark', 0, 0, 0); B(g, .02, .02, .01, 'red', 0, .05, .02, 'led'); return g; },
    elevpanel() { const g = G(null); B(g, .2, .5, .02, 'chrome', 0, 0, 0); for (let i = 0; i < 10; i++) C(g, .022, .022, .01, 'plasticW', ((i % 2) - .5) * .07, .17 - Math.floor(i / 2) * .07, .012, 10).rotation.x = Math.PI / 2; return g; },
    console(o) { const w = o.w || 3; const g = G([w, .8]); B(g, w, .8, .8, 'dark', 0, .4, 0); const top = B(g, w, .05, .9, 'metal', 0, .82, .03); top.rotation.x = .12; return g; },
    bigbutton(o) { const g = G(null); C(g, .1, .1, .05, 'dark', 0, .025, 0, 14); C(g, .075, .075, .05, o.color || 'red', 0, .06, 0, 14).name = 'cap'; return g; },
    screenwall(o) { const w = o.w || 3, h = o.h || 1.6; const g = G(null); B(g, w + .1, h + .1, .06, 'dark', 0, 0, 0); const sc = screenCanvas(o.cw || 512, o.ch || 280); const s = P(g, w, h, sc.tex, 0, 0, .035, 'screen'); s.userData.sc = sc; return g; },
    mug(o) { const g = G(null); C(g, .045, .04, .1, o.mat || 'plasticW', 0, .05, 0, 10); return g; },
    duck() { const g = G(null); const b = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), M('duck')); b.scale.set(1.2, .9, 1); b.position.y = .05; g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), M('duck')); h.position.set(.0, .11, .04); g.add(h); B(g, .03, .012, .03, 'beak', 0, .105, .085); return g; },
    keycard() { const g = G(null); B(g, .085, .004, .055, 'card', 0, .002, 0); return g; },
    can() { const g = G(null); const t = textTexture({ w: 256, h: 128, bg: '#c9cdd2', fg: '#333', lines: ['0427'], size: 60 }); const m = new THREE.Mesh(cylG(.033, .033, .12, 12), new THREE.MeshLambertMaterial({ map: t })); m.position.y = .06; g.add(m); return g; },
    photo(o) { const g = G(null); B(g, .2, .26, .02, 'wood', 0, .13, 0); const sc = screenCanvas(128, 160); drawBlurPhoto(sc.ctx, 128, 160); P(g, .17, .22, sc.tex, 0, .13, .011, 'screen', false); g.children[0].rotation.x = -.15; g.children[1].rotation.x = -.15; return g; },
    clock(o) { const g = G(null); C(g, .17, .17, .04, 'plasticW', 0, 0, 0, 20).rotation.x = Math.PI / 2; const sc = screenCanvas(128, 128); const s = P(g, .3, .3, sc.tex, 0, 0, .022, 'screen', false); s.userData.sc = sc; return g; },
    poster(o) { const w = o.w || .6, h = o.h || .85; const g = G(null); textPlane(g, { bg: '#efece0', fg: '#2a2a2a', band: o.band || '#2f4a5a', border: null, ...o }, w, h, 0, 0, .005); return g; },
    sign(o) { const w = o.w || .5, h = o.h || .16; const g = G(null); B(g, w + .02, h + .02, .02, 'dark', 0, 0, 0); textPlane(g, { bg: o.bg || '#1f2a2e', fg: o.fg || '#e8efe9', size: (o.ph || Math.round(512 * h / w)) * .5, grain: false, ...o }, w, h, 0, 0, .011, !o.glow); return g; },
    nameplate(o) { const g = G(null); const p = B(g, .26, .07, .02, 'dark', 0, .04, 0); p.rotation.x = -.4; const tp = textPlane(g, { pw: 256, ph: 70, bg: '#d7c48a', fg: '#2a2416', size: 40, grain: false, ...o }, .24, .06, 0, .043, .012); tp.rotation.x = -.4; return g; },
    calendar(o) { const g = G(null); textPlane(g, { pw: 256, ph: 320, bg: '#fafaf6', fg: '#222', band: '#a33', ...o }, .32, .4, 0, 0, .005); return g; },
    paper(o) { const g = G(null); const p = B(g, .21, .003, .297, 'paper', 0, .002, 0); return g; },
    mirror(o) { const w = o.w || .7, h = o.h || 1.0; const g = G(null); B(g, w + .06, h + .06, .03, 'chrome', 0, 0, 0);
      if (o.real !== false) { const r = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 256, textureHeight: Math.round(256 * h / w), color: 0x9a9a96, clipBias: .003 }); r.position.z = .017; r.name = 'mirror'; throttleMirror(r); g.add(r); }
      else B(g, w, h, .01, 'mirrorFake', 0, 0, .017); return g; },
    lightswitch() { const g = G(null); B(g, .08, .12, .015, 'plasticW', 0, 0, 0); B(g, .025, .045, .015, 'plasticW', 0, 0, .012, 'toggle'); return g; },
    sofa() { const g = G([1.8, .8]); B(g, 1.8, .42, .8, 'fabricR', 0, .21, 0); B(g, 1.8, .45, .2, 'fabricR', 0, .62, -.3); B(g, .2, .25, .8, 'fabricR', -.8, .5, 0); B(g, .2, .25, .8, 'fabricR', .8, .5, 0); return g; },
    trash() { const g = G(null); C(g, .14, .11, .32, 'dark', 0, .16, 0, 10); return g; },
    whiteboard(o) { const w = o.w || 2; const g = G(null); B(g, w + .06, 1.06, .03, 'chrome', 0, 0, 0); textPlane(g, { bg: '#f6f7f4', fg: '#3550a8', font: '"Nanum Pen Script","Apple SD Gothic Neo",cursive', grain: false, ...o }, w, 1, 0, 0, .016); return g; },
    projscreen(o) { const g = G(null); const w = o.w || 2.6, h = o.h || 1.5; B(g, w + .1, .08, .1, 'dark', 0, h / 2 + .04, 0); const t = textTexture({ w: 512, h: 296, bg: '#f4f4f0', fg: '#1d1d1d', lines: o.lines || [''], grain: false }); const p = P(g, w, h, t, 0, 0, .0, 'label'); p.userData.tex = t; return g; },
    cat() { const g = G(null); const m = M('cat'); const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), m); body.scale.set(1, 1.15, 1.4); body.position.set(0, .14, 0); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), m); head.position.set(0, .31, .1); g.add(head);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(.03, .06, 4), m); e.position.set(s * .045, .39, .1); g.add(e); const eye = new THREE.Mesh(new THREE.SphereGeometry(.011, 6, 4), M('emit:#d8ff7a')); eye.position.set(s * .03, .32, .178); g.add(eye); }
      const tail = new THREE.Mesh(cylG(.018, .018, .32, 6), m); tail.position.set(.1, .05, -.17); tail.rotation.set(Math.PI / 2, 0, .6); g.add(tail); return g; },
    placeholder(o) { const s = o.s || [1, 1, 1]; const g = G([s[0], s[2]]); B(g, s[0], s[1], s[2], 'grey', 0, s[1] / 2, 0); if (o.label) textPlane(g, { pw: 256, ph: 96, bg: '#f2e04a', fg: '#111', lines: [o.label], size: 28, grain: false }, Math.min(.6, s[0] * .9), .22, 0, s[1] * .6, s[2] / 2 + .005); return g; },
    car() { const g = G([1.8, 4.2]); B(g, 1.8, .7, 4.2, 'carBody', 0, .55, 0); B(g, 1.6, .55, 2.2, 'carBody', 0, 1.15, -.2); B(g, 1.62, .4, 2.0, 'glass', 0, 1.18, -.2); for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(g, .33, .33, .25, 'dark', sx * .85, .33, sz * 1.35, 12).rotation.z = Math.PI / 2; return g; },
    facade(o) { const w = o.w || 30, h = o.h || 28; const g = G([w, 2]); B(g, w, h, 2, 'facade', 0, h / 2, 0); for (let fl = 0; fl < 8; fl++) B(g, w - 1, .9, .05, 'glassDark', 0, 2.2 + fl * 3.3, 1.01);
      const t = textTexture({ w: 512, h: 96, bg: '#c6c6c0', fg: '#3a3a3a', lines: ['정연빌딩'], size: 60, grain: false }); P(g, 6, 1.1, t, 0, 4.5, 1.06, null, false); B(g, 3, 2.6, .2, 'glassDark', 0, 1.3, 1); return g; },
    lamp() { const g = G(null); B(g, .6, .02, .6, 'emit:#fffef2', 0, 0, 0); return g; },
    bench() { const g = G([1.4, .4]); B(g, 1.4, .05, .4, 'wood', 0, .45, 0); B(g, .05, .45, .35, 'chrome', -.6, .22, 0); B(g, .05, .45, .35, 'chrome', .6, .22, 0); return g; },
    stairsrail() { const g = G([.1, 3]); B(g, .06, 1, .06, 'chrome', 0, .5, 0); B(g, .06, .06, 3, 'chrome', 0, 1, 0); return g; },
    filefolder(o) { const g = G(null); B(g, .24, .32, .02, o.mat || 'folder', 0, .16, 0); return g; },
    blinds(o) { const w = o.w || 1.6, h = o.h || 1.4; const g = G(null); P(g, w, h, null, 0, 0, -.01, null, true).material = M('emit:#f4f6f8'); for (let i = 0; i < 20; i++) { const s = B(g, w, .012, .06, 'plasticW', 0, -h / 2 + (i + .5) * h / 20, .02); s.rotation.x = .9; s.name = 'slat'; } return g; },
  };
  return L;
}
export function drawScreen(sc, lines, opt = {}) {
  const { ctx: g, canvas: c } = sc; g.fillStyle = opt.bg || '#0f2a3a'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, c.width, 22);
  g.fillStyle = opt.fg || '#bfe3ff'; g.font = '600 15px "Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 12, 5 + i * 22));
  sc.tex.needsUpdate = true;
}
function drawBlurPhoto(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a9b6bf'); gr.addColorStop(1, '#6c6458'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.filter = 'blur(6px)';
  for (const [x, y, r] of [[30, 70, 16], [64, 62, 18], [98, 74, 14]]) { g.fillStyle = '#d6b9a0'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#3d3a40'; g.fillRect(x - r * 1.2, y + r, r * 2.4, 80); }
  g.filter = 'none';
}

// 거울 반사 비용 절감: 6m 밖에서는 갱신하지 않고, 저화질에서는 2프레임에 1번만 갱신 (텍스처는 이전 것을 유지)
const _mp = new THREE.Vector3(); export const mirrorCfg = { everyOther: false };
function throttleMirror(r) {
  const orig = r.onBeforeRender; let last = -1;
  r.onBeforeRender = function (renderer, scene, camera) {
    _mp.setFromMatrixPosition(this.matrixWorld); if (_mp.distanceTo(camera.position) > 6) return;
    const f = performance.now(); if (mirrorCfg.everyOther && f - last < 45) return; last = f;
    orig.call(this, renderer, scene, camera);
  };
}
