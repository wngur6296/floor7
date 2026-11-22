// 소품 배치 점검: 책상 위 명패·모니터, 서랍 속 물건, 바닥 잠김, 방 스크린샷
// 사용: PW=<playwright> node tools/audit_props.cjs   (서버 http://127.0.0.1:18427 필요)
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'screens', 'audit');
fs.mkdirSync(OUT, { recursive: true });

const ROOMS = [
  { id: 'office', from: [2.2, 1.62, 4.2], look: [.9, .9, 2.5] },
  { id: 'openoffice', from: [2.5, 1.62, -3], look: [7.7, .9, -6.5] },
  { id: 'openoffice_0426', from: [-1.0, 1.55, -8.4], look: [-2.8, .85, -9.6] },
  { id: 'breakroom', from: [14.5, 1.62, -4.2], look: [15.5, .9, -3.6] },
  { id: 'boss', from: [-8.2, 1.62, -10.2], look: [-10.3, .85, -11] },
  { id: 'devroom', from: [-8.5, 1.62, -3.2], look: [-10.5, .8, -4.5] },
  { id: 'hall', from: [2.5, 1.62, -16], look: [2.5, 1.2, -20] },
  { id: 'meeting', from: [-16, 1.62, -18], look: [-17.6, .85, -18] },
  { id: 'longcorr', from: [-18, 1.62, -34], look: [-19, 1.4, -43] },
  { id: 'archive', from: [-13, 1.62, -34], look: [-9.8, .85, -34] },
  { id: 'control', from: [-18, 1.62, -49], look: [-18, 1.2, -53] },
  { id: 'mirror', from: [5.5, 1.62, -36.5], look: [7.5, .85, -36.5] },
  { id: 'off0426', from: [-19.4, 1.62, -43], look: [-20.3, .85, -43] },
  { id: 'storage', from: [26, 1.62, -33], look: [25, 1.0, -34] },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('page ' + e.message));
  p.on('console', m => m.type() === 'error' && errs.push('console ' + m.text()));
  p.on('response', r => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.goto('http://127.0.0.1:18427/'); await p.waitForSelector('#menu.on', { timeout: 60000 });
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#menu.on');
  await p.click('[data-act=new]'); await p.waitForTimeout(800);
  await p.evaluate(() => { __game.ts = 40; __game.quality('high'); __game.hushNarr(); });

  const ev = (f, a) => p.evaluate(f, a);
  const look = async (from, at) => {
    await ev(([fx, fy, fz, tx, ty, tz]) => {
      const g = __game, pl = g.player;
      pl.pos.x = fx; pl.pos.z = fz; pl.eye = pl.eyeT = fy;
      const dx = tx - fx, dy = ty - fy, dz = tz - fz;
      pl.yaw = Math.atan2(-dx, -dz); pl.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.camera.position.set(fx, fy, fz);
      g.camera.lookAt(tx, ty, tz);
    }, [...from, ...at]);
    await p.waitForTimeout(120);
  };

  const issues = [];
  const report = await ev(() => {
    const THREE = window.THREE || (window.__THREE) || null;
    const g = __game, w = g.world, out = { desks: [], insides: [], floats: [], clips: [], props: [] };
    const boxOf = (obj) => { obj.updateMatrixWorld(true); const b = new (g.camera.constructor === g.camera.constructor ? Object.getPrototypeOf(g.camera).constructor : Function)(); };
    // Use world's Box3 via a dummy in the scene graph
    const Box3 = g.scene.userData.Box3 || null;
    const mkBox = (obj) => {
      obj.updateWorldMatrix(true, true);
      const bb = { min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 } };
      obj.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const b = c.geometry.boundingBox; if (!b) return;
        const v = [b.min, b.max];
        // 8 corners
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const p = c.localToWorld({ x, y, z, isVector3: true });
          // localToWorld mutates Vector3; we need a real one
        }
      });
      return bb;
    };
    // Real Box3 from three module is on mesh
    const corners = (obj) => {
      obj.updateWorldMatrix(true, true);
      let minx=1e9,miny=1e9,minz=1e9,maxx=-1e9,maxy=-1e9,maxz=-1e9, n=0;
      obj.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const b = c.geometry.boundingBox; if (!b) return;
        const tmp = { x:0,y:0,z:0 };
        const set = (x,y,z) => { tmp.x=x; tmp.y=y; tmp.z=z; c.localToWorld(tmp); minx=Math.min(minx,tmp.x); miny=Math.min(miny,tmp.y); minz=Math.min(minz,tmp.z); maxx=Math.max(maxx,tmp.x); maxy=Math.max(maxy,tmp.y); maxz=Math.max(maxz,tmp.z); n++; };
        // localToWorld expects Vector3. Use the object's world matrix manually.
      });
      return n ? { minx, miny, minz, maxx, maxy, maxz } : null;
    };
    // Proper AABB via Mesh.geometry and matrixWorld
    const aabb = (obj) => {
      const vs = [];
      obj.updateWorldMatrix(true, true);
      obj.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        const pos = c.geometry.attributes.position; if (!pos) return;
        const e = c.matrixWorld.elements;
        const apply = (x,y,z) => ({ x: e[0]*x+e[4]*y+e[8]*z+e[12], y: e[1]*x+e[5]*y+e[9]*z+e[13], z: e[2]*x+e[6]*y+e[10]*z+e[14] });
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const b = c.geometry.boundingBox;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) vs.push(apply(x,y,z));
      });
      if (!vs.length) return null;
      const minx=Math.min(...vs.map(v=>v.x)), miny=Math.min(...vs.map(v=>v.y)), minz=Math.min(...vs.map(v=>v.z));
      const maxx=Math.max(...vs.map(v=>v.x)), maxy=Math.max(...vs.map(v=>v.y)), maxz=Math.max(...vs.map(v=>v.z));
      return { minx, miny, minz, maxx, maxy, maxz, cx:(minx+maxx)/2, cy:(miny+maxy)/2, cz:(minz+maxz)/2 };
    };
    const desks = [], surfaces = [], insides = [], issues = [];
    for (const rec of w.dynamicProps) {
      const def = rec.def, box = aabb(rec.obj);
      if (!box) continue;
      if (def.m === 'desk' || def.m === 'table') {
        surfaces.push({ id: def.id || def.m, m: def.m, box, top: box.maxy });
        if (def.m === 'desk' && rec.drawer) {
          rec.obj.updateWorldMatrix(true, true);
          const db = aabb(rec.drawer);
          desks.push({ id: def.id, box, drawer: db, open: !!rec.drawerOpen });
        }
      }
    }
    // also include static desks? they're merged. Use collision boxes + assumed top 0.76
    for (const rec of w.dynamicProps) {
      const def = rec.def, box = aabb(rec.obj); if (!box) continue;
      const label = def.id || (def.m + '@' + (def.p||[]).map(n=>n.toFixed?.(2)||n).join(','));
      // floor sink / float for free-standing (no y or y===0, not wall-mounted)
      const wallish = /poster|sign|calendar|clock|mirror|keypad|cardreader|lightswitch|whiteboard|projscreen|blinds|screenwall|facade/.test(def.m);
      if (!wallish && !def.inside && def.y == null && box.miny < -0.03) issues.push({ kind: 'sink', id: label, miny: +box.miny.toFixed(3) });
      if (!wallish && !def.inside && def.y == null && box.miny > 0.12 && def.m !== 'placeholder') issues.push({ kind: 'float', id: label, miny: +box.miny.toFixed(3) });
      // desk-surface items
      if (def.y === .76 || def.m === 'nameplate') {
        const on = surfaces.some(s => box.cx > s.box.minx - .02 && box.cx < s.box.maxx + .02 && box.cz > s.box.minz - .02 && box.cz < s.box.maxz + .02 && Math.abs(box.miny - s.top) < .06);
        // static desks aren't in surfaces; fall back to collision boxes at y=0.76
        const onCol = w.boxes.some(b => box.cx > b.x0 - .02 && box.cx < b.x1 + .02 && box.cz > b.z0 - .02 && box.cz < b.z1 + .02);
        if (!on && !onCol) issues.push({ kind: 'off-surface', id: label, box });
        else if (on) { /* good */ }
        // even if onCol, check vertical gap vs 0.76
        if (Math.abs(box.miny - 0.76) > .08 && def.m === 'nameplate') issues.push({ kind: 'nameplate-height', id: label, miny: +box.miny.toFixed(3), maxy: +box.maxy.toFixed(3) });
        // xz must be inside some collision box (desk/table)
        if (!onCol && !on) issues.push({ kind: 'nameplate-off-desk', id: label, cx: +box.cx.toFixed(3), cz: +box.cz.toFixed(3) });
      }
      if (def.inside) {
        const host = desks.find(d => d.id === def.inside) || { id: def.inside, drawer: null };
        insides.push({ id: def.id, inside: def.inside, box, drawer: host.drawer, visible: rec.obj.visible });
      }
    }
    return { issues, insides: insides.map(x => ({ id: x.id, inside: x.inside, visible: x.visible, box: x.box && { ...x.box, minx:+x.box.minx.toFixed(3), maxx:+x.box.maxx.toFixed(3), miny:+x.box.miny.toFixed(3), maxy:+x.box.maxy.toFixed(3), minz:+x.box.minz.toFixed(3), maxz:+x.box.maxz.toFixed(3) }, drawer: x.drawer && { minx:+x.drawer.minx.toFixed(3), maxx:+x.drawer.maxx.toFixed(3), miny:+x.drawer.miny.toFixed(3), maxy:+x.drawer.maxy.toFixed(3), minz:+x.drawer.minz.toFixed(3), maxz:+x.drawer.maxz.toFixed(3) } })), desks };
  });

  // desk close-up: 0427 nameplate
  await look([1.7, 1.35, 2.5], [1.05, 0.82, 2.95]);
  await p.screenshot({ path: path.join(OUT, 'desk_nameplate_0427.png') });

  // open drawer and photo contents
  await ev(() => {
    const rec = __game.world.props.get('deskMine');
    rec.drawerOpen = true; __game.run.drawers.deskMine = true; __game.world.refresh();
  });
  await p.waitForTimeout(700);
  await look([1.85, 1.15, 2.15], [1.15, 0.55, 2.15]);
  await p.screenshot({ path: path.join(OUT, 'drawer_open_0427.png') });

  const contained = await ev(() => {
    const rec = __game.world.props.get('deskMine');
    const memo = __game.world.props.get('memoDrawer');
    const duck = __game.world.props.get('duck1');
    const aabb = (obj) => {
      const vs = []; obj.updateWorldMatrix(true, true);
      obj.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const b = c.geometry.boundingBox, e = c.matrixWorld.elements;
        const apply = (x,y,z) => ({ x: e[0]*x+e[4]*y+e[8]*z+e[12], y: e[1]*x+e[5]*y+e[9]*z+e[13], z: e[2]*x+e[6]*y+e[10]*z+e[14] });
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) vs.push(apply(x,y,z));
      });
      const minx=Math.min(...vs.map(v=>v.x)), miny=Math.min(...vs.map(v=>v.y)), minz=Math.min(...vs.map(v=>v.z));
      const maxx=Math.max(...vs.map(v=>v.x)), maxy=Math.max(...vs.map(v=>v.y)), maxz=Math.max(...vs.map(v=>v.z));
      return { minx, miny, minz, maxx, maxy, maxz };
    };
    const d = aabb(rec.drawer), m = aabb(memo.obj), k = aabb(duck.obj);
    const inside = (a, b, pad=.02) => a.minx >= b.minx-pad && a.maxx <= b.maxx+pad && a.miny >= b.miny-pad && a.maxy <= b.maxy+pad && a.minz >= b.minz-pad && a.maxz <= b.maxz+pad;
    return { drawer: d, memo: m, duck: k, memoIn: inside(m, d), duckIn: inside(k, d), memoVis: memo.obj.visible, duckVis: duck.obj.visible };
  });

  // boss drawer too
  await ev(() => { const rec = __game.world.props.get('deskBoss'); rec.drawerOpen = true; __game.run.drawers.deskBoss = true; __game.world.refresh(); });
  await p.waitForTimeout(700);
  await look([-9.4, 1.15, -11.5], [-9.95, 0.55, -11.45]);
  await p.screenshot({ path: path.join(OUT, 'drawer_open_boss.png') });
  const bossIn = await ev(() => {
    const rec = __game.world.props.get('deskBoss');
    const memo = __game.world.props.get('memoBoss');
    const key = __game.world.props.get('keycard');
    const aabb = (obj) => {
      const vs = []; obj.updateWorldMatrix(true, true);
      obj.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const b = c.geometry.boundingBox, e = c.matrixWorld.elements;
        const apply = (x,y,z) => ({ x: e[0]*x+e[4]*y+e[8]*z+e[12], y: e[1]*x+e[5]*y+e[9]*z+e[13], z: e[2]*x+e[6]*y+e[10]*z+e[14] });
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) vs.push(apply(x,y,z));
      });
      const minx=Math.min(...vs.map(v=>v.x)), miny=Math.min(...vs.map(v=>v.y)), minz=Math.min(...vs.map(v=>v.z));
      const maxx=Math.max(...vs.map(v=>v.x)), maxy=Math.max(...vs.map(v=>v.y)), maxz=Math.max(...vs.map(v=>v.z));
      return { minx, miny, minz, maxx, maxy, maxz };
    };
    const d = aabb(rec.drawer), m = aabb(memo.obj), k = aabb(key.obj);
    const inside = (a, b, pad=.02) => a.minx >= b.minx-pad && a.maxx <= b.maxx+pad && a.miny >= b.miny-pad && a.maxy <= b.maxy+pad && a.minz >= b.minz-pad && a.maxz <= b.maxz+pad;
    return { memoIn: inside(m, d), keyIn: inside(k, d), memoVis: memo.obj.visible, keyVis: key.obj.visible, d, m, k };
  });

  // 0426 / 0425 / meeting / mirror nameplate close-ups
  await look([8.3, 1.3, -5.7], [8.15, 0.82, -6.22]);
  await p.screenshot({ path: path.join(OUT, 'nameplate_0425.png') });
  await look([-1.3, 1.3, -8.7], [-2.35, 0.82, -9.32]);
  await p.screenshot({ path: path.join(OUT, 'nameplate_0426.png') });
  await look([6.7, 1.3, -36.5], [7.42, 0.82, -37.0]);
  await p.screenshot({ path: path.join(OUT, 'nameplate_mirror.png') });
  await look([-18.1, 1.35, -16.5], [-18.1, 0.82, -17.4]);
  await p.screenshot({ path: path.join(OUT, 'nameplate_meeting.png') });

  // room eye-height shots
  for (const r of ROOMS) {
    await look(r.from, r.look);
    await p.screenshot({ path: path.join(OUT, 'room_' + r.id + '.png') });
  }

  // unlock + photo 0426 office
  await ev(() => { const d = __game.world.doors.get('d_c0426'); d.locked = false; __game.world.setDoor('d_c0426', true); });
  await p.waitForTimeout(800);
  await look([-18.4, 1.62, -43], [-20.3, 1.0, -43]);
  await p.screenshot({ path: path.join(OUT, 'room_off0426_from_hall.png') });

  const extraIssues = [];
  if (!contained.memoIn) extraIssues.push({ kind: 'drawer-clip', id: 'memoDrawer', detail: contained });
  if (!contained.duckIn) extraIssues.push({ kind: 'drawer-clip', id: 'duck1', detail: contained });
  if (!contained.memoVis || !contained.duckVis) extraIssues.push({ kind: 'drawer-hidden', detail: contained });
  if (!bossIn.memoIn) extraIssues.push({ kind: 'drawer-clip', id: 'memoBoss', detail: bossIn });
  if (!bossIn.keyIn) extraIssues.push({ kind: 'drawer-clip', id: 'keycard', detail: bossIn });

  const all = [...(report.issues || []), ...extraIssues];
  const result = { issues: all, contained, bossIn, errs, desks: report.desks };
  fs.writeFileSync('/tmp/prop_audit.json', JSON.stringify(result, null, 2));
  console.log('ISSUES', JSON.stringify(all, null, 2));
  console.log('DRAWER 0427', JSON.stringify(contained));
  console.log('DRAWER BOSS', JSON.stringify(bossIn));
  console.log('ERRORS', JSON.stringify(errs));
  console.log('shots', fs.readdirSync(OUT).length);
  await b.close();
  if (all.length) process.exitCode = 2;
})();
