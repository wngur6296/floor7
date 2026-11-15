// 헤드리스 스모크 테스트: node tools/smoke.cjs  (playwright 필요, 서버: python3 -m http.server 18427)
const { chromium, devices } = require(process.env.PW || 'playwright');
const SHOTS = __dirname + '/../screens/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:18427/'); await p.waitForSelector('#menu.on', { timeout: 30000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: SHOTS + '01_title.png' });
  await p.tap('#mainNav [data-act=new]'); await p.waitForTimeout(3500);
  await p.screenshot({ path: SHOTS + '02_office.png' });
  const shot = async (name, x, z, yaw, pitch = 0, wait = 1200) => { await p.evaluate(([x, z, yaw, pitch]) => { const g = __game; g.player.pos.x = x; g.player.pos.z = z; g.player.yaw = yaw; g.player.pitch = pitch; }, [x, z, yaw, pitch]); await p.waitForTimeout(wait); await p.screenshot({ path: SHOTS + name }); };
  await shot('03_office_desk.png', 2.6, 3.0, Math.PI / 2 * 1, -.25);
  await shot('04_openoffice.png', 2.5, -0.8, 0, -.05);
  await shot('05_hall.png', 2.5, -15.2, 0, .05);
  await shot('06_meeting.png', -15, -18, Math.PI / 2, -.1);
  await shot('07_loop.png', 10, -19.5, 0, 0);
  await shot('08_control.png', -18, -48, 0, .1);
  await shot('09_breakroom.png', 12, -2, Math.PI / 4 * -1 + Math.PI * 0, 0);
  await shot('10_outside.png', 120, 2, 0, 0);
  await shot('11_mirror.png', 6, -34.6, 0, -.1);
  await shot('12_devroom.png', -6.5, -2, Math.PI / 2 * 1, 0);
  const info = await p.evaluate(() => ({ calls: __game.renderer.info.render.calls, tris: __game.renderer.info.render.triangles, room: __game.room?.id, sub: document.querySelector('#sub .txt').textContent, fps: __game.fpsAcc.lvl }));
  console.log(JSON.stringify(info));
  console.log('ERRORS', errs.length, JSON.stringify([...new Set(errs)].slice(0, 25), null, 1));
  await b.close();
})();
