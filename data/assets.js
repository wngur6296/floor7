// ─────────────────────────────────────────────────────────────
// 에셋 매니페스트 — 그래픽/사운드 교체는 이 파일만 고치면 된다. (README.md "에셋 교체" 참고)
// TEXTURES: id → { url?: 'assets/img/x.jpg', proc?: 'carpet' }  url 이 있으면 url 우선, 실패 시 proc.
// MATERIALS: id → { tex?, color?, tile?(미터당 반복, 벽·바닥용), emissive?, opacity?, side? }
// MODELS: id → { glb?: 'assets/models/x.glb', scale?, rotY?(도), y? }  glb 없거나 로드 실패 → js/engine/props.js 의 같은 이름 프리미티브.
// SOUNDS: id → { url, loop?, vol? }   VOICE: 대사 음성 폴더 (data/lines.js 의 id.mp3)
// ─────────────────────────────────────────────────────────────
export const TEXTURES = {
  carpet: { proc: 'carpet' },          // 예: { url: 'assets/img/carpet.jpg', proc: 'carpet' }
  carpetRed: { proc: 'carpetRed' },
  ceiling: { proc: 'ceiling' },
  wallpaper: { proc: 'wallpaper' },
  wallpaperOff: { proc: 'wallpaperOff' },
  wallWhite: { proc: 'wallWhite' },
  concrete: { proc: 'concrete' },
  tile: { proc: 'tile' },
  wood: { proc: 'wood' },
  laminate: { proc: 'laminate' },
  door: { proc: 'door' },
  metal: { proc: 'metal' },
  grey: { proc: 'grey' },
  asphalt: { proc: 'asphalt' },
  fabric: { proc: 'fabric' },
  lightpanel: { proc: 'lightpanel' },
};
export const MATERIALS = {
  // 표면 (tile = 텍스처 한 장이 덮는 미터)
  carpet: { tex: 'carpet', tile: 2 },
  carpetRed: { tex: 'carpetRed', tile: 2 },
  ceiling: { tex: 'ceiling', tile: 1.2 },
  wall: { tex: 'wallpaper', tile: 2 },
  wallOff: { tex: 'wallpaperOff', tile: 2.07 },   // 비밀 벽: 무늬가 아주 미세하게 어긋남
  wallWhite: { tex: 'wallWhite', tile: 3 },
  concrete: { tex: 'concrete', tile: 3 },
  tile: { tex: 'tile', tile: 1.2 },
  greyFloor: { tex: 'grey', tile: 2 },
  asphalt: { tex: 'asphalt', tile: 6 },
  door: { tex: 'door' },
  doorMetal: { tex: 'metal', color: 0x8e9aa0 },
  frame: { color: 0x6b6a62 },
  lightpanel: { tex: 'lightpanel', emissive: 0xfffff4 },
  // 소품
  deskTop: { tex: 'laminate', color: 0xe0d8c8 }, deskLeg: { color: 0x8a8678 }, chrome: { color: 0xb8bcc0 }, dark: { color: 0x2c2e31 },
  fabric: { tex: 'fabric' }, fabricR: { tex: 'fabric', color: 0xb07070 }, cabinet: { tex: 'metal', color: 0xb8b9b2 }, pot: { color: 0x9a6a4a }, leaf: { color: 0x4f7a45 },
  plasticW: { color: 0xe4e2dc }, plasticG: { color: 0x9a9c98 }, vend: { color: 0xb43838 }, water: { color: 0x7fb4e0, opacity: .6 }, wood: { tex: 'wood' },
  arcade: { color: 0x2a1a3e }, laminate: { tex: 'laminate' }, metal: { tex: 'metal' }, cardboard: { color: 0xb08a5a }, red: { color: 0xc82020, emissive: 0x400000 },
  green: { color: 0x22a050, emissive: 0x003a10 }, duck: { color: 0xffd02a, emissive: 0x2a2000 }, beak: { color: 0xff7a1a }, card: { color: 0xf2f2f2, emissive: 0x202020 },
  paper: { color: 0xf6f4ec, emissive: 0x111111 }, mirrorFake: { color: 0x9aa4a8 }, grey: { tex: 'grey' }, carBody: { color: 0x6f7378 }, glass: { color: 0x202a30 },
  glassDark: { color: 0x2a3238 }, facade: { tex: 'concrete', color: 0xdedcd4 }, folder: { color: 0xc8a050 }, cat: { color: 0x2a2a2a },
};
export const MODELS = {
  // 예: desk: { glb: 'assets/models/desk.glb', scale: 1, rotY: 0 },
  desk: {}, chair: {}, monitor: {}, keyboard: {}, phone: {}, partition: {}, cabinet: {}, plant: {}, copier: {}, vending: {}, fridge: {}, cooler: {},
  radio: {}, arcade: {}, table: {}, shelf: {}, box: {}, keypad: {}, cardreader: {}, elevpanel: {}, console: {}, bigbutton: {}, screenwall: {}, mug: {},
  duck: {}, keycard: {}, can: {}, photo: {}, clock: {}, poster: {}, sign: {}, nameplate: {}, calendar: {}, paper: {}, mirror: {}, lightswitch: {},
  sofa: {}, trash: {}, whiteboard: {}, projscreen: {}, cat: {}, placeholder: {}, car: {}, facade: {}, bench: {}, filefolder: {}, blinds: {},
};
// 모델 중 글자/화면이 필요한 것은 GLB 로 바꿔도 화면(screen)·글자(label) 부분은 프리미티브를 유지하려면 keepPrimitive: true

export const SOUNDS = {
  amb_hum: { url: 'assets/audio/amb_hum.mp3', loop: true, vol: .35 },
  amb_drone: { url: 'assets/audio/amb_drone.mp3', loop: true, vol: .5 },
  amb_server: { url: 'assets/audio/amb_server.mp3', loop: true, vol: .4 },
  amb_outside: { url: 'assets/audio/amb_outside.mp3', loop: true, vol: .5 },
  title_pad: { url: 'assets/audio/title_pad.mp3', loop: true, vol: .5 },
  hold_music: { url: 'assets/audio/hold_music.mp3', loop: true, vol: .6 },
  radio_song: { url: 'assets/audio/radio_song.mp3', loop: true, vol: .6 },
  radio_static: { url: 'assets/audio/radio_static.mp3', loop: true, vol: .35 },
  elev_motor: { url: 'assets/audio/elev_motor.mp3', loop: true, vol: .5 },
  step_0: { url: 'assets/audio/step_0.mp3', vol: .32 }, step_1: { url: 'assets/audio/step_1.mp3', vol: .32 },
  step_2: { url: 'assets/audio/step_2.mp3', vol: .32 }, step_3: { url: 'assets/audio/step_3.mp3', vol: .32 },
  door_open: { url: 'assets/audio/door_open.mp3', vol: .6 }, door_close: { url: 'assets/audio/door_close.mp3', vol: .6 },
  door_locked: { url: 'assets/audio/door_locked.mp3', vol: .6 }, drawer: { url: 'assets/audio/drawer.mp3', vol: .6 },
  click: { url: 'assets/audio/click.mp3', vol: .5 }, beep: { url: 'assets/audio/beep.mp3', vol: .5 }, error: { url: 'assets/audio/error.mp3', vol: .5 },
  ding: { url: 'assets/audio/ding.mp3', vol: .6 }, phone_ring: { url: 'assets/audio/phone_ring.mp3', vol: .6 }, phone_pick: { url: 'assets/audio/phone_pick.mp3', vol: .6 },
  copier: { url: 'assets/audio/copier.mp3', vol: .6 }, vending: { url: 'assets/audio/vending.mp3', vol: .7 }, pickup: { url: 'assets/audio/pickup.mp3', vol: .6 },
  switch: { url: 'assets/audio/switch.mp3', vol: .6 }, achieve: { url: 'assets/audio/achieve.mp3', vol: .6 }, ending: { url: 'assets/audio/ending.mp3', vol: .8 },
  whoosh: { url: 'assets/audio/whoosh.mp3', vol: .5 }, crawl: { url: 'assets/audio/crawl.mp3', vol: .5 }, tick: { url: 'assets/audio/tick.mp3', vol: .4 },
  water: { url: 'assets/audio/water.mp3', vol: .6 }, power_off: { url: 'assets/audio/power_off.mp3', vol: .8 },
};
export const VOICE = { dir: 'assets/voice/', ext: '.mp3' };
export const IMAGES = { title: 'assets/img/title.webp', icon: 'assets/img/icon-512.png' };
