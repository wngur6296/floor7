// 내레이션 반응성 측정: 방을 옮긴 순간부터 그 방 대사 자막이 뜰 때까지의 지연(ms) + 몸짓 판정 확인
// node tools/narr_test.cjs (서버 18427 필요)
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('response', r => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 18427) + '/'); await p.waitForSelector('#menu.on'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on');
  await p.click('[data-act=new]'); await p.waitForTimeout(500); await p.evaluate(() => __game.quality('low'));
  const ev = (f, a) => p.evaluate(f, a);
  const sub = () => ev(() => document.querySelector('#sub .txt')?.textContent || '');
  const go = (x, z) => ev(([x, z]) => { __game.player.pos.x = x; __game.player.pos.z = z; }, [x, z]);
  const lat = async (label, x, z, want) => { await go(x, z); const t0 = Date.now(); while (Date.now() - t0 < 6000) { if ((await sub()).includes(want)) { const ms = Date.now() - t0; console.log(label, ms + 'ms'); return ms; } await p.waitForTimeout(25); } console.log(label, 'TIMEOUT, sub=', await sub()); return -1; };
  await p.waitForTimeout(3500); console.log('intro 자막:', await sub());
  const r = {};
  r.office_to_open = await lat('사무실 → 업무실 (인트로 말하는 중)', 2.5, -1.5, '업무실');
  await p.waitForTimeout(1200);
  r.open_to_hall = await lat('업무실 → 네 개의 문 (open_1/2 중)', 2.5, -15.5, '문');
  // 몸짓: 네 개의 문에서 지시가 끝나길 기다렸다가 작은 문을 응시 → ask
  await p.waitForFunction(() => !!__game.beatOn, null, { timeout: 30000 });
  const ask0 = await ev(() => __game.run.stats.ask);
  for (let i = 0; i < 25; i++) { await ev(() => { const g = __game, c = g.camera.position; const dx = 6 - c.x, dy = .6 - c.y, dz = -22 - c.z; g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }); await p.waitForTimeout(100); }
  r.gazeAsk = (await ev(() => __game.run.stats.ask)) > ask0; console.log('작은 문 응시 → 호기심', r.gazeAsk, await sub());
  r.stale = await ev(() => __game.narr.room); console.log('현재 내레이션 방', r.stale);
  console.log(JSON.stringify(r), 'ERRORS', JSON.stringify(errs)); await b.close();
})();
