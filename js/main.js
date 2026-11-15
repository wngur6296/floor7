// 부트스트랩 + 메뉴 시스템: 로딩 → 메인 메뉴(라이브 3D 배경) → 게임 / 일시정지 / 저장·불러오기 / 설정 / 도전과제 / 엔딩 갤러리 / 크레딧.
import { Game } from './engine/game.js';
import { UI, esc } from './engine/ui.js';
import { Audio } from './engine/audio.js';
import { preloadModels } from './engine/assets.js';
import { loadSave, writeSave, clearSave, newSave, DEFAULT_SETTINGS } from './engine/save.js';
import { listSlots, getSlot, deleteSlot, latestSlot, clearSlots, fmtTime, fmtDate } from './engine/slots.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { ENDINGS } from '../data/endings.js';

const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ui = new UI(); const audio = new Audio(); const save = loadSave(); let game;
const touch = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('touch', touch);
const prog = (p, m) => { $('#ldfill').style.width = (p * 100) + '%'; if (m) $('#ldmsg').textContent = m; };
const sfx = n => { if (audio.ctx) audio.sfx(n); };

// ───────── 화면 스택 ─────────
// base: 'menu' | 'pause' | 'ending' | null(플레이 중). 그 위에 서브 화면(slots/settings/achs/gallery/credits)이 쌓인다.
let base = 'loading', stack = [];
function render() {
  const top = stack[stack.length - 1] || base;
  for (const s of $$('.screen')) s.classList.toggle('on', s.id === top || (s.id === base && stack.length && base !== null && base !== 'ending'));
  document.body.classList.toggle('playing', top === null);
  focusFirst();
}
function setBase(id) { base = id; stack = []; render(); }
function push(id) { stack.push(id); sfx('click'); render(); }
function pop() { if (!stack.length) return false; stack.pop(); writeSave(save); sfx('click'); render(); return true; }

// ───────── 키보드 / 컨트롤러식 포커스 ─────────
function layer() {
  if ($('#confirm').classList.contains('on')) return $('#confirm');
  const top = stack[stack.length - 1] || base; return top ? document.getElementById(top) : null;
}
const focusables = L => $$('button:not(:disabled), .row[data-k]', L).filter(e => e.getClientRects().length && !(e.matches('button') && e.closest('.row[data-k]')));
let sel = null;
function setSel(el, scroll = true) { sel?.classList.remove('sel'); sel = el; if (el) { el.classList.add('sel'); if (scroll) el.scrollIntoView?.({ block: 'nearest' }); } }
function focusFirst() { const L = layer(); if (!L) return setSel(null); const f = focusables(L); setSel(touch ? null : (f.find(e => e.matches('.mlist button, .slot, .ecard, .cbtns .primary')) || f[0]) || null, false); }
document.addEventListener('pointerover', e => { const t = e.target.closest?.('button, .row[data-k]'); const L = layer(); if (t && L?.contains(t) && !t.disabled && !touch) setSel(t, false); });
function moveSel(d, axis) {
  const L = layer(); if (!L) return; const f = focusables(L); if (!f.length) return;
  if (!sel || !f.includes(sel)) return setSel(f[0]);
  const r0 = sel.getBoundingClientRect(), c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best = null, bd = 1e9;
  for (const e of f) { if (e === sel) continue; const r = e.getBoundingClientRect(); const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const p = axis === 'y' ? (c.y - c0.y) * d : (c.x - c0.x) * d, q = axis === 'y' ? Math.abs(c.x - c0.x) : Math.abs(c.y - c0.y);
    if (p <= 2) continue; const sc = p + q * 2.2; if (sc < bd) { bd = sc; best = e; } }
  if (best) { setSel(best); sfx('tick'); }
}
function adjustRow(row, d) {
  const inp = row.querySelector('input[type=range]'); if (inp) { inp.value = +inp.value + d * +inp.step * (inp.dataset.big || 1); inp.dispatchEvent(new Event('input')); return true; }
  const seg = row.querySelector('.seg'); if (seg) { const b = $$('button', seg); const i = b.findIndex(x => x.classList.contains('on')); b[Math.max(0, Math.min(b.length - 1, i + d))].click(); return true; }
  const tog = row.querySelector('.tog'); if (tog) { tog.click(); return true; }
}
addEventListener('keydown', e => {
  if (!game) return;
  const L = layer();
  if (e.code === 'Escape' || e.code === 'Backspace' && L) { e.preventDefault(); goBack(); return; }
  if (e.code === 'KeyP' && base === null && !stack.length && game.running) { pause(); return; }
  if (!L) return;
  const k = e.code;
  if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); moveSel(1, 'y'); }
  else if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); moveSel(-1, 'y'); }
  else if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); const d = (k === 'ArrowLeft' || k === 'KeyA') ? -1 : 1;
    if (sel?.matches('.row[data-k]')) adjustRow(sel, d); else if (sel?.closest('.tabs')) { const b = $$('button', sel.closest('.tabs')); const i = b.indexOf(sel); const n = b[(i + d + b.length) % b.length]; n.click(); setSel(n); } else moveSel(d, 'x'); }
  else if (k === 'KeyQ' || k === 'KeyE' && !sel?.matches('input')) { const tabs = $('.tabs', L); if (tabs) { const b = $$('button', tabs); const i = b.findIndex(x => x.classList.contains('on')); b[(i + (k === 'KeyQ' ? -1 : 1) + b.length) % b.length].click(); } }
  else if ((k === 'Enter' || k === 'Space') && sel) { e.preventDefault(); if (sel.matches('.row[data-k]')) adjustRow(sel, 1); else sel.click(); }
});
function goBack() {
  if ($('#confirm').classList.contains('on')) return $('#cNo').click();
  if (pop()) return;
  if (base === 'pause') { if (performance.now() - pausedAt > 400) resume(); return; }
  if (base === null && game.running && !ui.modalOpen) return pause();
}

// ───────── 확인 대화상자 ─────────
function confirmBox(title, msg, yes = '확인', danger = false) {
  return new Promise(res => {
    const c = $('#confirm'); $('#cTitle').textContent = title; $('#cMsg').textContent = msg; $('#cYes').textContent = yes; $('#cYes').classList.toggle('danger', danger);
    const prevSel = sel; c.classList.add('on'); sfx('beep'); setSel(touch ? null : $('#cNo'), false);
    const done = v => { c.classList.remove('on'); $('#cYes').onclick = $('#cNo').onclick = null; setSel(prevSel, false); res(v); };
    $('#cYes').onclick = () => done(true); $('#cNo').onclick = () => done(false);
  });
}

// ───────── 부팅 ─────────
async function boot() {
  prog(.1, '도면을 펼치는 중'); await preloadModels(p => prog(.1 + p * .3));
  prog(.5, '복도를 세는 중'); await new Promise(r => setTimeout(r, 30));
  try { game = new Game({ canvas: $('#c'), ui, audio, save }); } catch (e) { $('#ldmsg').textContent = '오류: ' + e.message; throw e; }
  window.__game = game; window.__titleT = v => titleT = v;
  game.onEnding = onEnding;
  game.onAutosave = () => { const el = $('#saveInd'); el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1600); };
  game.input.onUnlock = () => { if (game.running && !game.paused && !ui.modalOpen && !touch && base === null) pause(); };
  // 타이틀 배경용 깜빡이는 형광등: 업무실 천장 조명 하나
  const anchors = game.world.anchors.filter(a => a.room === 'openoffice'); game.titleFlick = anchors[Math.min(anchors.length - 1, 4)] || null;
  applySettings(true);
  prog(.8, '형광등을 켜는 중'); base = 'loading';
  try { titleStep(.016); game.renderer.compile(game.scene, game.camera); // 셰이더 미리 컴파일 + 텍스처 미리 업로드 → 처음 보는 방에서의 끊김 방지
    const seen = new Set(); game.scene.traverse(o => { const m = o.material; if (!m) return; for (const k of ['map', 'emissiveMap']) { const t = m[k]; if (t && !seen.has(t) && t.image) { seen.add(t); game.renderer.initTexture(t); } } }); } catch (e) { console.warn(e); }
  for (let i = 0; i < 4; i++) { titleStep(.25); await new Promise(r => requestAnimationFrame(r)); }
  prog(1, '정시 출근 준비 완료'); await new Promise(r => setTimeout(r, 300));
  mainMenu(); requestAnimationFrame(loop);
}
let last = performance.now(), titleT = 45 + Math.random() * 40;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (game.running || ui.modalOpen || base === 'ending' && !stack.length) { game.titleMode = false; game.frame(dt); }
  else if (base === 'menu' || base === 'loading' || stack.length && !game.running) titleStep(dt);
  requestAnimationFrame(loop);
}
function titleStep(dt) { // 메인 메뉴 배경: 업무실을 아주 천천히 떠다니는 카메라
    titleT += dt * (save.settings.reduceMotion ? .35 : 1); const c = game.camera;
    c.position.set(2.2 + Math.sin(titleT * .045) * 3.2, 1.45 + Math.sin(titleT * .11) * .04, -1.4 + Math.sin(titleT * .027) * .6);
    c.rotation.set(-.06 + Math.sin(titleT * .05) * .03, -.12 + Math.sin(titleT * .06) * .38, Math.sin(titleT * .08) * .006, 'YXZ');
    game.titleMode = true; game.room = game.world.rooms.get('openoffice'); game.fogT = [0x1d1e1b, 3, 19]; game.fxT.fade = 0; game.paused = false;
    game.frame(dt); game.running = false;
}

// ───────── 메인 메뉴 ─────────
function mainMenu() {
  game.running = false; game.paused = false; document.exitPointerLock?.(); ui.closeModal(true); ui.subtitle(null);
  for (const c of ['phone', 'radio', 'elev', 'amb2']) audio.loop(c, null); audio.stopVoice?.();
  game.blackout = false; if (game.run) game.run.lightsOff = {}; game.fxT = { distort: 0, ca: .35, desat: .12, fade: 0, grain: .06 }; game.fx.fade = 1; game.post.u.fadeColor.value.set(0);
  refreshMenu(); setBase('menu');
  if (audio.ctx) { audio.ctx.resume(); audio.loop('amb', 'title_pad'); audio.ambMute(false); }
}
function refreshMenu() {
  const n = Object.keys(save.endings).length, na = Object.keys(save.ach).length, ls = latestSlot();
  $('#mContinue').disabled = !ls; $('#mContAux').textContent = ls ? `${ls.data.roomName || ''} · ${fmtTime(ls.data.time)}` : '';
  $('#mAchAux').textContent = `${na} / ${ACHIEVEMENTS.length}`; $('#mEndAux').textContent = `${n} / ${ENDINGS.length}`;
  $('#profileLine').textContent = save.runs ? `사번 0427 · 출근 ${save.runs}회 · 총 근무 ${fmtTime(save.totalTime)}` : '사번 0427 · 첫 출근';
  if (save.endings.meta) $('#tsub').textContent = '당신이 다시 올 줄 알았습니다';
  else if (n >= 5) $('#tsub').textContent = '다음 지시가 있을 때까지 (아직)';
  else $('#tsub').textContent = '다음 지시가 있을 때까지';
}
const menuActs = {
  async continue() { const ls = latestSlot(); if (ls) loadSlot(ls.id); },
  async new() {
    if (latestSlot() && !await confirmBox('새 게임', '새로 출근합니다.\n저장된 슬롯은 그대로 남지만, 자동 저장은 곧 덮어써집니다.', '출근하기')) return;
    startNew();
  },
  load() { openSlots('load'); }, save() { openSlots('save'); }, settings() { openSettings(); }, achs() { fillAch(); push('achs'); },
  gallery() { fillGallery(); push('gallery'); }, credits() { fillCredits(); push('credits'); },
  resume() { resume(); },
  async restart() { if (await confirmBox('처음부터 다시 출근', '저장하지 않은 진행 상황은 사라집니다.', '다시 출근', true)) { stack = []; startNew(); } },
  async quit() { if (await confirmBox('메인 메뉴로', '저장하지 않은 진행 상황은 사라집니다.\n(마지막 자동 저장은 남아 있습니다)', '나가기')) { audio.ctx?.resume(); mainMenu(); } },
};
for (const b of $$('.mlist button')) b.onclick = () => { sfx('click'); menuActs[b.dataset.act]?.(); };

async function startNew() {
  await audio.unlock(); applySettings();
  audio.preload(['step_0', 'step_1', 'step_2', 'step_3', 'door_open', 'door_close', 'phone_ring', 'click', 'achieve']);
  game.titleMode = false; setBase(null); audio.ctx?.resume(); audio.ambMute(false); game.startRun(); lockPointer();
}
async function loadSlot(id) {
  const s = getSlot(id); if (!s?.state) return;
  if (base === 'pause' && !await confirmBox('불러오기', `${s.roomName || ''} (${fmtTime(s.time)}) 기록을 불러옵니다.\n저장하지 않은 진행 상황은 사라집니다.`, '불러오기')) return;
  await audio.unlock(); applySettings(); audio.ctx?.resume(); audio.ambMute(false);
  game.titleMode = false; setBase(null); sfx('whoosh');
  try { game.loadState(s.state); } catch (e) { console.error(e); ui.toast('불러오기 실패', '기록이 손상되었습니다.', '!'); mainMenu(); return; }
  lockPointer();
}
function lockPointer() { if (!touch) $('#c').requestPointerLock?.(); }

// ───────── 일시정지 ─────────
let pauseThumb = null, savedPending = false, pausedAt = 0;
function pause() {
  if (!game.running || base !== null) return;
  pauseThumb = game.capture(); pausedAt = performance.now(); game.paused = true; audio.ambMute(true); audio.ctx?.suspend(); ui.prompt(null); game._lastPrompt = null;
  $('#pRoom').textContent = game.room?.name || '정연빌딩 7층';
  $('#pinfo').textContent = `${save.runs}번째 출근 · 이번 출근 ${fmtTime(game.run.time)} · 거스른 횟수 ${game.run.defy}`;
  setBase('pause'); document.exitPointerLock?.();
}
function resume() {
  setBase(null); game.paused = false; audio.ctx?.resume(); audio.ambMute(false); game.input.lastInput = performance.now(); lockPointer();
  if (savedPending) { savedPending = false; game.emit('saved'); }
}
$('#btnPause').onclick = e => { e.stopPropagation(); pause(); };
$('#btnPause').addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); pause(); });
$('#prompt').onclick = e => { e.stopPropagation(); if (game.hover) game.use(game.hover); };
$('#prompt').addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); if (game.hover) game.use(game.hover); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') ui.closeModal(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game?.running && base === null && !ui.modalOpen) pause(); });
for (const b of $$('.back')) b.onclick = () => goBack();

// ───────── 저장 / 불러오기 슬롯 ─────────
let slotMode = 'load';
function openSlots(mode) { slotMode = mode; fillSlots(); push('slots'); }
function fillSlots() {
  const saving = slotMode === 'save';
  $('#slotTitle').textContent = saving ? '저장하기' : '불러오기'; $('#slotEyebrow').textContent = saving ? '현재 진행 상황' : '기록';
  $('#slotNote').textContent = saving ? '자동 저장 슬롯에는 직접 저장할 수 없습니다. 방에 들어갈 때마다 자동으로 갱신됩니다.' : '자동 저장은 방에 들어갈 때마다 갱신됩니다.';
  $('#slotGrid').innerHTML = listSlots().map(({ id, name, data: d }) => {
    const dis = saving ? id === 'auto' : !d;
    if (!d) return `<button class="slot empty" data-id="${id}" ${dis ? 'disabled' : ''}><div class="th">${saving ? '+ 새로 저장' : '비어 있음'}</div><div class="meta"><b>${name}</b><span>—</span><span>&nbsp;</span></div></button>`;
    return `<div class="slotwrap" style="position:relative;display:flex"><button class="slot" data-id="${id}" ${dis ? 'disabled' : ''} style="flex:1"><div class="th" style="background-image:url(${d.thumb || ''})"><span class="badge">${name}</span></div>
      <div class="meta"><b>${esc(d.roomName || d.room || '—')}</b><span>${d.runs}번째 출근 · ${fmtTime(d.time)}</span><span>${fmtDate(d.ts)}</span></div></button>${id !== 'auto' || !saving ? `<button class="del" data-del="${id}" aria-label="삭제">✕</button>` : ''}</div>`;
  }).join('');
  for (const b of $$('#slotGrid .slot')) b.onclick = () => slotPick(b.dataset.id);
  for (const b of $$('#slotGrid .del')) b.onclick = async e => { e.stopPropagation(); if (await confirmBox('기록 삭제', `${listSlots().find(s => s.id === b.dataset.del).name}을(를) 삭제할까요?`, '삭제', true)) { deleteSlot(b.dataset.del); fillSlots(); refreshMenu(); focusFirst(); } };
}
async function slotPick(id) {
  if (slotMode === 'load') { stack = []; return loadSlot(id); }
  const ex = getSlot(id);
  if (ex && !await confirmBox('덮어쓰기', `이 슬롯의 기록(${ex.roomName || ''} · ${fmtDate(ex.ts)})을 지금 진행 상황으로 덮어씁니다.`, '덮어쓰기', true)) return;
  game.paused = false; const ok = game.saveTo(id, pauseThumb); game.paused = true;
  if (ok) { sfx('ding'); ui.toast('저장됨', listSlots().find(s => s.id === id).name + ' · ' + (game.room?.name || ''), '✓'); savedPending = true; } else ui.toast('저장 실패', '브라우저 저장 공간이 부족합니다.', '!');
  fillSlots(); const b = $(`#slotGrid [data-id="${id}"]`); if (b && !touch) setSel(b, false);
}

// ───────── 설정 ─────────
const pct = v => Math.round(v * 100) + '%';
const SETTINGS = [
  { tab: '그래픽', rows: [
    { k: 'quality', t: '화질 프리셋', d: '자동은 프레임에 맞춰 조절합니다', seg: [['auto', '자동'], ['low', '낮음'], ['medium', '중간'], ['high', '높음']] },
    { k: 'resScale', t: '렌더링 해상도', d: '낮추면 더 부드럽게 돌아갑니다', min: .5, max: 1, step: .05, fmt: pct },
    { k: 'fov', t: '시야각 (FOV)', d: '세로 화면에서는 자동으로 조금 넓어집니다', min: 60, max: 95, step: 1, fmt: v => v + '°' },
    { k: 'grain', t: '필름 그레인', d: '화면의 미세한 노이즈', tog: 1 },
    { k: 'vignette', t: '비네트', d: '화면 가장자리 어둡게', tog: 1 } ] },
  { tab: '오디오', rows: [
    { k: 'master', t: '전체 음량', min: 0, max: 1, step: .05, fmt: pct },
    { k: 'music', t: '음악 · 환경음', min: 0, max: 1, step: .05, fmt: pct },
    { k: 'voice', t: '안내 음성', min: 0, max: 1, step: .05, fmt: pct, test: 'voice' },
    { k: 'sfx', t: '효과음', min: 0, max: 1, step: .05, fmt: pct, test: 'sfx' } ] },
  { tab: '조작', rows: [
    { k: 'sens', t: '시점 감도', min: .3, max: 2.5, step: .05, fmt: v => v.toFixed(2) + '×' },
    { k: 'invertY', t: '상하 반전', d: '시점의 위아래를 뒤집습니다', tog: 1 },
    { k: 'joySize', t: '조이스틱 크기', d: '터치 기기', min: .7, max: 1.4, step: .05, fmt: pct },
    { k: 'joySide', t: '조이스틱 위치', d: '터치 기기 — 반대쪽은 시점 조작', seg: [['left', '왼쪽'], ['right', '오른쪽']] } ] },
  { tab: '자막', rows: [
    { k: 'sub', t: '자막 크기', min: .8, max: 1.6, step: .05, fmt: pct },
    { k: 'subBg', t: '자막 배경 불투명도', min: 0, max: 1, step: .05, fmt: pct },
    { k: 'speaker', t: '화자 이름 표시', tog: 1 } ], preview: true },
  { tab: '접근성', rows: [
    { k: 'reduceMotion', t: '움직임 줄이기', d: '화면 흔들림·왜곡·걸음 흔들림을 줄입니다', tog: 1 },
    { k: 'reduceFlicker', t: '깜빡임 줄이기', d: '형광등 깜빡임과 정전 연출을 완화합니다', tog: 1 } ] },
];
let setTab = 0;
function openSettings() { fillSettings(); push('settings'); }
function fillSettings() {
  $('#setTabs').innerHTML = SETTINGS.map((g, i) => `<button data-i="${i}" class="${i === setTab ? 'on' : ''}">${g.tab}</button>`).join('');
  for (const b of $$('#setTabs button')) b.onclick = () => { setTab = +b.dataset.i; sfx('tick'); fillSettings(); setSel($(`#setTabs [data-i="${setTab}"]`), false); };
  const g = SETTINGS[setTab], s = save.settings;
  $('#setBody').innerHTML = g.rows.map(r => {
    let c;
    if (r.seg) c = `<div class="seg">${r.seg.map(([v, l]) => `<button data-v="${v}" class="${s[r.k] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    else if (r.tog) c = `<button class="tog ${s[r.k] ? 'on' : ''}" role="switch" aria-checked="${!!s[r.k]}" aria-label="${r.t}"></button>`;
    else c = `<output>${r.fmt(s[r.k])}</output><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${s[r.k]}" aria-label="${r.t}">`;
    return `<div class="row" data-k="${r.k}"><div class="rl"><b>${r.t}</b>${r.d ? `<span>${r.d}</span>` : ''}</div><div class="rc">${c}</div></div>`;
  }).join('') + (g.preview ? `<div class="subprev" style="position:relative;height:120px;margin-top:14px;border-radius:10px;overflow:hidden;background:#2a2b26 url(assets/img/title.webp) center/cover"><div id="subPrevBox" style="position:absolute;left:0;right:0;bottom:16px;text-align:center"></div></div>` : '');
  for (const row of $$('#setBody .row')) {
    const k = row.dataset.k, r = g.rows.find(x => x.k === k);
    const inp = row.querySelector('input'); if (inp) { const upd = () => { inp.style.setProperty('--p', ((inp.value - r.min) / (r.max - r.min) * 100) + '%'); }; upd();
      inp.oninput = () => { s[k] = +(+inp.value).toFixed(3); row.querySelector('output').textContent = r.fmt(s[k]); upd(); applySettings(); prevSub(); };
      inp.onchange = () => { writeSave(save); if (r.test === 'sfx') sfx('ding'); if (r.test === 'voice' && audio.ctx) audio.voice?.('q_who'); };
      inp.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); }
    for (const b of $$('.seg button', row)) b.onclick = e => { e.stopPropagation(); s[k] = b.dataset.v; $$('.seg button', row).forEach(x => x.classList.toggle('on', x === b)); sfx('tick'); if (k === 'quality' && game) game.fpsAcc.lvl = 2; applySettings(); writeSave(save); };
    const t = row.querySelector('.tog'); if (t) t.onclick = e => { e.stopPropagation(); s[k] = !s[k]; t.classList.toggle('on', s[k]); t.setAttribute('aria-checked', s[k]); sfx('switch'); applySettings(); writeSave(save); prevSub(); };
    row.onclick = () => { if (!touch) setSel(row, false); };
  }
  prevSub();
}
function prevSub() { const b = $('#subPrevBox'); if (!b) return; b.innerHTML = `<div style="font-size:calc(11px*var(--sub));letter-spacing:.24em;color:var(--acc);font-weight:600;margin-bottom:6px;${save.settings.speaker ? '' : 'display:none'}">안내 음성</div><span style="padding:5px 12px;border-radius:6px;background:rgba(8,8,7,var(--subbg));font-size:calc(15px*var(--sub));line-height:1.8">0427은 자막을 읽기 좋게 조정했습니다.</span>`; }
$('#bDefaults').onclick = async () => { if (await confirmBox('기본값 복원', '모든 설정을 기본값으로 되돌릴까요?', '복원')) { Object.assign(save.settings, DEFAULT_SETTINGS); if (game) game.fpsAcc.lvl = 2; applySettings(); writeSave(save); fillSettings(); } };
$('#bWipe').onclick = async () => { if (await confirmBox('모든 기록 지우기', '결말 · 도전과제 · 회차 · 저장 슬롯을 모두 지웁니다.\n안내 음성도 당신을 잊습니다.', '모두 지우기', true)) { wipe(); fillSettings(); refreshMenu(); ui.toast('기록 삭제됨', '처음 출근하는 것처럼.', '✕'); } };
function wipe() { clearSave(); clearSlots(); const st = save.settings; const fresh = newSave(); fresh.settings = st; Object.keys(save).forEach(k => delete save[k]); Object.assign(save, fresh); writeSave(save); }
let lastQ = null;
function applySettings(force) {
  const s = save.settings, R = document.documentElement.style;
  audio.vol = { master: s.master, voice: s.voice, music: s.music, sfx: s.sfx }; audio.applyVol();
  R.setProperty('--sub', s.sub); R.setProperty('--subbg', s.subBg); R.setProperty('--joy', s.joySize);
  ui.showSpeaker = s.speaker; document.body.classList.toggle('rm', s.reduceMotion); $('#vignette').style.display = s.vignette ? '' : 'none';
  if (!game) return;
  Object.assign(game.input, { sens: s.sens, invertY: s.invertY, joySide: s.joySide, joySize: s.joySize });
  game.player.bobScale = s.reduceMotion ? .25 : 1;
  const q = s.quality + '|' + s.resScale + '|' + s.fov; if (force || q !== lastQ) { lastQ = q; game.quality(s.quality); game.resize(); }
}
addEventListener('pointerdown', async function first() { await audio.unlock(); applySettings(); if (!game?.running) audio.loop('amb', 'title_pad'); removeEventListener('pointerdown', first); });

// ───────── 도전과제 ─────────
function fillAch() {
  const got = save.ach, n = Object.keys(got).length; $('#achCount').textContent = `${n} / ${ACHIEVEMENTS.length}`; $('#achBar').style.width = pct(n / ACHIEVEMENTS.length);
  const list = [...ACHIEVEMENTS].sort((a, b) => (!!got[b.id]) - (!!got[a.id]));
  $('#achList').innerHTML = list.map(a => { const g = got[a.id]; const hid = a.hidden && !g;
    return `<div class="ach ${g ? 'got' : 'lock'}"><div class="ic">${g ? '◆' : hid ? '?' : '◇'}</div><div><b>${hid ? '???' : esc(a.name)}</b><span>${hid ? '숨겨진 도전과제' : esc(a.desc)}</span>${g && g > 1e12 ? `<em>${fmtDate(g)} 달성</em>` : ''}</div></div>`; }).join('');
}
// ───────── 엔딩 갤러리 / 기록 ─────────
const HINTS = { perfect: '모든 지시를 끝까지.', silence: '아무 말도 하지 않는다면?', loop: '같은 표어를 몇 번이나 보았나요.', outside: '창밖이 너무 밝습니다.', sit: '처음 자리가 제일 편합니다.', mirror: '거꾸로 들리는 목소리.', basement: '엘리베이터에는 0층이 있습니다.', idle: '아무것도 하지 않기.', hold: '전화를 끊지 마세요.', '0426': '충분히 궁금해한 뒤, 관제실에서 그 목소리의 눈을 오래 바라보세요.', archive: '네 자리 숫자는 흩어져 있습니다.', meta: '충분히 많이 퇴근했다면.' };
function fillGallery(tab = 'end') {
  const got = save.endings, n = Object.keys(got).length; $('#endCount').textContent = `${n} / ${ENDINGS.length}`; $('#endBar').style.width = pct(n / ENDINGS.length);
  for (const b of $$('#galTabs button')) { b.classList.toggle('on', b.dataset.tab === tab); b.onclick = () => { sfx('tick'); fillGallery(b.dataset.tab); setSel(b, false); }; }
  $('#endList').hidden = tab !== 'end'; $('#statList').hidden = tab !== 'rec';
  $('#endList').innerHTML = ENDINGS.map((e, i) => { const g = got[e.id]; const light = parseInt(e.color.slice(1), 16) > 0x888888;
    return g ? `<button class="ecard ${light ? 'light' : ''}" data-e="${e.id}"><div class="sw" style="background:${e.color}"></div><small>결말 ${String(i + 1).padStart(2, '0')}</small><b>${esc(e.name)}</b><p>${esc(e.text.split('\n')[0])}</p><p style="margin-top:6px;opacity:.7">본 횟수 ${g}</p></button>`
      : `<div class="ecard lock"><small>결말 ${String(i + 1).padStart(2, '0')}</small><b>???</b><p>${n >= 3 ? esc(HINTS[e.id] || '') : '아직 보지 못한 결말'}</p></div>`; }).join('');
  for (const b of $$('#endList button')) b.onclick = () => { const E = ENDINGS.find(x => x.id === b.dataset.e); showEnding(E, ENDINGS.indexOf(E) + 1, false, true); };
  const digits = Object.keys(save.digits || {}).length, ducks = Object.keys(save.ducks || {}).length;
  const ST = [['출근 횟수', save.runs + '회'], ['총 근무 시간', fmtTime(save.totalTime)], ['본 결말', `${n} / ${ENDINGS.length}`], ['도전과제', `${Object.keys(save.ach).length} / ${ACHIEVEMENTS.length}`],
    ['지시를 거스른 횟수', (save.totalDefy || 0) + '회'], ['들여다본 횟수', (save.totalAsk || 0) + '회'], ['찾은 오리', ducks + '마리'], ['찾은 숫자 조각', digits + ' / 4'], ['화분에 물 준 횟수', (save.plant || 0) + '회'],
    ['마지막 결말', save.lastEnding ? (ENDINGS.find(e => e.id === save.lastEnding)?.name || '—') : '—'], ['마지막 출근', save.lastVisit ? fmtDate(save.lastVisit) : '—']];
  $('#statList').innerHTML = ST.map(([a, b]) => `<div class="row"><b>${a}</b><em>${esc(b)}</em></div>`).join('');
}
// ───────── 크레딧 ─────────
function fillCredits() {
  $('#creditBody').innerHTML = `<h4>기획 · 시나리오 · 프로그래밍</h4><p>정연빌딩 7층 제작팀</p><h4>안내 음성</h4><p>Microsoft Edge 신경망 음성 (ko-KR InJoon · SunHi · Hyunsu)</p>
  <h4>음악 · 효과음</h4><p>절차적 합성 (numpy)</p><h4>그래픽</h4><p>three.js r160 · 절차적 텍스처</p><h4>글꼴</h4><p>Pretendard — SIL Open Font License 1.1</p>
  <h4>특별히 감사한 분</h4><p>사번 0421 – 0426</p><p>그리고 지금 이 화면을 보고 있는 0427</p>
  <p class="fine">이 작품은 허구이며 실존 인물·단체와 관계가 없습니다.<br>모든 지시는 권고 사항입니다. 따르지 않아도 됩니다. 아마도.</p>`;
}
// ───────── 결말 화면 ─────────
let endingFromGallery = false;
function onEnding(E, idx, n, first) { document.exitPointerLock?.(); showEnding(E, idx, first, false); refreshMenu(); }
function showEnding(E, idx, first, fromGallery) {
  endingFromGallery = fromGallery; const el = $('#ending'); el.style.background = E.color; el.classList.toggle('light', parseInt(E.color.slice(1), 16) > 0x888888);
  $('#eNum').textContent = `결말 ${String(idx).padStart(2, '0')} / ${ENDINGS.length}`; $('#eName').textContent = E.name; $('#eText').textContent = E.text;
  $('#eNew').style.display = first ? '' : 'none'; $('#bEndWipe').style.display = E.id === 'meta' && !fromGallery ? '' : 'none';
  $('#bAgain').style.display = fromGallery ? 'none' : ''; $('#bEndTitle').textContent = fromGallery ? '닫기' : '메인 메뉴';
  if (fromGallery) push('ending'); else setBase('ending');
}
$('#bAgain').onclick = () => { sfx('click'); startNew(); };
$('#bEndTitle').onclick = () => { sfx('click'); if (endingFromGallery) pop(); else mainMenu(); };
$('#bEndWipe').onclick = async () => { if (await confirmBox('기록 지우기', '모든 기록을 지우고 처음으로 돌아갑니다.', '지우기', true)) { wipe(); mainMenu(); } };

boot();
