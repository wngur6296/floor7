// 영구 저장 (localStorage) — 안내 음성은 이걸로 지난 출근을 기억한다.
const KEY = 'jungyeon7f.save.v1';
export const DEFAULT_SETTINGS = {
  quality: 'auto', resScale: 1, grain: true, vignette: true, fov: 72,          // 그래픽
  master: .9, music: .8, voice: 1, sfx: .9,                                       // 오디오
  sens: 1, invertY: false, joySize: 1, joySide: 'left',                           // 조작
  sub: 1, subBg: .6, speaker: true,                                               // 자막
  reduceMotion: false, reduceFlicker: false,                                      // 접근성
};
export function newSave() { return { v: 1, runs: 0, endings: {}, lastEnding: null, ach: {}, lastVisit: 0, prevVisit: 0, totalDefy: 0, totalAsk: 0, totalTime: 0, plant: 0, ducks: {}, digits: {}, settings: { ...DEFAULT_SETTINGS } }; }
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { s.settings = { ...DEFAULT_SETTINGS, ...s.settings }; return s; } } catch { }
  return newSave();
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { } }
export function newRun() {
  return { visits: {}, flags: {}, drawers: {}, items: [], defy: 0, back: 0, stats: { obey: 0, defy: 0, ask: 0, quiet: 0 }, loops: 0, time: 0, maxOrder: 0, said: {}, lightsOff: {}, idle: 0 };
}
