// data/lines.js 의 모든 대사를 SCRIPT.md 의 "## 12. 전체 대사" 섹션으로 다시 씁니다.
// 사용: node tools/export_script.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { LINES } from '../data/lines.js';
import { ENDINGS } from '../data/endings.js';
const url = new URL('../SCRIPT.md', import.meta.url);
let md = readFileSync(url, 'utf8'); const i = md.indexOf('## 12. 전체 대사'); if (i >= 0) md = md.slice(0, i);
const who = t => t.startsWith('@A ') ? ['서민지(0425, 음성메시지)', t.slice(3)] : t.startsWith('@B ') ? ['관리실 / 라디오', t.slice(3)] : ['안내 음성', t];
const src = readFileSync(new URL('../data/lines.js', import.meta.url), 'utf8');
let out = '## 12. 전체 대사\n\n> `data/lines.js` 에서 자동 생성 (`node tools/export_script.mjs`). 총 ' + Object.keys(LINES).length + '줄.\n';
let lastGroup = null;
for (const [id, t] of Object.entries(LINES)) {
  const at = src.indexOf(`  ${id}:`); const before = src.slice(0, at); const g = (before.match(/\/\/ ── ([^\n]+)/g) || []).pop()?.replace('// ── ', '') || '';
  if (g !== lastGroup) { out += `\n### ${g}\n\n| id | 화자 | 대사 |\n|---|---|---|\n`; lastGroup = g; }
  const [w, txt] = who(t); out += `| \`${id}\` | ${w} | ${txt.replace(/\|/g, '\\|').replace(/\n/g, '<br>')} |\n`;
}
out += '\n### 결말 문구\n\n' + ENDINGS.map((e, k) => `**${k + 1}. ${e.name}** (\`${e.id}\`)\n\n> ${e.text.replace(/\n/g, '  \n> ')}\n`).join('\n');
writeFileSync(url, md + out); console.log('SCRIPT.md 갱신:', Object.keys(LINES).length, '줄');
