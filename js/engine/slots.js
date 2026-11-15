// 저장 슬롯: 자동 저장 1 + 수동 3. 각 슬롯 = 진행 상태 + 썸네일 + 메타데이터. (프로필 기록은 save.js)
const KEY = 'jungyeon7f.slots.v1';
export const SLOT_IDS = ['auto', 's1', 's2', 's3'];
export const SLOT_NAMES = { auto: '자동 저장', s1: '슬롯 1', s2: '슬롯 2', s3: '슬롯 3' };
function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function writeAll(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { console.warn('저장 실패', e); return false; } }
export function listSlots() { const a = readAll(); return SLOT_IDS.map(id => ({ id, name: SLOT_NAMES[id], data: a[id] || null })); }
export function getSlot(id) { return readAll()[id] || null; }
export function writeSlot(id, data) { const a = readAll(); a[id] = data; if (writeAll(a)) return true; delete a[id].thumb; return writeAll(a); }
export function deleteSlot(id) { const a = readAll(); delete a[id]; writeAll(a); }
export function latestSlot() { return listSlots().filter(s => s.data).sort((x, y) => y.data.ts - x.data.ts)[0] || null; }
export function clearSlots() { try { localStorage.removeItem(KEY); } catch { } }
export function fmtTime(sec) { sec = Math.floor(sec || 0); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
export function fmtDate(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
