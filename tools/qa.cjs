// 종합 자동 QA: 콘솔 오류 · 처리 안 된 Promise 거부 · 404/요청 실패 0 을 단언하면서
//  1) 데스크톱: 메뉴 → 새 게임 → 설정 전 항목 토글 → 슬롯 1·2·3·자동 저장/불러오기/삭제 → 결말 화면
//  2) iPhone 14 에뮬레이션(터치·DPR3): 메뉴 → 결말 12개 전부 디버그 스크립트로 진행 → 저장/불러오기
//  3) 성능: 주요 방마다 드로우콜·삼각형·FPS 측정, 초기 다운로드 용량 측정
// 사용: python3 -m http.server 18427 &  →  PW=<playwright> node tools/qa.cjs [desk|ios|perf|all]   (QA_BROWSER=webkit 가능)
const pw = require(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:18427/';
const MODE = process.argv[2] || 'all';
const SHOTS = __dirname + '/../screens/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
const IPHONE14 = { viewport: { width: 390, height: 664 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' };
const problems = []; const results = []; const log = (...a) => console.log(...a);
const ok = (c, m) => { results.push([m, !!c]); if (!c) problems.push('ASSERT ' + m); log((c ? '  ✓ ' : '  ✗ ') + m); return c; };

async function openPage(browser, tag, ctxOpt) {
  const ctx = await browser.newContext(ctxOpt); const p = await ctx.newPage(); const bytes = { total: 0, list: [] };
  await p.addInitScript(() => { window.__rej = []; addEventListener('unhandledrejection', e => window.__rej.push(String(e.reason?.stack || e.reason))); });
  p.on('pageerror', e => problems.push(`[${tag}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') problems.push(`[${tag}] console.error ${m.text()}`); });
  p.on('requestfailed', r => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED|cancelled/i.test(f)) problems.push(`[${tag}] requestfailed ${r.url()} ${f}`); });
  p.on('response', async r => { if (r.status() >= 400) problems.push(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
  p.on('requestfinished', async r => { try { const s = await r.sizes(); bytes.total += s.responseBodySize; bytes.list.push([r.url().replace(BASE, ''), s.responseBodySize]); } catch { } });
  p.bytes = bytes; p.tag = tag; return { ctx, p };
}
const ev = (p, f, a) => p.evaluate(f, a);
const until = async (p, fn, ms = 60000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(200); } return false; };
const tapOrClick = (p, sel) => p.isMobile ? p.tap(sel) : p.click(sel);
async function checkRej(p) { const r = await ev(p, () => window.__rej.splice(0)); for (const x of r) problems.push(`[${p.tag}] unhandledrejection ${x}`); }

// ── 결말 12개 (상태 주입 + 위치 순간이동으로 각 루트 진행)
function endingFlows(p) {
  const go = async (x, z, ms = 400) => { await ev(p, ([x, z]) => { const g = __game; g.player.pos.x = x; g.player.pos.z = z; }, [x, z]); await p.waitForTimeout(ms); };
  const use = async (id, ms = 300) => { await ev(p, id => __game.use({ prop: id }), id); await p.waitForTimeout(ms); };
  const left = async () => { await go(2.5, 3.7); await until(p, () => __game.run.flags.instructed, 60000); };
  const toControl = async () => { await go(2.5, -1.5, 800); await go(2.5, -16, 800); await go(-6, -18, 600); await go(-16, -18, 800); await go(-18, -26, 600); await go(-18, -48, 600); };
  const clickIn = sel => ev(p, s => document.querySelector(s)?.click(), sel);
  return {
    idle: async () => { await ev(p, () => __game.input.lastInput = performance.now() - 301000); },
    perfect: async () => { await left(); await toControl(); await until(p, () => __game.run.flags.ctrlReady); await use('btnApprove'); },
    silence: async () => { await toControl(); await p.waitForTimeout(1000); await use('btnStop'); },
    loop: async () => { await go(2.5, -1.5); await go(2.5, -16); await go(8, -19); await go(10, -22); await go(13, -25); await go(16, -28); await go(19, -31); await go(22, -34); for (let i = 0; i < 8; i++) { await go(25.5, -37, 300); await go(27.8, -37, 500); } },
    outside: async () => { await go(2.5, -1.5); await go(2.5, -16); await go(8, -19); await go(10, -22); await go(16, -28); await go(22, -34); for (let i = 0; i < 2; i++) { await go(25.5, -37, 300); await go(27.8, -37, 400); }
      await ev(p, () => __game.G.item('keycard', true)); await go(22.3, -33, 400); await ev(p, () => __game.world.setDoor('d_storage', true)); await p.waitForTimeout(300); await go(26, -33, 500);
      await ev(p, () => __game.useDoor(__game.world.doors.get('d_exit'))); await p.waitForTimeout(500); await go(31, -33, 500);
      for (let i = 0; i < 9; i++) { await ev(p, () => __game.useDoor(__game.world.doors.get('d_stair'))); await until(p, () => !__game.run.flags.stairBusy, 20000); await p.waitForTimeout(200); }
      await p.waitForTimeout(800); await go(120, -8, 1500); await go(120, -25, 500); },
    sit: async () => { await left(); await go(2.5, -1.5, 600); await go(2.5, 3.7, 600); await use('chairMine2'); },
    mirror: async () => { await go(2.5, -1.5); await go(2.5, -16); await go(6, -28, 600); await go(6, -36.5, 800); await use('chairMirror'); },
    basement: async () => { await go(2.5, -1.5); await go(2.5, -16); await go(2.5, -24); await go(2.5, -27); await use('elevPanel'); for (let i = 0; i < 3; i++) { await clickIn('#modal .ebtns button[data-b="0"]'); await p.waitForTimeout(1200); } },
    hold: async () => { await use('phoneMine'); },
    '0426': async () => { await ev(p, () => __game.run.stats.ask = 4); await toControl(); await until(p, () => __game.room?.id === 'control' && !!__game.beatOn); for (let i = 0; i < 30; i++) { await ev(p, () => (() => { const g = __game, c = g.camera.position; const dx = -18 - c.x, dy = 2 - c.y, dz = -55.96 - c.z; g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); })()); await p.waitForTimeout(100); } },
    archive: async () => { await go(2.5, -1.5); await go(2.5, -16); await go(-6, -18); await go(-16, -18); await go(-17.6, -35); await use('keypad'); for (const k of ['2', '7', '4', '1', 'OK']) await clickIn(`#modal .keys button[data-k="${k}"]`); await p.waitForTimeout(1500); await go(-13, -34, 800); await use('archiveTerm'); },
    meta: async () => { ok(await ev(p, () => __game.world.doors.get('d_meta').shown), 'd_meta 문 (결말 5개 이상) 표시'); await ev(p, () => __game.world.setDoor('d_meta', true)); await p.waitForTimeout(300); await go(7, 2.5, 800); await go(11.6, 2.5, 500); },
  };
}
async function runEndings(p, which) {
  const F = endingFlows(p); const res = {};
  for (const name of which || Object.keys(F)) {
    try {
      await p.waitForTimeout(700);
      await ev(p, () => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); document.body.classList.add('playing'); __game.startRun(); __game.ts = 30; __game.quality('low'); });
      await p.waitForTimeout(300); await F[name]();
      res[name] = await until(p, n => !!(__game.save.endings[n] && !__game.running), 90000, name);
    } catch (e) { res[name] = 'ERR ' + e.message.split('\n')[0]; }
    ok(res[name] === true, `결말 ${name}`); await checkRej(p);
  }
  return res;
}

// ── 저장/불러오기: 슬롯 1·2·3 을 서로 다른 위치에서 저장 → 각각 불러와 위치·방 확인 → 자동 저장 → 삭제
async function slotsTest(p) {
  const pos = { s1: [2.5, -3], s2: [2.5, -15.5], s3: [-15, -18] }; const saved = {};
  for (const [id, [x, z]] of Object.entries(pos)) {
    await ev(p, ([x, z]) => { const g = __game; g.player.pos.x = x; g.player.pos.z = z; }, [x, z]); await p.waitForTimeout(700);
    saved[id] = await ev(p, () => ({ room: (__game.world.roomAt(__game.player.pos.x, __game.player.pos.z) || __game.room)?.id, x: __game.player.pos.x, z: __game.player.pos.z }));
    await p.keyboard.press('KeyP').catch(() => { }); if (!(await p.$('#pause.on'))) await ev(p, () => document.querySelector('#btnPause').click());
    await p.waitForSelector('#pause.on'); await tapOrClick(p, '#pause [data-act=save]'); await p.waitForSelector('#slots.on');
    await tapOrClick(p, `#slotGrid [data-id=${id}]`); await p.waitForTimeout(300); if (await p.$('#confirm.on')) await tapOrClick(p, '#cYes'); await p.waitForTimeout(400);
    ok(await ev(p, id => !!JSON.parse(localStorage.getItem('jungyeon7f.slots.v1') || '{}')[id]?.state, id), `${id} 저장 (${saved[id].room})`);
    await ev(p, () => { document.querySelector('#slots .back').click(); }); await p.waitForTimeout(300); await ev(p, () => document.querySelector('#pause [data-act=resume]').click()); await p.waitForTimeout(400);
  }
  for (const id of Object.keys(pos)) {
    await ev(p, () => { const g = __game; g.player.pos.x = 2.5; g.player.pos.z = 3.5; }); await p.waitForTimeout(400);
    await ev(p, () => document.querySelector('#btnPause').click()); await p.waitForSelector('#pause.on'); await tapOrClick(p, '#pause [data-act=load]'); await p.waitForSelector('#slots.on');
    await tapOrClick(p, `#slotGrid [data-id=${id}]`); await p.waitForSelector('#confirm.on'); await tapOrClick(p, '#cYes'); await p.waitForTimeout(900);
    const now = await ev(p, () => ({ room: __game.room?.id, x: __game.player.pos.x, z: __game.player.pos.z, run: __game.running }));
    ok(now.run && now.room === saved[id].room && Math.hypot(now.x - saved[id].x, now.z - saved[id].z) < .6, `${id} 불러오기 → ${now.room} (${now.x.toFixed(1)}, ${now.z.toFixed(1)})`);
  }
  // 자동 저장: 방 이동 → auto 갱신
  await ev(p, () => { __game.lastAuto = 0; const g = __game; g.player.pos.x = 2.5; g.player.pos.z = -15.5; }); await p.waitForTimeout(400); await ev(p, () => { const g = __game; g.player.pos.x = 2.5; g.player.pos.z = -5; }); await p.waitForTimeout(1200);
  ok(await ev(p, () => !!JSON.parse(localStorage.getItem('jungyeon7f.slots.v1') || '{}').auto?.state), '자동 저장 생성');
  await ev(p, () => document.querySelector('#btnPause').click()); await p.waitForSelector('#pause.on'); await tapOrClick(p, '#pause [data-act=load]');
  await tapOrClick(p, '#slotGrid [data-id=auto]'); await p.waitForSelector('#confirm.on'); await tapOrClick(p, '#cYes'); await p.waitForTimeout(900);
  ok(await ev(p, () => __game.running), '자동 저장 불러오기');
  // 삭제
  await ev(p, () => document.querySelector('#btnPause').click()); await p.waitForSelector('#pause.on'); await tapOrClick(p, '#pause [data-act=load]');
  await ev(p, () => document.querySelector('#slotGrid [data-del=s3]').click()); await p.waitForSelector('#confirm.on'); await tapOrClick(p, '#cYes'); await p.waitForTimeout(300);
  ok(await ev(p, () => !JSON.parse(localStorage.getItem('jungyeon7f.slots.v1') || '{}').s3), '슬롯 3 삭제');
  await ev(p, () => document.querySelector('#slots .back').click()); await p.waitForTimeout(300); await ev(p, () => document.querySelector('#pause [data-act=resume]').click()); await p.waitForTimeout(300);
}
// ── 설정: 모든 탭의 모든 항목을 조작하고 게임 상태에 반영되는지 확인
async function settingsTest(p) {
  await tapOrClick(p, '#mainNav [data-act=settings]'); await p.waitForSelector('#settings.on');
  for (let t = 0; t < 5; t++) {
    await tapOrClick(p, `#setTabs [data-i="${t}"]`); await p.waitForTimeout(200);
    const rows = await ev(p, () => [...document.querySelectorAll('#setBody .row[data-k]')].map(r => ({ k: r.dataset.k, kind: r.querySelector('.seg') ? 'seg' : r.querySelector('.tog') ? 'tog' : 'range' })));
    for (const r of rows) {
      if (r.kind === 'tog') { await tapOrClick(p, `#setBody .row[data-k="${r.k}"] .tog`); await tapOrClick(p, `#setBody .row[data-k="${r.k}"] .tog`); }
      else if (r.kind === 'seg') { const vs = await ev(p, k => [...document.querySelectorAll(`#setBody .row[data-k="${k}"] .seg button`)].map(b => b.dataset.v), r.k); for (const v of [...vs, vs[0]]) { await tapOrClick(p, `#setBody .row[data-k="${r.k}"] .seg button[data-v="${v}"]`); await p.waitForTimeout(80); } }
      else await ev(p, k => { const i = document.querySelector(`#setBody .row[data-k="${k}"] input`); const v0 = i.value; for (const v of [i.min, i.max, v0]) { i.value = v; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); } }, r.k);
    }
  }
  // 반영 확인
  await ev(p, () => { const i = document.querySelector('#setTabs [data-i="2"]'); i.click(); });
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="sens"] input'); i.value = 1.8; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
  ok(await ev(p, () => Math.abs(__game.input.sens - 1.8) < .01), '감도 → input.sens 반영');
  await ev(p, () => document.querySelector('#setBody .row[data-k="invertY"] .tog').click()); ok(await ev(p, () => __game.input.invertY === true), '상하 반전 반영');
  await ev(p, () => document.querySelector('#setBody .row[data-k="invertY"] .tog').click());
  await ev(p, () => document.querySelector('#setBody .row[data-k="joySide"] .seg button[data-v="right"]').click()); ok(await ev(p, () => __game.input.joySide === 'right'), '조이스틱 위치 반영');
  await ev(p, () => document.querySelector('#setBody .row[data-k="joySide"] .seg button[data-v="left"]').click());
  await ev(p, () => document.querySelector('#setTabs [data-i="0"]').click());
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="fov"] input'); i.value = 85; i.dispatchEvent(new Event('input')); });
  ok(await ev(p, () => Math.abs(__game.camera.fov - (innerWidth < innerHeight ? 93 : 83)) < .01), 'FOV 반영');
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="fov"] input'); i.value = 72; i.dispatchEvent(new Event('input')); });
  await ev(p, () => document.querySelector('#setTabs [data-i="3"]').click());
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="sub"] input'); i.value = 1.3; i.dispatchEvent(new Event('input')); });
  ok(await ev(p, () => getComputedStyle(document.documentElement).getPropertyValue('--sub').trim() === '1.3'), '자막 크기 → CSS 변수');
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="sub"] input'); i.value = 1; i.dispatchEvent(new Event('input')); });
  await ev(p, () => document.querySelector('#setTabs [data-i="1"]').click());
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="master"] input'); i.value = .5; i.dispatchEvent(new Event('input')); });
  ok(await ev(p, () => __game.audio.vol.master === .5), '전체 음량 반영');
  await ev(p, () => { const i = document.querySelector('#setBody .row[data-k="master"] input'); i.value = .9; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
  ok(await ev(p, () => JSON.parse(localStorage.getItem('jungyeon7f.save.v1')).settings.master === .9), '설정 localStorage 저장');
  await ev(p, () => document.querySelector('#bDefaults').click()); await p.waitForSelector('#confirm.on'); await tapOrClick(p, '#cYes'); await p.waitForTimeout(200);
  ok(await ev(p, () => __game.save.settings.quality === 'auto' && __game.save.settings.fov === 72), '기본값 복원');
  await ev(p, () => document.querySelector('#settings .back').click()); await p.waitForTimeout(400);
}
// ── 메뉴 화면 순회
async function menuTour(p, prefix) {
  for (const a of ['achs', 'gallery', 'credits', 'load']) { await tapOrClick(p, `#mainNav [data-act=${a}]`); await p.waitForTimeout(500); ok(await ev(p, () => !!document.querySelector('.sub-screen.on')), `${prefix} 메뉴 ${a} 열림`); await ev(p, () => document.querySelector('.sub-screen.on .back').click()); await p.waitForTimeout(400); }
  await tapOrClick(p, '#mainNav [data-act=gallery]'); await ev(p, () => document.querySelector('#galTabs [data-tab=rec]').click()); await p.waitForTimeout(200);
  ok(await ev(p, () => document.querySelector('#endList').hidden && !document.querySelector('#statList').hidden), `${prefix} 기록 탭`); await ev(p, () => document.querySelector('#gallery .back').click()); await p.waitForTimeout(300);
}
// ── 성능 측정
async function perf(p, label) {
  const pos = { office: [2.5, 3.0, 0], openoffice: [2.5, -1, 0], hall: [2.5, -15.2, 0], meeting: [-15, -18, 1.57], loop: [10, -19.5, 0], control: [-18, -48, 0], breakroom: [12, -2, -0.8], storage: [24, -33, 0], outside: [120, 2, 0], mirror: [6, -34.6, 0] };
  await ev(p, () => { __game.ts = 1; __game.save.settings.quality = 'high'; __game.quality('high'); }); const out = {};
  for (const [k, [x, z, y]] of Object.entries(pos)) {
    await ev(p, ([x, z, y]) => { const g = __game; g.player.pos.x = x; g.player.pos.z = z; g.player.yaw = y; g.player.pitch = 0; g._cullT = 1; }, [x, z, y]); await p.waitForTimeout(1200);
    out[k] = await ev(p, async () => { const g = __game; const t0 = performance.now(); let n = 0, mx = 0, sumMs = 0, last = t0; const calls = [], tris = [];
      await new Promise(res => { const f = () => { const now = performance.now(); n++; mx = Math.max(mx, now - last); sumMs += now - last; last = now; calls.push(g.stats?.calls || 0); tris.push(g.stats?.tris || 0); if (now - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      return { calls: Math.max(...calls), tris: Math.max(...tris), fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), worstMs: Math.round(mx), geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures }; });
  }
  log(`  성능 (${label}, 화질 high):`); for (const [k, v] of Object.entries(out)) log(`    ${k.padEnd(11)} 드로우콜 ${String(v.calls).padStart(4)}  삼각형 ${String(v.tris).padStart(6)}  FPS ${v.fps}  최악 프레임 ${v.worstMs}ms`);
  const mem = await ev(p, () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null); if (mem) log(`    JS 힙 ${mem}MB`);
  await ev(p, () => { __game.save.settings.quality = 'auto'; __game.quality('auto'); });
  return out;
}

(async () => {
  const bt = pw[process.env.QA_BROWSER || 'chromium']; const browser = await bt.launch(process.env.QA_BROWSER === 'webkit' ? {} : { args: ARGS }); const report = {};
  if (MODE === 'all' || MODE === 'desk' || MODE === 'perf') {
    log('■ 데스크톱 1280×720'); const { ctx, p } = await openPage(browser, 'desk', { viewport: { width: 1280, height: 720 } });
    await p.goto(BASE); await p.waitForSelector('#menu.on', { timeout: 90000 }); await p.waitForTimeout(1500);
    report.initialBytes = p.bytes.total; report.initialList = [...p.bytes.list].sort((a, b) => b[1] - a[1]);
    log(`  초기 로딩 다운로드 ${(p.bytes.total / 1024).toFixed(0)} KB (${p.bytes.list.length}개 요청)`);
    await ev(p, () => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on');
    if (MODE !== 'perf') { await menuTour(p, '데스크톱'); await settingsTest(p); }
    await tapOrClick(p, '#mainNav [data-act=new]'); await p.waitForTimeout(800); ok(await ev(p, () => __game.running), '새 게임 시작'); await ev(p, () => __game.ts = 6);
    if (MODE !== 'perf') { await slotsTest(p); await p.screenshot({ path: SHOTS + 'qa_desk_after_slots.png' }); }
    report.perfDesk = await perf(p, '데스크톱 1280×720');
    if (MODE !== 'perf') { await ev(p, () => { __game.ts = 30; __game.ending('perfect'); }); await p.waitForSelector('#ending.on', { timeout: 30000 }); ok(true, '결말 화면 표시'); await tapOrClick(p, '#bEndTitle'); await p.waitForSelector('#menu.on'); ok(await ev(p, () => !document.querySelector('#mContinue').disabled), '메뉴 복귀 + 이어하기 활성'); }
    await checkRej(p); await ctx.close();
  }
  if (MODE === 'all' || MODE === 'ios') {
    log('■ iPhone 14 에뮬레이션 (390×844, DPR 3, 터치)'); const { ctx, p } = await openPage(browser, 'iphone14', IPHONE14);
    await p.goto(BASE); await p.waitForSelector('#menu.on', { timeout: 90000 }); await ev(p, () => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on'); await p.waitForTimeout(1200);
    ok(await ev(p, () => document.body.classList.contains('touch')), '터치 기기 인식'); await p.screenshot({ path: SHOTS + 'qa_iphone_menu.png' });
    await menuTour(p, 'iPhone');
    await p.tap('#mainNav [data-act=new]'); await p.waitForTimeout(1000); ok(await ev(p, () => __game.running), 'iPhone 새 게임');
    ok(await ev(p, () => __game.renderer.getPixelRatio() <= 1.6 + 1e-6), `픽셀 비율 상한 (${await ev(p, () => __game.renderer.getPixelRatio().toFixed(2))})`);
    // 터치 조이스틱으로 실제 이동
    const z0 = await ev(p, () => __game.player.pos.z); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 560 }] });
    for (let i = 0; i < 20; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 560 - Math.min(50, i * 5) }] }); await p.waitForTimeout(60); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(await ev(p, z0 => __game.player.pos.z < z0 - .2, z0), '터치 조이스틱 이동');
    await ev(p, () => __game.ts = 6); await slotsTest(p); await p.screenshot({ path: SHOTS + 'qa_iphone_ingame.png' });
    report.endings = await runEndings(p);
    await p.waitForTimeout(800); await ev(p, () => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); document.body.classList.add('playing'); __game.startRun(); __game.ts = 1; }); await p.waitForTimeout(1500);
    report.perfIphone = await perf(p, 'iPhone 14 에뮬레이션');
    await checkRej(p); await ctx.close();
  }
  await browser.close();
  log('\n■ 결과: ' + results.filter(r => r[1]).length + ' / ' + results.length + ' 통과');
  const uniq = [...new Set(problems)]; log('■ 문제 ' + uniq.length + '건'); for (const x of uniq) log('  - ' + x);
  require('fs').writeFileSync('/tmp/qa_report.json', JSON.stringify({ results, problems: uniq, report }, null, 1));
  process.exit(uniq.length ? 1 : 0);
})();
