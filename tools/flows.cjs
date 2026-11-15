// 결말 12개 자동 검증: node tools/flows.cjs (서버 18427 필요)
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:18427/'); await p.waitForSelector('#menu.on'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on');
  await p.click('[data-act=new]'); await p.waitForTimeout(500);
  await p.evaluate(() => { __game.ts = 30; __game.quality('low'); });
  const ev = (f, a) => p.evaluate(f, a);
  const go = async (x, z, ms = 400) => { await ev(([x, z]) => { const g = __game; g.player.pos.x = x; g.player.pos.z = z; }, [x, z]); await p.waitForTimeout(ms); };
  const use = async (id, ms = 300) => { await ev(id => __game.use({ prop: id }), id); await p.waitForTimeout(ms); };
  const until = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn)) return true; await p.waitForTimeout(250); } return false; };
  const ended = id => until(new Function(`return !!(__game.save.endings['${id}'] && !__game.running)`), 90000);
  const fresh = async () => { await p.waitForTimeout(700); await ev(() => { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); document.body.classList.add('playing'); __game.startRun(); __game.ts = 30; }); await p.waitForTimeout(300); };
  const left = async () => { await go(2.5, 3.7); await until(() => __game.run.flags.instructed, 60000); };
  const toControl = async () => { await go(2.5, -1.5, 800); await go(2.5, -16, 800); await go(-6, -18, 600); await go(-16, -18, 800); await go(-18, -26, 600); await go(-18, -48, 600); };
  const res = {};
  const T = async (name, fn) => { if (process.env.ONLY && process.env.ONLY !== name) return; try { await fresh(); await fn(); res[name] = await ended(name); } catch (e) { res[name] = 'ERR ' + e.message; } console.log(name, res[name]); };

  await T('idle', async () => { await ev(() => __game.input.lastInput = performance.now() - 301000); });
  await T('perfect', async () => { await left(); await toControl(); await until(() => __game.run.flags.ctrlReady); await use('btnApprove'); });
  await T('silence', async () => { await toControl(); await p.waitForTimeout(1000); await use('btnStop'); });
  await T('loop', async () => { await go(2.5, -1.5); await go(2.5, -16); await go(8, -19); await go(10, -22); await go(13, -25); await go(16, -28); await go(19, -31); await go(22, -34); for (let i = 0; i < 8; i++) { await go(25.5, -37, 300); await go(27.8, -37, 500); } });
  await T('outside', async () => { await go(2.5, -1.5); await go(2.5, -16); await go(8, -19); await go(10, -22); await go(16, -28); await go(22, -34); for (let i = 0; i < 2; i++) { await go(25.5, -37, 300); await go(27.8, -37, 400); }
    await ev(() => __game.G.item('keycard', true)); await go(22.3, -33, 400); await ev(() => __game.world.setDoor('d_storage', true)); await p.waitForTimeout(300); await go(26, -33, 500);
    await ev(() => __game.useDoor(__game.world.doors.get('d_exit'))); await p.waitForTimeout(500); await go(31, -33, 500);
    for (let i = 0; i < 9; i++) { await ev(() => __game.useDoor(__game.world.doors.get('d_stair'))); await until(() => !__game.run.flags.stairBusy, 20000); await p.waitForTimeout(200); }
    await p.waitForTimeout(800); console.log(' room', await ev(() => __game.room?.id)); await go(120, -8, 1500); await go(120, -25, 500); });
  await T('sit', async () => { await left(); await go(2.5, -1.5, 600); await go(2.5, 3.7, 600); await use('chairMine2'); });
  await T('mirror', async () => { await go(2.5, -1.5); await go(2.5, -16); await go(6, -28, 600); await go(6, -36.5, 800); await use('chairMirror'); });
  await T('basement', async () => { await go(2.5, -1.5); await go(2.5, -16); await go(2.5, -24); await go(2.5, -27); await use('elevPanel'); for (let i = 0; i < 3; i++) { await p.click('#modal .ebtns button[data-b="0"]'); await p.waitForTimeout(1200); } });
  await T('hold', async () => { await use('phoneMine'); });
  await T('0426', async () => { await ev(() => __game.run.stats.ask = 4); await toControl(); await until(() => __game.room?.id === 'control' && __game.narr.busy === false && !!document.querySelector('#choices.on .ch-ask')); await ev(() => document.querySelector('#choices .ch-ask').click()); });
  await T('archive', async () => { await go(2.5, -1.5); await go(2.5, -16); await go(-6, -18); await go(-16, -18); await go(-17.6, -35); await use('keypad'); for (const k of ['2', '7', '4', '1', 'OK']) await p.click(`#modal .keys button[data-k="${k}"]`); await p.waitForTimeout(1500); await go(-13, -34, 800); await use('archiveTerm'); });
  await T('meta', async () => { console.log(' metaShown', await ev(() => __game.world.doors.get('d_meta').shown)); await ev(() => __game.world.setDoor('d_meta', true)); await p.waitForTimeout(300); await go(7, 2.5, 800); await go(11.6, 2.5, 500); });
  const s = await ev(() => ({ endings: __game.save.endings, ach: Object.keys(__game.save.ach), runs: __game.save.runs }));
  console.log(JSON.stringify(s)); console.log('ERRORS', JSON.stringify(errs.slice(0, 20)));
  await b.close();
})();
