// WebAudio 사운드 엔진: 효과음, 환경음 채널(크로스페이드), 내레이션(잔향·덕킹·역재생).
import { SOUNDS, VOICE } from '../../data/assets.js';

export class Audio {
  constructor() { this.ctx = null; this.buf = new Map(); this.loading = new Map(); this.ch = {}; this.loops = {}; this.vol = { master: 1, sfx: 1, voice: 1, music: 1 }; }
  async unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {}); return; }
    const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
    const c = this.ctx; this.master = c.createGain(); this.master.connect(c.destination);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    this.ambG = c.createGain(); this.ambG.connect(this.master); this.duck = c.createGain(); this.duck.connect(this.ambG);
    this.voiceG = c.createGain(); this.voiceG.connect(this.master);
    // 내레이터: 아주 짧은 '사내 방송' 잔향 + 약한 대역 제한
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    const conv = c.createConvolver(); conv.buffer = this.impulse(1.3, 3.2); const wet = c.createGain(); wet.gain.value = .16;
    this.voiceIn = c.createGain(); this.voiceIn.connect(hp); hp.connect(this.voiceG); hp.connect(conv); conv.connect(wet); wet.connect(this.voiceG);
    this.phoneIn = c.createGain(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .8; this.phoneIn.connect(bp); bp.connect(this.voiceG);
    try { this.loops = await (await fetch('assets/audio/loops.json')).json(); } catch { this.loops = {}; }
    // iOS: 무음 버퍼 한 번 재생해 잠금 해제
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
    this.applyVol();
  }
  impulse(dur, decay) { const c = this.ctx, n = c.sampleRate * dur, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  applyVol() { if (!this.ctx) return; const v = this.vol; this.master.gain.value = v.master; this.sfxG.gain.value = v.sfx; this.voiceG.gain.value = v.voice; this.ambG.gain.value = v.music; }
  async load(url) {
    if (this.buf.has(url)) return this.buf.get(url); if (this.loading.has(url)) return this.loading.get(url);
    const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(a => new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej))).then(b => { this.buf.set(url, b); return b; }).catch(() => { this.buf.set(url, null); return null; }).finally(() => this.loading.delete(url));
    this.loading.set(url, p); return p;
  }
  // 대사 음성은 필요할 때만 받고(지연 로딩), 디코딩된 버퍼는 최근 24개만 메모리에 유지 (LRU)
  prefetchVoice(id) { if (this.ctx) this.load(VOICE.dir + id + VOICE.ext).then(() => this.touchVoice(VOICE.dir + id + VOICE.ext)); }
  touchVoice(url) { const o = this.vOrder ||= []; const i = o.indexOf(url); if (i >= 0) o.splice(i, 1); o.push(url);
    while (o.length > 24) { const old = o.shift(); if (this.buf.get(old)) this.buf.delete(old); } }
  preload(ids) { if (!this.ctx) return; for (const id of ids) if (SOUNDS[id]) this.load(SOUNDS[id].url); }
  async sfx(id, o = {}) {
    if (!this.ctx) return; const d = SOUNDS[id]; if (!d) return; const b = await this.load(d.url); if (!b) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1;
    const g = this.ctx.createGain(); g.gain.value = (d.vol ?? 1) * (o.vol ?? 1); s.connect(g); g.connect(o.dest || this.sfxG); s.start(); return s;
  }
  // 채널 루프: 채널마다 하나의 루프. id=null 이면 정지.
  async loop(chan, id, o = {}) {
    if (!this.ctx) return; const cur = this.ch[chan]; const fade = o.fade ?? 1.5; const t = this.ctx.currentTime;
    if (cur && cur.id === id) { if (o.vol != null) cur.g.gain.setTargetAtTime((SOUNDS[id]?.vol ?? 1) * o.vol, t, .3); return; }
    if (cur) { cur.g.gain.cancelScheduledValues(t); cur.g.gain.setTargetAtTime(0, t, fade / 4); const s = cur.s; setTimeout(() => { try { s?.stop(); } catch { } }, fade * 1500); }
    this.ch[chan] = null; if (!id) return;
    const d = SOUNDS[id]; const rec = { id, g: this.ctx.createGain(), s: null }; this.ch[chan] = rec;
    rec.g.gain.value = 0; rec.g.connect(o.dest || (chan === 'amb' || chan === 'amb2' ? this.duck : this.sfxG));
    const b = await this.load(d.url); if (!b || this.ch[chan] !== rec) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const name = d.url.split('/').pop().replace('.mp3', ''); const L = this.loops[name];
    if (L) { s.loopStart = .2; s.loopEnd = .2 + L; } s.connect(rec.g); s.start(0, L ? .2 : 0); rec.s = s;
    rec.g.gain.setTargetAtTime((d.vol ?? 1) * (o.vol ?? 1), this.ctx.currentTime, fade / 4);
  }
  chanVol(chan, v, tc = .3) { const c = this.ch[chan]; if (c && this.ctx) c.g.gain.setTargetAtTime((SOUNDS[c.id]?.vol ?? 1) * v, this.ctx.currentTime, tc); }
  // 환경음 갑자기 끊기 (침묵 연출)
  silence(sec = 3, depth = 0) { if (!this.ctx) return; const t = this.ctx.currentTime; const g = this.ambG.gain; g.cancelScheduledValues(t); g.setValueAtTime(depth, t); g.setTargetAtTime(this.vol.music, t + sec, .6); }
  ambMute(on) { if (!this.ctx) return; this.ambG.gain.setTargetAtTime(on ? 0 : this.vol.music, this.ctx.currentTime, .4); }
  // 내레이션 재생. 파일 없으면 null.
  async voice(id, o = {}) {
    if (!this.ctx) return null; const vu = VOICE.dir + id + VOICE.ext; const b0 = await this.load(vu); if (!b0) return null; this.touchVoice(vu);
    let b = b0; if (o.reverse) { b = this.ctx.createBuffer(b0.numberOfChannels, b0.length, b0.sampleRate); for (let c = 0; c < b0.numberOfChannels; c++) { const s = b0.getChannelData(c), d = b.getChannelData(c); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; } }
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1;
    const g = this.ctx.createGain(); g.gain.value = o.vol ?? 1; s.connect(g); g.connect(o.phone ? this.phoneIn : this.voiceIn);
    const t = this.ctx.currentTime; this.duck.gain.cancelScheduledValues(t); this.duck.gain.setTargetAtTime(.45, t, .15);
    s.start(); this.curVoice = s;
    return { dur: b.duration / (o.rate || 1), stop: () => { try { s.stop(); } catch { } }, ended: new Promise(r => s.onended = () => { if (this.curVoice === s) this.duck.gain.setTargetAtTime(1, this.ctx.currentTime, .4); r(); }) };
  }
  stopVoice() { try { this.curVoice?.stop(); } catch { } }
}
