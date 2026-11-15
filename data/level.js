// ─────────────────────────────────────────────────────────────
// 레벨 데이터 — 방·문·소품·트리거. 엔진(js/engine/world.js)이 이 데이터로 건물을 만든다.
// 좌표: 미터. x=동(+)/서(-), z=남(+)/북(-). 높이 y. 회전 r(도): 0=남쪽(+z)을 바라봄, 180=북, 90=동, -90=서.
// box: [x0, z0, x1, z1].  show: (S)=>bool 은 방에 들어갈 때마다 다시 평가된다 (재방문 변화용).
// grp: 같은 grp 의 정적 소품은 하나로 합쳐(merge) 그려지고 GROUPS[grp](S) 로 함께 보이고/숨겨진다.
// ─────────────────────────────────────────────────────────────
const today = () => new Date();
const fmtDate = (d) => [`#${d.getMonth() + 1}월`, `${d.getFullYear()}`, `#${d.getDate()}`, ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + '요일'];
const v = (S, room) => S.run.visits[room] || 0;

export const ROOMS = [
  { id: 'office', name: '0427의 사무실', box: [0, 0, 5, 5], floor: 'carpet', wall: 'wall', order: 0, amb: 'amb_hum' },
  { id: 'openoffice', name: '업무실', box: [-6, -14, 11, 0], floor: 'carpet', wall: 'wall', order: 1, amb: 'amb_hum', lightGap: 3.4 },
  { id: 'hall', name: '네 개의 문', box: [-2, -22, 7, -14], floor: 'tile', wall: 'wall', order: 2, amb: 'amb_drone' },
  { id: 'westcorr', name: '서쪽 복도', box: [-14, -19, -2, -17], floor: 'carpet', wall: 'wall', order: 3, amb: 'amb_hum' },
  { id: 'meeting', name: '회의실', box: [-22, -24, -14, -12], floor: 'carpet', wall: 'wall', order: 4, amb: 'amb_hum' },
  { id: 'longcorr', name: '긴 복도', box: [-19, -46, -17, -24], floor: 'carpetRed', wall: 'wall', order: 5, amb: 'amb_drone', lightGap: 4 },
  { id: 'archive', name: '기록보관소', box: [-17, -38, -9, -30], floor: 'tile', wall: 'wallOff', amb: 'amb_server', light: .7 },
  { id: 'control', name: '관제실', box: [-24, -56, -12, -46], h: 3.4, floor: 'tile', wall: 'concrete', order: 6, amb: 'amb_server', light: .8, lightColor: 0xdfe8ff },
  { id: 'breakroom', name: '탕비실', box: [11, -8, 19, -1], floor: 'tile', wall: 'wall', amb: 'amb_hum', lightColor: 0xfff0d8 },
  { id: 'boss', name: '부장실', box: [-12, -14, -6, -8], floor: 'carpetRed', wall: 'wall', amb: 'amb_hum', light: .8, lightColor: 0xfff2e0 },
  { id: 'devroom', name: '작업실', box: [-12, -6, -6, -1], floor: 'greyFloor', wall: 'grey', ceil: 'grey', amb: 'amb_drone', light: 1.2, lightColor: 0xffffff },
  { id: 'connector', name: '오른쪽 복도', box: [7, -20, 9, -18], floor: 'carpet', wall: 'wall', amb: 'amb_hum', loopRoom: true, light: .7 },
  // 무한 복도 모듈 (지그재그) — 모듈 k 원점 (9+6k, -18-6k)
  ...[0, 1, 2, 3].flatMap(k => {
    const ox = 9 + 6 * k, oz = -18 - 6 * k; const r = [{ id: 'loopN' + k, name: '오른쪽 복도', box: [ox, oz - 8, ox + 2, oz], floor: 'carpet', wall: 'wall', amb: 'amb_hum', loopRoom: true, lightGap: 2.7, light: .7 }];
    if (k < 3) r.push({ id: 'loopE' + k, name: '오른쪽 복도', box: [ox + 2, oz - 8, ox + 6, oz - 6], floor: 'carpet', wall: 'wall', amb: 'amb_hum', loopRoom: true, lightGap: 2.7, light: .7 });
    return r;
  }),
  { id: 'storage', name: '창고', box: [23, -35, 29, -31], floor: 'concrete', wall: 'concrete', amb: 'amb_drone', light: .6 },
  { id: 'stair', name: '계단실', box: [29, -35, 33, -31], h: 3.2, floor: 'concrete', wall: 'concrete', amb: 'amb_drone', light: .7, lightColor: 0xe6f0e0 },
  { id: 'outside', name: '바깥', box: [90, -45, 150, 20], outdoor: true, floor: 'asphalt', amb: 'amb_outside', fog: [0xf2f2ee, 4, 46] },
  { id: 'lobby', name: '엘리베이터 홀', box: [0, -26, 5, -22], floor: 'tile', wall: 'wall', amb: 'amb_hum' },
  { id: 'elevator', name: '엘리베이터', box: [1.6, -28, 3.4, -26], h: 2.5, floor: 'tile', wall: 'metal', ceil: 'metal', amb: 'amb_hum', light: .9 },
  { id: 'tunnel', name: '좁은 통로', box: [5.6, -34, 6.4, -22], h: 1.3, floor: 'carpet', wall: 'wall', amb: 'amb_drone', light: .45, lightGap: 4 },
  { id: 'mirror', name: '거울 사무실', box: [3.5, -39, 8.5, -34], floor: 'carpet', wall: 'wall', amb: 'amb_hum', lightColor: 0xf0fff8 },
  { id: 'meta', name: '출구 없음', box: [5, 0, 13, 5], floor: 'tile', wall: 'wallWhite', ceil: 'wallWhite', amb: 'title_pad', light: 1.3, lightColor: 0xffffff },
];

export const DOORS = [
  { id: 'd_office', a: 'office', b: 'openoffice', at: [2.5, 0], axis: 'x', sign: '0427' },
  { id: 'd_hallS', a: 'openoffice', b: 'hall', at: [2.5, -14], axis: 'x', sign: '7층 업무동' },
  { id: 'd_break', a: 'openoffice', b: 'breakroom', at: [11, -4.5], axis: 'z', sign: '탕비실' },
  { id: 'd_boss', a: 'openoffice', b: 'boss', at: [-6, -11], axis: 'z', sign: '부장실' },
  { id: 'd_fake', a: 'openoffice', b: 'devroom', at: [-6, -3.5], axis: 'z', w: 1.2, type: 'fake' },
  { id: 'd_left', a: 'hall', b: 'westcorr', at: [-2, -18], axis: 'z', sign: 'A' },
  { id: 'd_mid', a: 'hall', b: 'lobby', at: [2.5, -22], axis: 'x', sign: '엘리베이터' },
  { id: 'd_right', a: 'hall', b: 'connector', at: [7, -19], axis: 'z', sign: 'B' },
  { id: 'd_small', a: 'hall', b: 'tunnel', at: [6, -22], axis: 'x', w: .7, h: 1.15 },
  { id: 'd_meetE', a: 'westcorr', b: 'meeting', at: [-14, -18], axis: 'z', sign: '회의실' },
  { id: 'd_meetN', a: 'meeting', b: 'longcorr', at: [-18, -24], axis: 'x' },
  { id: 'd_archive', a: 'longcorr', b: 'archive', at: [-17, -34], axis: 'z', type: 'keypad', code: '2741', sign: '기록보관소' },
  { id: 'd_control', a: 'longcorr', b: 'control', at: [-18, -46], axis: 'x', sign: '관제실' },
  // 동료들의 잠긴 문 (반대편 없음)
  ...[['0421', -27], ['0422', -30], ['0423', -33], ['0424', -37], ['0425', -40], ['0426', -43]].map(([n, z]) => ({ id: 'd_c' + n, a: 'longcorr', b: null, at: [-19, z], axis: 'z', type: 'locked', sign: n, swing: 'a' })),
  // 무한 복도 연결부 (문짝 없는 개구부)
  { id: 'o_c0', a: 'connector', b: 'loopN0', at: [9, -19], axis: 'z', w: 2, h: 2.8, type: 'open' },
  ...[0, 1, 2].flatMap(k => { const ox = 9 + 6 * k, oz = -18 - 6 * k; return [
    { id: 'o_ne' + k, a: 'loopN' + k, b: 'loopE' + k, at: [ox + 2, oz - 7], axis: 'z', w: 2, h: 2.8, type: 'open' },
    { id: 'o_en' + k, a: 'loopE' + k, b: 'loopN' + (k + 1), at: [ox + 6, oz - 7], axis: 'z', w: 2, h: 2.8, type: 'open' }]; }),
  { id: 'd_storage', a: 'loopN2', b: 'storage', at: [23, -33], axis: 'z', show: S => S.run.loops >= 2 || S.run.flags.storageSeen, sign: '창고' },
  { id: 'd_exit', a: 'storage', b: 'stair', at: [29, -33], axis: 'z', type: 'keycard', mat: 'doorMetal', sign: '비상구', signGlow: true },
  { id: 'd_stair', a: 'stair', b: null, at: [31, -35], axis: 'x', type: 'stair', mat: 'doorMetal', sign: '계단 ↓' },
  { id: 'd_elev', a: 'lobby', b: 'elevator', at: [2.5, -26], axis: 'x', w: 1.2, h: 2.2, type: 'elevator' },
  { id: 'o_tunnel', a: 'tunnel', b: 'mirror', at: [6, -34], axis: 'x', w: .8, h: 1.25, type: 'open' },
  { id: 'd_meta', a: 'office', b: 'meta', at: [5, 1], axis: 'z', show: S => Object.keys(S.save.endings).length >= 5, sign: '출구 없음' },
];

// 업무실 칸막이 자리 생성 도우미
function cubicle(x, z, i, extra = {}) {
  const P = [
    { m: 'desk', p: [x, z], r: 0, col: true },
    { m: 'partition', p: [x, z - .42], o: { w: 1.6 }, col: true },
    { m: 'partition', p: [x - .82, z + .05], r: 90, o: { w: .95 }, col: true },
    { m: 'monitor', p: [x, z - .18], y: .76, o: { shared: true, text: ['정연 인트라넷', '', '업무 대기 중…'] } },
    { m: 'keyboard', p: [x, z + .12], y: .76 },
    { m: 'chair', p: [x + .05, z + .62], r: 180 + ((i * 37) % 40 - 20), grp: 'chairsNormal', col: true },
    { m: 'chair', p: [x + .05, z + .62], r: 0, grp: 'chairsTurned', col: true },
  ];
  if (i % 3 === 0) P.push({ m: 'mug', p: [x - .45, z + .1], y: .76 });
  if (i % 4 === 1) P.push({ m: 'plant', p: [x + .5, z - .1], y: .76, o: { scale: .5 } });
  return P;
}
const cubicles = [];
let ci = 0;
for (const z of [-2, -6, -9.6]) for (const x of [-4.6, -2.8, -1.0]) cubicles.push(...cubicle(x, z, ci++));
for (const z of [-2.5, -6.5, -10.5]) for (const x of [5.9, 7.7, 9.5]) cubicles.push(...cubicle(x, z, ci++));

export const GROUPS = {
  chairsNormal: S => v(S, 'openoffice') < 3,
  chairsTurned: S => v(S, 'openoffice') >= 3,
};

export const PROPS = [
  // ── 0427 사무실
  { id: 'deskMine', m: 'desk', p: [.8, 2.5], r: 90, col: true, interact: { type: 'drawer', name: '책상 서랍' } },
  { id: 'pcMine', m: 'monitor', p: [.62, 2.5], y: .76, r: 90, interact: { type: 'computer', pc: 'pc_0427', name: '컴퓨터' } },
  { m: 'keyboard', p: [.98, 2.5], y: .76, r: 90 },
  { id: 'phoneMine', m: 'phone', p: [.7, 3.05], y: .76, r: 90, interact: { type: 'phone', name: '전화' } },
  { m: 'nameplate', p: [1.3, 2.95], y: .76, r: 90, o: { lines: ['0427'] }, show: S => v(S, 'office') < 2 && !(S.save.runs > 1) },
  { m: 'nameplate', p: [1.3, 2.95], y: .76, r: 90, o: { lines: ['0427 ?'] }, show: S => v(S, 'office') === 2 || (v(S, 'office') < 2 && (S.save.runs > 1)) },
  { m: 'nameplate', p: [1.3, 2.95], y: .76, r: 90, o: { lines: ['당신'] }, show: S => v(S, 'office') >= 3 },
  { id: 'chairMine', m: 'chair', p: [1.65, 2.5], r: -90, col: true, interact: { type: 'sit', name: '내 의자' }, show: S => v(S, 'office') < 2 },
  { id: 'chairMine2', m: 'chair', p: [2.4, 3.6], r: 0, col: true, interact: { type: 'sit', name: '내 의자 (누가 옮겼다)' }, show: S => v(S, 'office') >= 2 },
  { id: 'duck1', m: 'duck', p: [1.12, 2.02], y: .62, inside: 'deskMine', interact: { type: 'duck', name: '고무 오리' } },
  { id: 'memoDrawer', m: 'paper', p: [1.05, 1.9], y: .6, r: 20, inside: 'deskMine', interact: { type: 'doc', doc: 'memo_drawer', name: '메모' } },
  { id: 'calendar', m: 'calendar', p: [4.99, 2.2], y: 1.55, r: -90, o: () => ({ lines: fmtDate(today()) }), interact: { type: 'inspectWall', name: '달력', line: 'calendar_look', ach: 'calendar' }, show: S => v(S, 'office') < 2 },
  { id: 'calendar2', m: 'calendar', p: [4.99, 2.2], y: 1.55, r: -90, o: () => { const d = today(); d.setDate(d.getDate() + 1); return { lines: fmtDate(d), band: '#333' }; }, interact: { type: 'inspectWall', name: '달력', line: 'calendar_look2', ach: 'calendar' }, show: S => v(S, 'office') >= 2 },
  { id: 'clockOffice', m: 'clock', p: [2.5, .02], y: 2.4, r: 0, clock: S => v(S, 'office') >= 3 ? 'stop' : v(S, 'office') >= 2 ? 'back' : 'real', interact: { type: 'inspectWall', name: '시계', line: S => v(S, 'office') >= 2 ? 'clock_back' : null } },
  { id: 'plant', m: 'plant', p: [4.4, 4.4], plant: true, col: true, interact: { type: 'plant', name: '화분' } },
  { id: 'mirrorOffice', m: 'mirror', p: [4.985, 3.7], y: 1.55, r: -90, o: { w: .55, h: .8 }, interact: { type: 'inspectWall', name: '거울', line: 'mirror_look', ach: 'mirror' } },
  { id: 'switchOffice', m: 'lightswitch', p: [1.6, .02], y: 1.2, r: 0, interact: { type: 'switch', room: 'office', name: '전등 스위치' } },
  { m: 'cabinet', p: [.35, .6], r: 90, col: true },
  { m: 'trash', p: [.3, 4.5] },
  { id: 'posterOffice', m: 'poster', p: [2.5, 4.99], y: 1.6, r: 180, o: { lines: ['#오늘의 표어', '', '지시는', '당신을 위한 것입니다'] }, show: S => v(S, 'office') < 2 },
  { m: 'poster', p: [2.5, 4.99], y: 1.6, r: 180, o: { lines: ['#오늘의 표어', '', '당신은', '지시를 위한 것입니다'] }, show: S => v(S, 'office') >= 2 },
  { m: 'mug', p: [1.0, 2.05], y: .76 },

  // ── 업무실
  ...cubicles,
  { id: 'pc0425', m: 'monitor', p: [7.7, -6.68], y: .76, o: { text: ['정연 인트라넷', '', '로그인 됨: 0425'] }, interact: { type: 'computer', pc: 'pc_0425', name: '0425의 컴퓨터' } },
  { m: 'nameplate', p: [8.15, -6.3], y: .76, o: { lines: ['0425 서민지'] } },
  { id: 'note0425', m: 'paper', p: [7.3, -6.3], y: .765, r: -12, interact: { type: 'doc', doc: 'note_0425', name: '포스트잇' } },
  { m: 'nameplate', p: [-2.35, -9.2], y: .76, o: { lines: ['0426 박정우'] } },
  { id: 'note0426', m: 'paper', p: [-3.2, -9.3], y: .765, r: 8, interact: { type: 'doc', doc: 'note_0426', name: '업무 일지' } },
  { id: 'cat', m: 'cat', p: [-1.0, -6.1], y: .76, r: 200, show: S => { const d = new Date(); return d.getHours() % 12 === 3 && d.getMinutes() === 33; }, interact: { type: 'inspect', name: '고양이', line: 'cat_seen', ach: 'cat' } },
  { id: 'copier', m: 'copier', p: [10.4, -12.8], r: -90, col: true, interact: { type: 'copier', name: '복사기' } },
  { m: 'cabinet', p: [10.6, -8.2], r: -90, col: true }, { m: 'cabinet', p: [10.6, -0.6], r: -90, col: true },
  { m: 'whiteboard', p: [-2.5, -13.98], y: 1.5, o: { w: 2.4, lines: ['이번 주 목표', '지시 이행률 100%', '', '(0425: 왼쪽 → ?)'] } },
  { m: 'poster', p: [6.5, -13.99], y: 1.6, o: { lines: ['#정연', '', '정해진 그대로', '하루를 마칩시다'] } },
  { m: 'poster', p: [-5.99, -7.5], y: 1.6, r: 90, o: { lines: ['#안전 수칙', '', '1. 지시를 듣는다', '2. 지시대로 한다', '3. 1로 돌아간다'], band: '#7a2a2a' } },
  { m: 'plant', p: [-5.5, -.5], col: true }, { m: 'plant', p: [-5.5, -13.5], col: true }, { m: 'plant', p: [.8, -13.5], col: true },
  { id: 'clockOpen', m: 'clock', p: [2.5, -13.98], y: 2.45, clock: S => v(S, 'openoffice') >= 2 ? 'fast' : 'real' },

  // ── 탕비실
  { id: 'vending', m: 'vending', p: [12.6, -7.55], col: true, interact: { type: 'vending', name: '자판기' } },
  { id: 'fridge', m: 'fridge', p: [14.0, -7.6], col: true, interact: { type: 'fridge', name: '냉장고' } },
  { id: 'duck2', m: 'duck', p: [14.0, -7.6], y: 1.8, r: 20, interact: { type: 'duck', name: '고무 오리' } },
  { id: 'cooler', m: 'cooler', p: [15.2, -7.75], col: true, interact: { type: 'cooler', name: '정수기' } },
  { m: 'table', p: [15.5, -3.6], o: { w: 1.4, d: .9 }, col: true },
  { m: 'chair', p: [15.0, -2.8], r: 180, col: true }, { m: 'chair', p: [16.1, -4.4], r: 10, col: true },
  { id: 'radio', m: 'radio', p: [15.8, -3.7], y: .76, interact: { type: 'radio', name: '라디오' } },
  { id: 'arcade', m: 'arcade', p: [18.5, -6.6], r: -90, col: true, interact: { type: 'arcade', name: '오락기' } },
  { m: 'sofa', p: [16.2, -1.45], r: 180, col: true },
  { m: 'poster', p: [18.99, -3], y: 1.6, r: -90, o: { lines: ['#휴식도', '#업무입니다', '', '휴식 시간: 0분'], band: '#3a6a4a' } },
  { m: 'trash', p: [11.4, -7.6] }, { m: 'box', p: [18.5, -1.5], o: { s: .4 } },
  { m: 'clock', p: [15, -7.98], y: 2.3, clock: () => 'real' },

  // ── 부장실
  { id: 'deskBoss', m: 'desk', p: [-10.3, -11], r: 90, col: true, interact: { type: 'drawer', name: '부장 책상 서랍' } },
  { id: 'pcBoss', m: 'monitor', p: [-10.5, -11.2], y: .76, r: 90, o: { text: ['정연 인트라넷', '', '로그인 됨: 부장'] }, interact: { type: 'computer', pc: 'pc_boss', name: '부장 컴퓨터' } },
  { m: 'chair', p: [-11.2, -11], r: 90, col: true, o: { mat: 'dark' } },
  { id: 'keycard', m: 'keycard', p: [-9.98, -11.48], y: .62, inside: 'deskBoss', interact: { type: 'take', item: 'keycard', name: '카드키', line: 'boss_card', ach: 'keycard' } },
  { id: 'memoBoss', m: 'paper', p: [-9.98, -11.6], y: .6, r: 30, inside: 'deskBoss', interact: { type: 'doc', doc: 'memo_boss', name: '메모' } },
  { id: 'photoBoss', m: 'photo', p: [-10.5, -10.5], y: .76, r: 110, interact: { type: 'inspect', name: '가족사진', line: 'boss_photo' } },
  { id: 'blinds', m: 'blinds', p: [-11.98, -11], y: 1.6, r: 90, interact: { type: 'inspectWall', name: '창문', line: 'boss_window' } },
  { m: 'cabinet', p: [-7, -13.6], col: true }, { m: 'cabinet', p: [-7.6, -13.6], col: true }, { m: 'plant', p: [-11.5, -8.5], col: true, o: { scale: 1.3 } },
  { m: 'sign', p: [-9, -13.98], y: 1.9, o: { w: 1.2, h: .3, lines: ['정연 — 정해진 그대로'], bg: '#3a2a20', fg: '#e8d8b0' } },

  // ── 작업실 (비밀)
  { m: 'placeholder', p: [-10.5, -4.5], o: { s: [1.4, .75, .7], label: 'TODO: 책상' }, col: true },
  { m: 'placeholder', p: [-9.2, -4.4], o: { s: [.5, .9, .5], label: 'TODO: 의자' }, col: true },
  { m: 'placeholder', p: [-7, -2], o: { s: [.8, 1.8, .8], label: 'TODO: 자판기?' }, col: true },
  { m: 'placeholder', p: [-11.2, -1.6], o: { s: [.6, .6, .6], label: '임시' }, col: true },
  { m: 'sign', p: [-9, -5.98], y: 2.0, o: { w: 2.2, h: .4, lines: ['작업 중 — 그래픽 교체 예정'], bg: '#f2e04a', fg: '#111' } },
  { id: 'duck3', m: 'duck', p: [-10.5, -4.5], y: .75, interact: { type: 'duck', name: '고무 오리' } },
  { id: 'noteDev', m: 'paper', p: [-10.8, -4.4], y: .755, r: -20, interact: { type: 'doc', doc: 'note_dev', name: '작업자 메모' } },

  // ── 네 개의 문 홀
  { m: 'bench', p: [2.5, -15.2], col: true },
  { m: 'plant', p: [-1.4, -14.6], col: true }, { m: 'plant', p: [6.4, -14.6], col: true },
  { m: 'poster', p: [6.99, -15.8], y: 1.6, r: -90, o: { lines: ['#모든 문은', '#열려 있습니다', '', '하나만 빼고'] } },
  { id: 'clockHall', m: 'clock', p: [4.2, -21.98], y: 2.45, clock: () => 'stop' },

  // ── 서쪽 복도 / 회의실
  { m: 'poster', p: [-8, -18.99], y: 1.6, o: { lines: ['#회의는', '#짧게', '', '결론은 이미 나 있습니다'] } },
  { m: 'table', p: [-17.6, -18], o: { w: 4, d: 1.4, mat: 'wood' }, col: true },
  ...[-19.1, -18.1, -17.1, -16.1].flatMap((x, i) => [{ m: 'chair', p: [x, -19.1], r: 0, col: true }, ...(i === 1 ? [] : [{ m: 'chair', p: [x, -16.9], r: 180, col: true }])]),
  { id: 'chairMeet', m: 'chair', p: [-18.1, -16.9], r: 180, col: true, interact: { type: 'sit', name: '0427의 자리' } },
  { m: 'nameplate', p: [-18.1, -17.45], y: .76, r: 0, o: { lines: ['0427'] } },
  { id: 'duck4', m: 'duck', p: [-16.1, -19.1], y: 0, r: 40, interact: { type: 'duck', name: '고무 오리' } },
  { id: 'proj', m: 'projscreen', p: [-21.97, -18], y: 1.6, r: 90, o: { lines: ['#오늘의 안건', '', '0427'] }, interact: { type: 'slides', name: '발표 화면' } },
  { m: 'plant', p: [-21.4, -12.6], col: true }, { m: 'plant', p: [-14.6, -23.4], col: true },

  // ── 긴 복도
  { m: 'poster', p: [-17.01, -27], y: 1.6, r: -90, o: { lines: ['#오늘도', '#수고하셨습니다', '', '아직 끝나지 않았지만'] } },
  { m: 'poster', p: [-17.01, -42], y: 1.6, r: -90, o: { lines: ['#0426 박정우', '', '이달의 사원', '(무기한)'], band: '#8a7a2a' } },
  { id: 'keypad', m: 'keypad', p: [-17.02, -35], y: 1.3, r: -90, interact: { type: 'keypad', door: 'd_archive', name: '키패드' } },

  // ── 기록보관소
  ...[-36.6, -31.4].flatMap(z => [-15, -13.2, -11.4].map(x => ({ m: 'shelf', p: [x, z], r: z < -34 ? 0 : 180, o: { w: 1.6, box: 'folder' }, col: true }))),
  { m: 'desk', p: [-9.8, -34], r: -90, col: true },
  { id: 'archiveTerm', m: 'monitor', p: [-9.62, -34], y: .76, r: -90, o: { text: ['인사기록 단말', '', '조회: 0427'], bg: '#2a0f0f' }, interact: { type: 'event', ev: 'archive_term', name: '인사기록 단말기' } },

  // ── 관제실
  { m: 'console', p: [-18, -52.8], o: { w: 4.4 }, col: true },
  { id: 'btnApprove', m: 'bigbutton', p: [-18.7, -52.75], y: .88, o: { color: 'green' }, interact: { type: 'event', ev: 'approve', name: '승인' } },
  { id: 'btnStop', m: 'bigbutton', p: [-17.3, -52.75], y: .88, o: { color: 'red' }, interact: { type: 'event', ev: 'stop', name: '중지' } },
  { m: 'sign', p: [-18.7, -52.35], y: .83, r: 0, o: { w: .3, h: .08, lines: ['승인'] } },
  { m: 'sign', p: [-17.3, -52.35], y: .83, r: 0, o: { w: .3, h: .08, lines: ['중지'] } },
  { id: 'cctv', m: 'screenwall', p: [-18, -55.96], y: 2.0, o: { w: 6, h: 2.4, cw: 640, ch: 256 }, cctv: true },
  { m: 'screenwall', p: [-23.96, -51], y: 1.8, r: 90, o: { w: 2.6, h: 1.4 }, cctv: 'noise' },
  { m: 'screenwall', p: [-12.04, -51], y: 1.8, r: -90, o: { w: 2.6, h: 1.4 }, cctv: 'noise' },
  { m: 'chair', p: [-18, -51.9], r: 180, col: true },

  // ── 무한 복도 장식 (모듈마다 동일)
  ...[0, 1, 2, 3].flatMap(k => { const ox = 9 + 6 * k, oz = -18 - 6 * k; return [
    { id: 'loopPoster' + k, m: 'poster', p: [ox + .01, oz - 4.2], y: 1.6, r: 90, o: { lines: ['#정연', '', '같은 길도', '처음처럼'] } },
    { m: 'cabinet', p: [ox + 1.72, oz - 1.1], r: -90, o: { h: .7 }, col: true }]; }),
  // ── 창고 / 계단 / 바깥
  { m: 'shelf', p: [25, -34.7], o: { w: 2 }, col: true }, { m: 'shelf', p: [25, -31.3], r: 180, o: { w: 2 }, col: true },
  { m: 'box', p: [27.4, -34.5], col: true }, { m: 'box', p: [27.6, -31.6], o: { s: .6 }, col: true },
  { id: 'reader', m: 'cardreader', p: [28.98, -32.2], y: 1.3, r: -90 },
  { id: 'floorSign', m: 'sign', p: [32.98, -33], y: 1.8, r: -90, o: { w: 1.4, h: 1.4, lines: ['#7F'], bg: '#d8d8d0', fg: '#222', ph: 512 } },
  { m: 'stairsrail', p: [30, -33] },
  { m: 'facade', p: [120, 8.5], r: 180, o: { w: 34, h: 30 } },
  { m: 'car', p: [112, -6], r: 12, col: true }, { m: 'car', p: [128, -14], r: -80, col: true },

  // ── 엘리베이터
  { m: 'sign', p: [2.5, -25.98], y: 2.45, o: { w: .5, h: .16, lines: ['7'], bg: '#111', fg: '#ff5a3a' }, id: 'elevFloorSign' },
  { id: 'elevCall', m: 'lightswitch', p: [3.5, -25.98], y: 1.2, interact: { type: 'event', ev: 'elev_call', name: '호출 버튼' } },
  { id: 'elevPanel', m: 'elevpanel', p: [3.38, -26.6], y: 1.25, r: -90, interact: { type: 'elevator', name: '엘리베이터 버튼' } },

  // ── 거울 사무실 (0427 사무실의 좌우 반전)
  { m: 'desk', p: [7.7, -36.5], r: -90, col: true },
  { m: 'monitor', p: [7.88, -36.5], y: .76, r: -90, o: { text: ['넷라트인 연정', '', '7240 :됨 인그로'] } },
  { m: 'nameplate', p: [7.2, -37.0], y: .76, r: -90, o: { lines: ['7240'] }, id: 'nameMirror' },
  { id: 'chairMirror', m: 'chair', p: [6.85, -36.5], r: 90, col: true, interact: { type: 'sit', name: '반대편 의자' } },
  { m: 'calendar', p: [3.51, -36.8], y: 1.55, r: 90, o: () => ({ lines: fmtDate(today()).map(s => [...s].reverse().join('')) }) },
  { m: 'clock', p: [6, -38.98], y: 2.4, clock: () => 'back' },
  { id: 'duck5', m: 'duck', p: [4.2, -38.4], y: 0, r: 200, interact: { type: 'duck', name: '고무 오리' } },
  { m: 'poster', p: [6, -34.01], y: 1.6, r: 180, o: { lines: ['#어표 의늘오', '', '은시지', '다니입 것 한위 을신당'] } },
  { m: 'plant', p: [4.1, -34.6], col: true },

  // ── 메뉴실 (메타)
  { m: 'sign', p: [9, .02], y: 2.0, o: { w: 4, h: .9, lines: ['#새 게임'], bg: '#ffffff', fg: '#222', ph: 128 } },
  { m: 'sign', p: [12.98, 2.5], y: 2.0, r: -90, o: { w: 3, h: .9, lines: ['#설정'], bg: '#ffffff', fg: '#222', ph: 160 } },
  { m: 'sign', p: [9, 4.98], y: 2.0, r: 180, o: { w: 3, h: .9, lines: ['#도전과제'], bg: '#ffffff', fg: '#222', ph: 160 } },
  { id: 'quitPad', m: 'placeholder', p: [11.6, 2.5], o: { s: [1.4, .02, 1.4], label: '' } },
  { m: 'sign', p: [11.6, 2.5], y: .03, r: 0, o: { w: 1.3, h: 1.3, lines: ['#종료'], bg: '#202020', fg: '#ffffff', ph: 512 }, flat: true },
];

export const TRIGGERS = [
  { id: 'long_mid', box: [-19, -36, -17, -31] },
  { id: 'ctrl_near', box: [-21, -53, -15, -50] },
  { id: 'out_far', box: [90, -45, 150, -18] },
  { id: 'out_mid', box: [90, -12, 150, -6] },
  { id: 'meta_quit', box: [11, 1.9, 12.3, 3.1] },
  { id: 'fake_wall', box: [-6.6, -4.1, -5.4, -2.9] },
  { id: 'hall_small_near', box: [5.2, -22, 6.8, -20.6] },
];
// 순간이동: 무한 복도 모듈3 입구 → 모듈2 입구 (같은 모양이라 티가 안 남)
export const TELEPORTS = [{ id: 'loop', box: [27.15, -38, 29, -36], d: [-6, 6] }];

export const SPAWNS = {
  start: { p: [2.5, 3.7], yaw: 0 },
  outside: { p: [120, 4.5], yaw: 0, room: 'outside' },
};
export const CCTV_BOUNDS = [-28, -60, 36, 8]; // 관제실 화면에 그릴 지도 범위
