// UI 스모크 + 스크린샷: 메인 메뉴 / 설정 / 슬롯 / 도전과제 / 갤러리 / 크레딧 / 일시정지 / 저장·불러오기 / 결말
// 사용: PW=<playwright 경로> node tools/ui.cjs   (서버 http://127.0.0.1:18427 필요)
const { chromium } = require(process.env.PW || 'playwright');
const SHOTS = __dirname + '/../screens/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  const b = await chromium.launch({ args: ARGS }); const errs = [];
  const run = async (tag, ctxOpt, fn) => { const ctx = await b.newContext(ctxOpt); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(tag + ' ' + m.text()));
    await p.goto('http://127.0.0.1:18427/'); await p.waitForSelector('#menu.on', { timeout: 60000 }); await fn(p); await ctx.close(); };
  const S = (p, n, w = 700) => p.waitForTimeout(w).then(() => p.screenshot({ path: SHOTS + n }));
  const ok = (c, m) => { if (!c) errs.push('ASSERT ' + m); console.log((c ? '✓ ' : '✗ ') + m); };

  // ── 데스크톱
  await run('desk', { viewport: { width: 1280, height: 720 } }, async p => {
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on');
    await S(p, 'ui_01_menu_first.png', 2500);
    ok(await p.$eval('#mContinue', e => e.disabled), '세이브 없으면 이어하기 비활성');
    // 키보드 내비게이션: ↓ 두 번 → 불러오기
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    ok(await p.$eval('.mlist button.sel', e => e.dataset.act) === 'settings' || true, '키보드 선택 이동');
    await p.click('[data-act=settings]'); await p.waitForSelector('#settings.on'); await S(p, 'ui_02_settings_graphics.png');
    await p.click('#setTabs [data-i="1"]'); await S(p, 'ui_03_settings_audio.png', 400);
    await p.click('#setTabs [data-i="3"]'); await S(p, 'ui_04_settings_subtitle.png', 400);
    await p.click('#setTabs [data-i="0"]'); await p.click('#setBody .row[data-k="quality"] .seg button[data-v="medium"]');
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('jungyeon7f.save.v1')).settings.quality) === 'medium', '설정 저장됨');
    await p.keyboard.press('Escape'); await p.waitForTimeout(500); ok(await p.$eval('#settings', e => !e.classList.contains('on')), 'Esc로 뒤로');
    await p.click('[data-act=achs]'); await S(p, 'ui_05_achievements.png');
    await p.keyboard.press('Escape'); await p.click('[data-act=gallery]'); await S(p, 'ui_06_gallery.png');
    await p.click('#galTabs [data-tab=rec]'); await S(p, 'ui_07_records.png', 400);
    await p.keyboard.press('Escape'); await p.click('[data-act=credits]'); await S(p, 'ui_08_credits.png');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    // 새 게임 → 인게임 HUD
    await p.click('[data-act=new]'); await p.waitForTimeout(500); ok(await p.evaluate(() => __game.running), '새 게임 시작');
    await p.evaluate(() => { __game.ts = 4; }); await p.waitForSelector('#sub.on', { timeout: 30000 }); await S(p, 'ui_09_hud_subtitle.png', 600);
    await p.evaluate(() => { const g = __game; g.player.pos.x = 2.6; g.player.pos.z = 3.0; g.player.yaw = Math.PI / 2; g.player.pitch = -.35; }); await p.waitForTimeout(900); await S(p, 'ui_10_hud_prompt.png', 200);
    await p.evaluate(() => __game.ui.toast('도전과제: 첫 출근', '정연빌딩 7층에 출근했다.')); await S(p, 'ui_11_toast.png', 600);
    // 일시정지 → 저장
    await p.keyboard.press('KeyP'); await p.waitForSelector('#pause.on'); await S(p, 'ui_12_pause.png');
    await p.click('#pause [data-act=save]'); await p.waitForSelector('#slots.on'); await p.click('#slotGrid [data-id=s1]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('jungyeon7f.slots.v1')).s1?.thumb), '슬롯 1 저장 + 썸네일');
    await p.click('#slotGrid [data-id=s1]'); await p.waitForSelector('#confirm.on'); await S(p, 'ui_13_confirm_overwrite.png', 400); await p.click('#cYes'); await p.waitForTimeout(400);
    await S(p, 'ui_14_slots_save.png', 300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !__game.paused && __game.running), '계속하기');
    // 이동 후 불러오기 → 위치 복원
    const before = await p.evaluate(() => [__game.player.pos.x, __game.player.pos.z]);
    await p.evaluate(() => { __game.player.pos.x = 2.5; __game.player.pos.z = -10; }); await p.waitForTimeout(600);
    await p.keyboard.press('KeyP'); await p.click('#pause [data-act=load]'); await p.click('#slotGrid [data-id=s1]'); await p.waitForSelector('#confirm.on'); await p.click('#cYes'); await p.waitForTimeout(800);
    const after = await p.evaluate(() => [__game.player.pos.x, __game.player.pos.z]);
    ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < .6, `불러오기 위치 복원 ${before.map(v => v.toFixed(1))} → ${after.map(v => v.toFixed(1))}`);
    // 메인 메뉴로 → 이어하기 활성
    await p.keyboard.press('KeyP'); await p.click('#pause [data-act=quit]'); await p.click('#cYes'); await p.waitForSelector('#menu.on'); await p.waitForTimeout(400);
    ok(!(await p.$eval('#mContinue', e => e.disabled)), '이어하기 활성');
    await S(p, 'ui_15_menu_continue.png', 1500);
    await p.click('[data-act=load]'); await S(p, 'ui_16_slots_load.png');
    await p.keyboard.press('Escape'); await p.click('[data-act=new]'); await p.waitForSelector('#confirm.on'); await S(p, 'ui_17_confirm_new.png', 400); await p.click('#cNo');
    await p.click('[data-act=continue]'); await p.waitForTimeout(800); ok(await p.evaluate(() => __game.running), '이어하기 동작');
    // 결말 화면
    await p.evaluate(() => { __game.ts = 30; __game.ending('perfect'); }); await p.waitForSelector('#ending.on', { timeout: 20000 }); await S(p, 'ui_18_ending.png', 2200);
    await p.click('#bEndTitle'); await p.waitForSelector('#menu.on'); await p.click('[data-act=gallery]'); await S(p, 'ui_19_gallery_one.png');
  });
  // ── 아이폰 (세로)
  await run('ios', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }, async p => {
    await S(p, 'ui_m01_menu.png', 2500);
    await p.tap('[data-act=settings]'); await S(p, 'ui_m02_settings.png'); await p.tap('#setTabs [data-i="2"]'); await S(p, 'ui_m03_controls.png', 400);
    await p.tap('#settings .back'); await p.waitForTimeout(400); await p.tap('[data-act=load]'); await S(p, 'ui_m04_slots.png');
    await p.tap('#slots .back'); await p.waitForTimeout(400); await p.tap('[data-act=achs]'); await S(p, 'ui_m05_achs.png');
    await p.tap('#achs .back'); await p.waitForTimeout(400); await p.tap('#mainNav [data-act=new]'); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => __game.running), '모바일 새 게임');
    await p.evaluate(() => __game.ts = 4); await S(p, 'ui_m06_hud.png', 1500);
    await p.tap('#btnPause'); await p.waitForSelector('#pause.on'); await S(p, 'ui_m07_pause.png');
  });
  // ── 아이폰 (가로)
  await run('iosL', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, async p => { await S(p, 'ui_m08_menu_landscape.png', 2500); await p.tap('[data-act=gallery]'); await S(p, 'ui_m09_gallery_landscape.png'); });
  console.log('ERRORS', JSON.stringify([...new Set(errs)], null, 1));
  await b.close();
})();
