// ─────────────────────────────────────────────────────────────
// 이야기 스크립트 — 이벤트 → 내레이션·선택지·결말. 엔진 코드와 분리되어 있다.
// 이벤트: start, enter:<방>, trigger:<id>, teleport:<id>, use:<소품>, sit:<소품>, take:<소품>, door:<문>,
//        read:<문서>, idle, circle, ceiling, defy, stand
// G API 는 js/engine/game.js makeAPI() 참고. (say, beat, expect, defy, ending, ach, door, fx, wait, after …)
// ─────────────────────────────────────────────────────────────
import { SLIDES, SLIDE_LINES, RADIO, LOOP_POSTERS, STAIR_FLOORS } from './docs.js';
import { SPAWNS } from './level.js';

export const REACT = {
  revisit: ['revisit_1', 'revisit_2', 'revisit_3'],
  back: ['back_1', 'back_2', 'back_3'],
  defy: [['defy_t0_1', 'defy_t0_2', 'defy_t0_3'], ['defy_t1_1', 'defy_t1_2', 'defy_t1_3'], ['defy_t2_1', 'defy_t2_2', 'defy_t2_3'], ['defy_t3_1', 'defy_t3_2', 'defy_t3_3']],
  reply: { obey: ['r_obey_1', 'r_obey_2'], defy: ['r_defy_1', 'r_defy_2'], ask: ['r_ask_1', 'r_ask_2', 'r_ask_3', 'r_ask_4'], quiet: ['r_quiet_1', 'r_quiet_2'] },
};
// 선택지 UI 는 없다. 갈림길은 전부 '몸'으로 고른다: G.beat(대사, { toward, to, look, reply }) → obey/defy/ask/quiet

function ringPhone(G, n) {
  if (!G.flag('ringing') || n <= 0 || G.flag('onCall')) { G.flag('ringing', false); return; }
  G.sfx('phone_ring'); G.after(3.2, () => ringPhone(G, n - 1));
}
async function sitOffice(G) {
  if (!G.flag('instructed')) { G.say('sit_offer', { interrupt: true }); return; }
  await G.say('sit_offer', { interrupt: true }); if (!G.player.sitting) return;
  await G.wait(2); if (!G.player.sitting) return;
  await G.say('sit_ending'); if (G.player.sitting) G.ending('sit');
}
async function elevRide(G, floor, long) {
  G.ui.closeModal(); G.door('d_elev', 'close'); G.sfx('click'); await G.wait(1.3);
  G.loop('elev', 'elev_motor'); G.fx({ distort: .25 }); G.player.roll = .006;
  await G.wait(long ? 2 : 3.2);
  if (long) return;
  G.loop('elev', null); G.fx({ distort: 0 }); G.player.roll = 0; G.sfx('ding');
  G.setLabel('elevFloorSign', { lines: [String(floor)] }); await G.wait(.6); G.door('d_elev', 'open');
}
async function stairDown(G) {
  if (G.flag('stairBusy')) return; G.flag('stairBusy', true);
  const i = G.run.stair || 0;
  if (i >= STAIR_FLOORS.length) { // 1층 출구 → 바깥
    G.fadeColor(0xffffff); G.fx({ fade: 1 }); G.freeze(true); G.sfx('door_open'); await G.wait(2.2);
    G.teleport(SPAWNS.outside.p[0], SPAWNS.outside.p[1], SPAWNS.outside.yaw); G.freeze(false); G.fx({ fade: 0 }); G.flag('stairBusy', false); return;
  }
  G.fadeColor(0x000000); G.fx({ fade: 1 }); G.freeze(true); G.sfx('door_open');
  for (let k = 0; k < 6; k++) G.after(.5 + k * .38, () => G.sfx('step_' + (k % 4), { rate: .8 }));
  await G.wait(2.8);
  G.run.stair = i + 1; G.setLabel('floorSign', { lines: ['#' + STAIR_FLOORS[i]] }); G.sfx('door_close');
  G.player.yaw = Math.PI; G.fx({ fade: 0 }); G.freeze(false); G.flag('stairBusy', false);
  const L = { 1: 'stair_2', 3: 'stair_3', 5: 'stair_4', 8: 'stair_5' }[i + 1]; if (L) G.say(L, { interrupt: true });
}
function radioTune(G, f) {
  G.run.radioF = f; G.setLabel('radio', { lines: ['FM ' + f.toFixed(1)] });
  const st = RADIO.stations.find(s => Math.abs(s.f - f) < .25);
  if (!st) { G.loop('radio', 'radio_static'); G.run.radioSt = null; return; }
  if (G.run.radioSt === st) return; G.run.radioSt = st;
  if (st.kind === 'song') { G.loop('radio', 'radio_song'); G.ach('radio'); G.after(5, () => G.room?.id === 'breakroom' && G.once('radio_song', { ifIdle: true })); }
  else { G.loop('radio', 'radio_static', { vol: .25 }); G.say(st.lines, { interrupt: true, phone: true }); }
}
function arcadeScreen(cv, t, dead) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height; g.fillStyle = '#12051c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${(i * 37 % 10) / 20})`; g.fillRect((i * 73 + t * 20) % W, (i * 41) % H, 2, 2); }
  g.save(); g.translate(W / 2, H / 2 - 20); g.rotate(t * .5); g.strokeStyle = '#ff74e8'; g.lineWidth = 3; g.beginPath();
  for (let k = 0; k < 7; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); } g.stroke(); g.restore();
  g.fillStyle = '#ffe36a'; g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.fillText('HEXMOON', W / 2, H / 2 + 50);
  g.fillStyle = dead ? '#ff4040' : ((t * 2 | 0) % 2 ? '#fff' : '#888'); g.font = '14px monospace';
  g.fillText(dead ? 'THIS GAME HAS BEEN DELETED' : 'INSERT COIN', W / 2, H - 30);
}

export const STORY = {
  // ── 출근
  async start(G) {
    const s = G.save; G.loop('amb', 'amb_hum');
    await G.wait(1.4);
    let lines;
    if (s.runs === 1) lines = ['intro_1', 'intro_2', 'intro_3', 'intro_3b'];
    else {
      lines = ['rintro_1'];
      if (s.prevVisit && Date.now() - s.prevVisit > 864e5) { lines.push('rintro_long'); G.ach('long_absence'); }
      const map = { perfect: 'rintro_after_perfect', loop: 'rintro_after_loop', outside: 'rintro_after_outside', sit: 'rintro_after_sit', idle: 'rintro_after_idle', meta: 'rintro_after_meta', '0426': 'rintro_after_0426' };
      lines.push(map[s.lastEnding] || (s.runs % 2 ? 'rintro_3' : 'rintro_2'));
      if (s.runs >= 5) lines.push('rintro_many');
    }
    await G.say(lines);
    if (G.flag('left')) return;
    G.flag('ringing', true); ringPhone(G, 9);
    await G.say(s.runs === 1 ? ['intro_4', 'phone_ignore'] : ['phone_ignore']);
    if (G.flag('left')) return;
    if (!G.flag('onCall')) await G.say('phone_ignore2', { valid: () => !G.flag('onCall') });
    if (G.flag('left')) return;
    await G.say(s.runs === 1 ? 'intro_5' : 'rintro_go');
    G.flag('instructed', true);
    G.expect({ to: ['openoffice'] });
    G.after(25, () => { if (!G.flag('left') && !G.flag('onCall')) G.say('office_stay', { ifIdle: true }); });
  },
  'enter:*'(G, e) { if (e.name !== 'enter:breakroom') G.loop('radio', null); },

  // ── 0427 사무실
  'enter:office'(G, e) {
    if (e.visit < 2 || e.handled) return;
    if (G.world.doors.get('d_meta')?.shown) { G.once('meta_door'); return; }
    G.say(e.visit === 2 ? 'office_back' : 'office_back2', { ifIdle: true });
    if (G.save.plant >= 3) G.once('plant_big', { ifIdle: true });
  },
  'sit:chairMine': sitOffice, 'sit:chairMine2': sitOffice,
  async 'use:phoneMine'(G) {
    if (G.flag('onCall')) return;
    const ringing = G.flag('ringing'); G.flag('ringing', false); G.flag('onCall', true); G.sfx('phone_pick');
    const id = (G.run.callId = (G.run.callId || 0) + 1); const t0 = Date.now(); let iv;
    const live = () => G.flag('onCall') && G.run.callId === id;
    const m = G.ui.phone(a => { if (a === 'hang') G.ui.closeModal(); }, () => { G.flag('onCall', false); clearInterval(iv); G.loop('phone', null); G.hush(); G.sfx('phone_pick', { rate: .8 }); });
    const stat = m.querySelector('.pstat'), tm = m.querySelector('.ptime');
    iv = setInterval(() => { const s = (Date.now() - t0) / 1000 | 0; tm.textContent = `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
    if (ringing && !G.flag('phoneDefied')) { G.flag('phoneDefied', true); await G.defy('phone', 'phone_answered'); }
    else stat.textContent = '저장된 메시지 1건';
    if (!live()) return; stat.textContent = '음성메시지 — 0425';
    const ok = await G.say(['vm_1', 'vm_2', 'vm_3', 'vm_4'], { phone: true, interrupt: true }); // 수화기를 들면 내레이션보다 전화가 먼저 if (!live() || !ok) return;
    G.ach('voicemail'); stat.textContent = '연결 대기 중…'; G.loop('phone', 'hold_music', { fade: .5 });
    await G.say('hold_music', { phone: true });
    G.after(30, () => live() && G.say('phone_hold_1'));
    G.after(60, () => live() && G.say('phone_hold_2'));
    G.after(90, async () => { if (!live()) return; await G.say('hold_end'); if (live()) { G.ui.closeModal(); G.ending('hold'); } });
  },
  'use:switchOffice'(G) {
    const off = !G.run.lightsOff.office; G.lights('office', !off); G.sfx('switch');
    if (off) { G.once('light_off', { interrupt: true }); G.ach('dark'); } else G.once('light_on', { ifIdle: true });
  },
  'use:plant'(G) {
    if (!G.item('cup')) return;
    G.item('cup', false); G.save.plant++; G.persist(); G.sfx('water'); G.refresh();
    G.once('plant_water', { interrupt: true }); if (G.save.plant >= 3) G.ach('plant');
  },

  // ── 업무실
  async 'enter:openoffice'(G, e) {
    G.flag('left', true); G.flag('ringing', false);
    if (e.visit === 1) {
      G.expect({ to: ['hall'], wrong: { breakroom: 'break_enter', boss: 'boss_enter', office: 'office_back', devroom: null } });
      await G.say(['open_1', 'open_2', 'open_2b']);
      if (G.room?.id !== 'openoffice') return;
      // 정면 문으로 걸어가면 순종, 동료 자리를 뒤지면(조사) 호기심, 다른 쪽으로 가면 반항, 서 있으면 침묵
      const b = await G.beat('ask_where', { room: 'openoffice', toward: [2.5, -14], to: ['hall'], window: 5, reply: { obey: 'r_where_obey', ask: 'r_where_ask', defy: 'r_where_defy' } });
      if (b !== 'obey' && G.room?.id === 'openoffice') G.say('open_3', { ifIdle: true });
    } else if (!e.handled && !e.back) G.say(e.visit >= 3 ? 'open_revisit3' : 'open_revisit', { ifIdle: true, once: true });
  },
  'trigger:fake_wall'(G) { if (!G.run.visits.devroom) G.once('devwall', { ifIdle: true }); },
  async 'use:copier'(G) {
    if (G.flag('copying')) return; G.flag('copying', true); G.sfx('copier'); await G.wait(4);
    G.flag('copying', false); G.doc('copier_out'); G.ach('copier'); G.once('copier_use', { interrupt: !G.busy() });
  },
  'use:cat'(G) { },

  // ── 작업실 (비밀)
  'enter:devroom'(G, e) { if (e.visit === 1) { G.ach('devroom'); G.say('devroom_1', { interrupt: true }); G.after(14, () => G.room?.id === 'devroom' && G.once('devroom_2', { ifIdle: true })); } },

  // ── 탕비실
  async 'enter:breakroom'(G, e) {
    if (e.visit === 1) { await G.wait(e.handled ? 5 : .6); if (G.room?.id !== 'breakroom') return; await G.beat('ask_break', { room: 'breakroom', toward: [11, -4.5], to: ['openoffice'], window: 6, reply: { obey: 'r_break_obey', defy: 'r_break_defy', ask: 'r_break_ask', quiet: 'r_break_quiet' } }); }
    else if (!e.handled) G.say('break_enter2', { ifIdle: true, once: true });
  },
  'use:vending'(G) {
    G.run.vend = (G.run.vend || 0) + 1; G.sfx('click');
    if (G.run.vend === 10) { G.sfx('vending'); G.item('can', true); G.ach('vending'); G.say('vending_can', { interrupt: true }); }
  },
  'use:fridge'(G, e) { if (e.rec.leafOpen && !G.flag('fridgeRead')) { G.flag('fridgeRead', true); G.after(.6, () => { G.doc('fridge_note'); G.once('fridge_open', { ifIdle: true }); }); } },
  'use:cooler'(G) { if (G.item('cup')) return; G.sfx('water'); G.item('cup', true); },
  'use:radio'(G) { const f = G.run.radioF || 88.0; G.ui.radio(f, v => radioTune(G, v)); if (!G.run.radioSt) G.loop('radio', 'radio_static'); },
  'use:arcade'(G) {
    let dead = false, alive = true; const m = G.ui.arcade(() => { if (dead) return; dead = true; G.sfx('error'); G.ach('hexmoon'); G.say('arcade', { interrupt: true }); });
    const cv = m.querySelector('canvas'); const t0 = performance.now();
    const loop = () => { if (!G.ui.modalOpen || !alive) return; arcadeScreen(cv, (performance.now() - t0) / 1000, dead); requestAnimationFrame(loop); }; loop();
    G.ui._onClose = () => { alive = false; };
  },

  // ── 네 개의 문
  async 'enter:hall'(G, e) {
    if (e.visit === 1) {
      G.expect({ to: ['westcorr'], wrong: { connector: 'wrong_right', lobby: 'wrong_middle', tunnel: 'wrong_small', openoffice: 'wrong_back_hall' } });
      await G.say(['hall_1', 'ask_doors', 'hall_2']); if (G.room?.id !== 'hall') return;
      // 지시를 들은 뒤의 몸짓: 왼쪽 문으로 가면 순종(다음 방 대사가 이어받음), 작은 문을 바라보면 호기심, 서 있으면 침묵
      await G.beat(null, { room: 'hall', toward: [-2, -18], to: ['westcorr'], look: [6, .6, -22], lookDeg: 9, window: 5, reply: { obey: null, defy: null, ask: 'r_doors_ask', quiet: 'r_doors_quiet' } });
    } else if (!e.handled && !G.flag('reachedMeeting')) G.say('hall_revisit', { ifIdle: true, once: true });
  },
  'trigger:hall_small_near'(G) { if (G.room?.id === 'hall') G.once('hall_small', { ifIdle: true }); },

  // ── 왼쪽 (순종 루트)
  'enter:westcorr'(G, e) { if (e.visit === 1) { G.say('left_corr', { ifIdle: !e.from }); G.expect({ to: ['meeting'] }); } },
  async 'enter:meeting'(G, e) {
    if (e.visit !== 1) return; G.flag('reachedMeeting', true);
    G.expect({ to: ['longcorr'] });
    await G.say(['meet_1', 'ask_agenda', 'meet_2']); if (G.room?.id !== 'meeting') return;
    // 북쪽 문으로 가면 찬성(순종), 발표 화면을 바라보면 이의(호기심), 서 있으면 '침묵은 찬성'
    await G.beat(null, { room: 'meeting', toward: [-18, -24], to: ['longcorr'], look: 'proj', window: 5, reply: { obey: null, defy: null, ask: 'r_agenda_ask', quiet: 'r_agenda_quiet' } });
  },
  'sit:chairMeet'(G) { if (!G.flag('meetSat')) { G.flag('meetSat', true); G.defy('sit', 'meet_sit'); } else G.say('meet_sit', { ifIdle: true }); },
  'use:proj'(G) { const i = G.run.slide = ((G.run.slide || 0) + 1) % SLIDES.length; G.setLabel('proj', { lines: SLIDES[i] }); G.sfx('click'); if (SLIDE_LINES[i]) G.say(SLIDE_LINES[i], { interrupt: !G.busy() }); },
  'enter:longcorr'(G, e) { if (e.visit === 1) { G.say('long_1'); G.expect({ to: ['control'], wrong: { archive: null } }); } },
  'trigger:long_mid'(G) { if (G.room?.id === 'longcorr') G.once('long_2', { ifIdle: false }); },
  'use:keypad'(G) {
    if (!G.flag('keypadTouched')) { G.flag('keypadTouched', true); if (G.expecting()) G.defy('keypad', 'keypad_touch'); }
    const fn = (code, cb) => {
      if (code === '2741') { cb(true); G.sfx('beep'); G.door('d_archive', 'unlock'); G.door('d_archive', 'open'); G.sfx('door_open'); setTimeout(() => G.ui.closeModal(), 700); G.say('archive_open', { interrupt: true }); }
      else if (code === '0426') { cb(false); G.ach('code0426'); G.hush(); G.silence(4); G.after(3.5, () => G.say('keypad_0426b', { interrupt: true })); }
      else { cb(false); G.sfx('error'); G.say('keypad_wrong', { ifIdle: true }); }
    };
    fn.key = () => G.sfx('beep', { vol: .5 }); G.ui.keypad(fn);
  },
  async 'enter:archive'(G, e) {
    if (e.visit !== 1) return; await G.say('archive_1', { interrupt: true });
    // 돌아 나가면 순종, 단말을 바라보면 호기심(단말을 쓰면 결말), 서 있으면 침묵
    if (G.room?.id === 'archive') await G.beat('ask_archive', { room: 'archive', toward: [-17, -34], to: ['longcorr'], look: 'archiveTerm', useIsAsk: false, window: 6, reply: { obey: 'r_archive_obey', defy: null, ask: 'r_archive_ask', quiet: 'r_archive_quiet' } });
  },
  async 'use:archiveTerm'(G) {
    if (G.flag('archEnd')) return; G.flag('archEnd', true); G.doc('archive_rec'); G.sfx('copier', { rate: 1.4 });
    await G.say('archive_end', { interrupt: true }); await G.wait(1.5); G.ui.closeModal(); G.ending('archive');
  },
  async 'enter:control'(G, e) {
    if (e.visit !== 1) return; G.expect(null);
    await G.say(['ctrl_1', 'ctrl_2'], { interrupt: true }); if (G.flag('ended')) return;
    // 질문 대신 '시선': 충분히 궁금해했던(조사·응시) 사람이 질문 직후 화면 벽(=내레이터의 눈)을 오래 바라보면 0426.
    const curious = G.run.stats.ask >= 3 || (G.save.totalAsk >= 8 && G.run.stats.ask >= 1);
    const c = await G.beat('ask_ctrl', { room: 'control', toward: [-18, -52.7], look: 'cctv', lookDeg: 16, gaze: 1.5, useIsAsk: false, window: 6,
      reply: { obey: 'r_ctrl_obey', defy: 'r_ctrl_defy', quiet: 'r_ctrl_quiet', ask: curious ? null : 'r_ctrl_look' } });
    if (curious && c === 'ask' && !G.flag('ended')) {
      G.flag('ended', true); G.fx({ distort: .4, desat: .5 }); G.loop('amb', null, { fade: 4 });
      await G.say(['q_who', 'q_0426_1', 'q_0426_2'], { interrupt: true }); G.silence(5); await G.wait(2.5); G.fadeColor(0xe8e2d0);
      await G.say('q_0426_3'); G.ending('0426'); return;
    }
    if (G.flag('ended')) return;
    await G.say(['ctrl_3', 'ctrl_4']); G.flag('ctrlReady', true);
    G.after(25, () => { if (!G.flag('ended')) G.say('ctrl_wait', { ifIdle: true }); });
  },
  async 'use:btnApprove'(G) {
    if (G.flag('ended')) return; G.flag('ended', true); G.expect(null); G.sfx('click'); G.freeze(true);
    if (G.run.defy === 0) G.ach('perfect');
    await G.say(['perfect_1', 'perfect_2'], { interrupt: true });
    G.sfx('power_off'); G.lights('control', false); G.lights('longcorr', false); G.silence(30);
    await G.wait(1.5); G.fadeColor(0xf4f1e6); await G.say('perfect_3'); G.ending('perfect');
  },
  async 'use:btnStop'(G) {
    if (G.flag('ended')) return; G.flag('ended', true); G.expect(null); G.sfx('click');
    await G.say('stop_1', { interrupt: true, gap: 0 });
    G.hush(); G.sfx('power_off'); G.blackout(true); G.loop('amb', 'amb_hum', { vol: .6 }); G.fx({ desat: .7, grain: .1 });
    await G.wait(6); await G.say('stop_2', { rate: .86 });
    await G.wait(14); G.ending('silence', { keepAmb: true });
  },

  // ── 오른쪽 (무한 복도)
  'teleport:loop'(G) {
    const n = ++G.run.loops; const P = LOOP_POSTERS[Math.min(n, LOOP_POSTERS.length - 1)];
    G.setLabel('loopPoster2', { lines: P }); G.setLabel('loopPoster3', { lines: P });
    G.fx({ desat: Math.min(.7, .12 + n * .07), grain: .06 + n * .006 });
    if (n === 2) G.refresh();
    if (n >= 8) { G.say('loop_end', { interrupt: true }).then(() => G.ending('loop')); G.freeze(false); return; }
    const L = { 1: 'loop_1', 2: ['loop_2', 'loop_4'], 3: 'loop_3', 4: 'loop_5', 5: 'loop_6', 6: 'loop_7' }[n]; if (L) G.say(L, { interrupt: true });
  },
  'enter:storage'(G, e) { G.flag('storageSeen', true); if (e.visit === 1) G.say('store_1', { interrupt: true }); },
  'door:d_exit'(G, e) { if (e.result === 'locked') G.say('store_exit', { ifIdle: true }); if (e.result === 'unlock') G.say('store_exit_ok', { interrupt: true }); },
  'enter:stair'(G, e) { if (e.visit === 1) G.say('stair_1'); },
  'door:d_stair'(G) { stairDown(G); },
  'enter:outside'(G, e) { if (e.visit === 1) { G.say('out_1', { interrupt: true }); G.fx({ desat: .3, ca: .2 }); } },
  'trigger:out_mid'(G) { G.once('out_2'); },
  async 'trigger:out_far'(G) { if (G.flag('outEnd')) return; G.flag('outEnd', true); G.fadeColor(0xffffff); await G.say('out_3', { interrupt: true }); G.ending('outside', { keepAmb: true }); },

  // ── 엘리베이터
  'use:elevCall'(G) { G.sfx('ding'); G.door('d_elev', 'open'); },
  'door:d_elev'(G) { const d = G.door('d_elev'); G.door('d_elev', d.open ? 'close' : 'open'); },
  'enter:elevator'(G, e) { if (e.visit === 1) G.say('elev_enter', { ifIdle: true }); },
  'use:elevPanel'(G) {
    G.ui.elevator(async b => {
      if (b === 'open') return G.door('d_elev', 'open'); if (b === 'close') return G.door('d_elev', 'close');
      if (b === 'call') { G.ach('sec'); G.sfx('phone_ring', { vol: .4 }); return G.say(['sec_1', 'sec_2', 'sec_3'], { interrupt: true, phone: true }); }
      if (b === '7') return G.say('elev_7', { interrupt: true });
      if (b === '0') {
        const z = G.run.zero = (G.run.zero || 0) + 1;
        if (z === 1) return G.say('elev_0a', { interrupt: true }); if (z === 2) return G.say('elev_0b', { interrupt: true });
        await elevRide(G, '0', true); G.setLabel('elevFloorSign', { lines: ['-'] }); G.fx({ distort: .6, desat: .5 });
        await G.say('elev_0c', { interrupt: true }); G.ending('basement', { keepAmb: true }); return;
      }
      await elevRide(G, b);
      if (b === '1') G.say(G.run.flags.rode1 ? 'elev_1b' : 'elev_1', { interrupt: true }), G.flag('rode1', true);
    });
  },

  // ── 작은 문 / 거울 사무실
  'enter:tunnel'(G, e) { if (e.visit === 1 && !e.handled) G.say('tunnel'); },
  async 'enter:mirror'(G, e) {
    if (e.visit !== 1) return; G.fx({ ca: .9 });
    await G.say('mirror_room', { reverse: true, interrupt: true }); await G.say('mirror_room');
    G.after(6, () => G.room?.id === 'mirror' && G.once('mirror_name', { ifIdle: true }));
  },
  async 'sit:chairMirror'(G) { await G.say('mirror_sit', { interrupt: true }); if (G.player.sitting) { G.fadeColor(0x0e1414); G.ending('mirror'); } },

  // ── 메뉴실 (메타)
  async 'enter:meta'(G, e) { if (e.visit === 1) { G.fx({ desat: .8, ca: .1 }); await G.say(['meta_1', 'meta_2', 'meta_3'], { interrupt: true }); } },
  async 'trigger:meta_quit'(G) { if (G.flag('metaEnd')) return; G.flag('metaEnd', true); G.fadeColor(0xffffff); await G.say('meta_end', { interrupt: true }); G.ending('meta'); },

  // ── 불러오기 / 저장
  resume(G, e) {
    const r = G.run;
    if (e.room === 'office' && !r.flags.instructed) { r.flags.instructed = true; r.flags.left = r.flags.left || false; G.expect({ to: ['openoffice'] }); }
    if (e.room === 'control' && !r.flags.ctrlReady) r.flags.ctrlReady = true;
    G.after(1.2, () => G.say(G.save.runs % 2 ? 'resume_1' : 'resume_2', { ifIdle: true }));
  },
  saved(G) { G.run.saves = (G.run.saves || 0) + 1; if (G.run.saves === 1) G.say('save_1', { ifIdle: true }); else if (G.run.saves === 4) G.say('save_2', { ifIdle: true }); },

  // ── 행동 감시 반응
  async idle(G, e) {
    if (G.ui.modalOpen && e.level < 5) return;
    if (e.level <= 4) return G.say('idle_' + e.level, { ifIdle: true });
    if (G.room?.id === 'office' && !G.flag('left')) { await G.say('idle_end', { interrupt: true }); G.ending('idle'); }
  },
  circle(G) { G.ach('circle'); G.run.circ = (G.run.circ || 0) + 1; G.say(G.run.circ % 2 ? 'circle_1' : 'circle_2', { interrupt: true }); },
  ceiling(G) { G.ach('ceiling'); G.run.ceil = (G.run.ceil || 0) + 1; G.say(G.run.ceil % 2 ? 'ceiling_1' : 'ceiling_2', { interrupt: true }); },
};
