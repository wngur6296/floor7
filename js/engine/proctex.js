// 절차적 텍스처 (그래픽 교체 전 임시 아트). data/assets.js 의 TEXTURES 에서 proc:'이름' 으로 참조.
// 실제 이미지로 바꾸려면 assets.js 에 url 을 넣으면 된다.
import * as THREE from 'three';

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function noise(g, w, h, amt, alpha = 1) {
  const d = g.getImageData(0, 0, w, h); const a = d.data;
  for (let i = 0; i < a.length; i += 4) { const n = (rnd() - .5) * amt; a[i] += n; a[i + 1] += n; a[i + 2] += n; a[i + 3] *= alpha; }
  g.putImageData(d, 0, 0);
}
const GEN = {
  carpet(g, w, h) { // 사무실 카펫: 회청색 + 미세한 루프 패턴
    g.fillStyle = '#5a6068'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { const v = (rnd() * 26) | 0; g.fillStyle = `rgba(${70 + v},${76 + v},${86 + v},.55)`; g.fillRect(x + (y / 4 % 2) * 2, y, 3, 3); }
    g.strokeStyle = 'rgba(30,34,40,.08)'; g.lineWidth = 1; for (let i = 0; i <= w; i += w / 2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    noise(g, w, h, 18);
  },
  carpetRed(g, w, h) { GEN.carpet(g, w, h); g.fillStyle = 'rgba(120,30,30,.45)'; g.fillRect(0, 0, w, h); },
  ceiling(g, w, h) { // 석고 천장 타일 600 그리드
    g.fillStyle = '#d9d8d0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,90,80,${rnd() * .25})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd()); }
    g.strokeStyle = '#9d9d96'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    noise(g, w, h, 10);
  },
  wallpaper(g, w, h) { // 벽: 위로 갈수록 살짝 어두움(베이크된 느낌), 아래 걸레받이. v=0 이 바닥.
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b9b8a6'); gr.addColorStop(.6, '#cfcdb8'); gr.addColorStop(1, '#c2c0aa');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = .07; for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#fff' : '#776'; g.fillRect(x, 0, 8, h); } g.globalAlpha = 1;
    const bb = h * 0.04; g.fillStyle = '#3d3f3a'; g.fillRect(0, h - bb, w, bb); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - bb - 6, w, 6);
    const sh = g.createLinearGradient(0, 0, 0, h * .08); sh.addColorStop(0, 'rgba(0,0,0,.28)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h * .08);
    noise(g, w, h, 8);
  },
  wallpaperOff(g, w, h) { seed = 77; GEN.wallpaper(g, w, h); g.fillStyle = 'rgba(160,170,120,.08)'; g.fillRect(0, 0, w, h); },
  wallWhite(g, w, h) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8d8d4'); gr.addColorStop(1, '#ecebe6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#8a8a86'; g.fillRect(0, h * .965, w, h * .035); noise(g, w, h, 6); },
  concrete(g, w, h) { g.fillStyle = '#8c8c88'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() > .5 ? 255 : 0},${rnd() > .5 ? 255 : 0},0,0)`; } noise(g, w, h, 30); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,60,55,${rnd() * .2})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rnd() * 20, 0, 7); g.fill(); } },
  tile(g, w, h) { g.fillStyle = '#cfcfc6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9a9a92'; g.lineWidth = 3; for (let i = 0; i <= w; i += w / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } noise(g, w, h, 10); },
  wood(g, w, h) { g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(40,25,10,${.05 + .12 * Math.abs(Math.sin(y * .07 + Math.sin(y * .013) * 4))})`; g.fillRect(0, y, w, 2); } noise(g, w, h, 12); },
  laminate(g, w, h) { g.fillStyle = '#cfc7b6'; g.fillRect(0, 0, w, h); noise(g, w, h, 10); },
  door(g, w, h) { g.fillStyle = '#8e7a62'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(50,30,15,${.04 + .08 * Math.abs(Math.sin(y * .05))})`; g.fillRect(0, y, w, 3); } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 4; g.strokeRect(w * .12, h * .06, w * .76, h * .38); g.strokeRect(w * .12, h * .52, w * .76, h * .4); noise(g, w, h, 8); },
  metal(g, w, h) { g.fillStyle = '#9aa0a4'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { g.fillStyle = `rgba(255,255,255,${rnd() * .06})`; g.fillRect(0, y, w, 1); } noise(g, w, h, 8); },
  grey(g, w, h) { g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6f6f6f'; g.lineWidth = 2; for (let i = 0; i <= w; i += w / 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } },
  asphalt(g, w, h) { g.fillStyle = '#d6d6d2'; g.fillRect(0, 0, w, h); noise(g, w, h, 14); g.fillStyle = '#f4f4f0'; g.fillRect(w * .48, 0, w * .04, h); },
  fabric(g, w, h) { g.fillStyle = '#4c5866'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (rnd() > .5) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, y, 2, 2); } noise(g, w, h, 12); },
  lightpanel(g, w, h) { g.fillStyle = '#fbfbf2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8d8cc'; g.lineWidth = 2; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.strokeStyle = '#888'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); },
};
const cache = new Map();
export function procTexture(name, size = 256) {
  const key = name + size; if (cache.has(key)) return cache.get(key);
  seed = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1;
  const [c, g] = cv(size, size); (GEN[name] || GEN.grey)(g, size, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}
// 글자 텍스처: 포스터·명패·표지판 등. opts: {w,h,bg,fg,lines:[..], size, font, border, align, sub}
export function textTexture(o) {
  const w = o.w || 512, h = o.h || 512; const [c, g] = cv(w, h);
  drawText(g, w, h, o);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData = { canvas: c, opts: o };
  return t;
}
export function drawText(g, w, h, o) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = o.bg || '#f1efe6'; g.fillRect(0, 0, w, h);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = w * .02; g.strokeRect(w * .03, h * .03, w * .94, h * .94); }
  if (o.band) { g.fillStyle = o.band; g.fillRect(0, 0, w, h * .14); }
  const lines = o.lines || [];
  const size = o.size || h / (lines.length + 3);
  g.fillStyle = o.fg || '#222'; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  const lh = size * 1.35; let y = h / 2 - (lines.length - 1) * lh / 2 + (o.dy || 0) * h;
  for (const L of lines) {
    const big = L.startsWith('#'); const txt = big ? L.slice(1) : L; const s = big ? size * 1.6 : size;
    g.font = `${o.weight || (big ? 800 : 600)} ${s}px ${o.font || '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif'}`;
    const x = o.align === 'left' ? w * .08 : w / 2;
    g.fillText(txt, x, y, w * .9); y += big ? lh * 1.3 : lh;
  }
  if (o.grain !== false) { g.globalAlpha = .06; for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() > .5 ? '#000' : '#fff'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.globalAlpha = 1; }
}
export function updateTextTexture(t, patch) { const c = t.userData.canvas; const o = Object.assign(t.userData.opts, patch); drawText(c.getContext('2d'), c.width, c.height, o); t.needsUpdate = true; }
// 동적 화면 (모니터·CCTV·오락기): 캔버스와 텍스처 반환
export function screenCanvas(w = 256, h = 192) { const [c, g] = cv(w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { canvas: c, ctx: g, tex: t }; }
