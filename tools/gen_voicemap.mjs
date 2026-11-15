// data/story.js 를 훑어 '이벤트 → 그 이벤트에서 나올 대사 id' 지도를 만든다 → data/voicemap.js
// 엔진은 방에 들어갈 때 이 지도로 현재 방·이웃 방의 음성을 미리 받아 둔다. 사용: node tools/gen_voicemap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { LINES } from '../data/lines.js';
import { ROOMS, PROPS, TRIGGERS } from '../data/level.js';
const src = readFileSync(new URL('../data/story.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export const STORY'));
const keyRe = /^\s{2}(?:async\s+)?'?([a-z]+:[\w*]+|[a-z]+)'?\s*(?:\(|:)/gm; const marks = [];
let m; while ((m = keyRe.exec(body))) marks.push([m.index, m[1]]);
const map = {};
for (let i = 0; i < marks.length; i++) {
  const seg = body.slice(marks[i][0], marks[i + 1]?.[0] ?? body.length);
  const ids = [...new Set([...seg.matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]).filter(k => LINES[k] && /[가-힣A-Za-z0-9]/.test(LINES[k].replace(/^@[AB]\s+/, ''))))];
  if (ids.length) map[marks[i][1]] = ids;
}
const roomAt = (x, z) => ROOMS.find(r => x >= r.box[0] && x <= r.box[2] && z >= r.box[1] && z <= r.box[3]);
for (const r of ROOMS) {
  const ids = new Set(map['enter:' + r.id] || []);
  for (const p of PROPS) if (p.id && roomAt(p.p[0], p.p[1])?.id === r.id) for (const k of ['use:', 'sit:']) for (const v of map[k + p.id] || []) ids.add(v);
  for (const t of TRIGGERS) { const c = roomAt((t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2); if (c?.id === r.id) for (const v of map['trigger:' + t.id] || []) ids.add(v); }
  if (ids.size) map['room:' + r.id] = [...ids];
}
writeFileSync(new URL('../data/voicemap.js', import.meta.url), '// 자동 생성: node tools/gen_voicemap.mjs — 이벤트/방 → 미리 받아 둘 대사 음성 id\nexport const VOICEMAP = ' + JSON.stringify(map) + ';\n');
console.log('voicemap', Object.keys(map).length, 'keys');
