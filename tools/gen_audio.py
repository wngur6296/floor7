#!/usr/bin/env python3
"""모든 효과음/환경음을 numpy로 합성해 assets/audio/*.mp3 로 저장.
루프 사운드는 주기 신호로 만들고 앞뒤 0.2초 패딩 → 엔진이 loopStart=0.2, loopEnd=0.2+L 로 끊김 없이 반복.
루프 길이는 assets/audio/loops.json 에 기록된다."""
import numpy as np, subprocess, os, json
SR = 32000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'audio'); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(427)
loops = {}
def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.1):
    e = np.ones(n); A = max(1, int(a * SR)); R = max(1, int(r * SR))
    e[:A] = np.linspace(0, 1, A); e[-R:] *= np.linspace(1, 0, R); return e
def lp(x, a):  # 1-pole lowpass, a in (0,1)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += a * (x[i] - s); y[i] = s
    return y
def lpv(x, cutoff):
    # fast FFT brickwall-ish lowpass
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x))
def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4)); return np.fft.irfft(X, len(x))
def norm(x, peak=0.8): m = np.max(np.abs(x)) or 1; return x / m * peak
def save(name, x, loop=False, br='64k'):
    x = np.asarray(x, dtype=np.float64)
    if loop:
        P = int(0.2 * SR); L = len(x)
        x = np.concatenate([x[-P:], x, x[:P]]); loops[name] = L / SR
    x = np.clip(x, -1, 1); pcm = (x * 32767).astype('<i2').tobytes()
    p = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', br, os.path.join(OUT, name + '.mp3')], input=pcm)
    assert p.returncode == 0; print('saved', name)
def periodic_noise(d, cutoff=None):
    n = rng.standard_normal(int(SR * d))
    if cutoff: n = lpv(n, cutoff)  # FFT filtering keeps it periodic
    return n

# ── 형광등 험 (6s 주기)
d = 6; T = t(d)
hum = sum(a * np.sin(2 * np.pi * f * T + p) for f, a, p in [(120, .5, 0), (240, .28, 1), (360, .16, 2), (480, .1, .5), (600, .06, 1.3), (1200, .02, 0)])
buzz = bp(periodic_noise(d), 2000, 6000) * 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 120 * T) ** 2)
am = 1 + 0.08 * np.sin(2 * np.pi * (1 / 3) * T)
save('amb_hum', norm((hum + buzz) * am, .5), loop=True)
# ── 저음 드론 (12s) — 미세한 맥놀이로 불안감
d = 12; T = t(d)
dr = sum(a * np.sin(2 * np.pi * f * T) for f, a in [(55, .5), (55.25, .5), (82.5, .25), (110.5, .12), (164.75, .06)])
air = lpv(periodic_noise(d), 300) * 0.6
save('amb_drone', norm(dr * (0.8 + 0.2 * np.sin(2 * np.pi * T / 6)) + air, .55), loop=True)
# ── 기계실/관제실 톤 (8s)
d = 8; T = t(d)
srv = sum(a * np.sin(2 * np.pi * f * T) for f, a in [(60, .4), (180, .2), (300, .05), (933.75, .02)]) + bp(periodic_noise(d), 300, 2500) * .25
save('amb_server', norm(srv, .5), loop=True)
# ── 바깥 바람 (12s)
d = 12; T = t(d)
w = bp(periodic_noise(d), 150, 1200) * (0.6 + 0.4 * np.sin(2 * np.pi * T / 12) ** 2)
save('amb_outside', norm(w, .45), loop=True)
# ── 라디오 잡음 (4s)
save('radio_static', norm(bp(periodic_noise(4), 400, 7000) * (1 + 0.3 * np.sign(np.sin(2 * np.pi * 50 * t(4)))), .5), loop=True)
# ── 엘리베이터 모터 (4s)
d = 4; T = t(d)
save('elev_motor', norm(sum(a * np.sin(2 * np.pi * f * T) for f, a in [(45, .6), (90, .3), (135.25, .1)]) + lpv(periodic_noise(d), 500) * .4, .6), loop=True)

# ── 발소리 (카펫, 4종)
for i in range(4):
    n = int(SR * .28); x = rng.standard_normal(n)
    x = lpv(x, 500 + i * 120) * np.exp(-np.arange(n) / (SR * .035))
    thump = np.sin(2 * np.pi * (70 + 8 * i) * np.arange(n) / SR) * np.exp(-np.arange(n) / (SR * .03))
    save(f'step_{i}', norm(x + thump * .6, .7))
def creak(d=1.0, f0=180, f1=120):
    T = t(d); f = np.linspace(f0, f1, len(T)) * (1 + .03 * np.sin(2 * np.pi * 7 * T))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sign(np.sin(ph)) * .3 + np.sin(ph * 2) * .3
    return bp(s, 200, 2500) * env(len(T), .1, .3) * (0.5 + 0.5 * rng.random(len(T)) ** 4)
def knock(d=.3, f=90, dec=.05):
    T = t(d); return (np.sin(2 * np.pi * f * T) + lpv(rng.standard_normal(len(T)), 900) * .7) * np.exp(-T / dec)
save('door_open', norm(np.concatenate([knock(.12, 900, .01) * .5, creak(1.1, 210, 150) * .7]), .6))
save('door_close', norm(np.concatenate([creak(.4, 160, 140) * .3, knock(.5, 80, .07)]), .75))
x = np.concatenate([knock(.09, 1200, .008), knock(.09, 1100, .008), np.zeros(int(.05 * SR)), knock(.12, 1000, .01)])
save('door_locked', norm(x, .6))
T = t(.6); save('drawer', norm(bp(rng.standard_normal(len(T)), 300, 3000) * env(len(T), .05, .2) * (.6 + .4 * np.sin(2 * np.pi * 30 * T)), .5))
T = t(.08); save('click', norm(np.sin(2 * np.pi * 2200 * T) * np.exp(-T / .01) + rng.standard_normal(len(T)) * np.exp(-T / .004) * .3, .5))
T = t(.12); save('beep', norm(np.sin(2 * np.pi * 1400 * T) * env(len(T), .002, .02), .4))
T = t(.45); save('error', norm(np.sign(np.sin(2 * np.pi * 140 * T)) * env(len(T), .01, .05) * .5, .4))
T = t(2.2); save('ding', norm((np.sin(2 * np.pi * 659.25 * T) * np.exp(-T / .6) + np.sin(2 * np.pi * 523.25 * np.maximum(T - .45, 0)) * np.exp(-np.maximum(T - .45, 0) / .7) * (T > .45)) * .6, .5))
# 전화벨: 한국식 사무실 전화 (1.2s 울림 + 2s 쉼)
T = t(3.2); on = (T < 1.2) * ((T * 20).astype(int) % 2 == 0)
ring = (np.sin(2 * np.pi * 1300 * T) + np.sin(2 * np.pi * 1600 * T)) * on * .5
save('phone_ring', norm(lpv(ring, 4000), .5))
T = t(.3); save('phone_pick', norm(knock(.3, 300, .03), .5))
# 복사기
T = t(4.0); cp = bp(rng.standard_normal(len(T)), 200, 4000) * (.5 + .5 * np.sin(2 * np.pi * 2 * T) ** 2) + np.sin(2 * np.pi * 100 * T) * .3
save('copier', norm(cp * env(len(T), .2, .5), .55))
save('vending', norm(np.concatenate([bp(rng.standard_normal(int(.8 * SR)), 100, 1500) * .3, knock(.6, 70, .1)]), .7))
T = t(.25); save('pickup', norm(bp(rng.standard_normal(len(T)), 1500, 6000) * env(len(T), .01, .15), .35))
T = t(.15); save('switch', norm(knock(.15, 2500, .006), .5))
# 도전과제 차임 (오르골 2음, 살짝 어긋난 음정)
T = t(1.6); ch = np.sin(2 * np.pi * 1046.5 * T) * np.exp(-T / .5) + np.sin(2 * np.pi * 1396.9 * 1.006 * np.maximum(T - .12, 0)) * np.exp(-np.maximum(T - .12, 0) / .6) * (T > .12)
save('achieve', norm(ch, .4))
# 결말 스웰
T = t(7); sw = sum(np.sin(2 * np.pi * f * T) for f in [41.2, 61.7, 82.4, 98.0, 123.5 * 1.01]) * np.minimum(T / 4, 1) * env(len(T), .01, 2)
save('ending', norm(sw + lpv(rng.standard_normal(len(T)), 200) * np.minimum(T / 4, 1) * .5, .6))
# 텔레포트/공간 이상: 부드러운 공기 빠짐
T = t(1.2); save('whoosh', norm(bp(rng.standard_normal(len(T)), 100, 900) * np.sin(np.pi * T / 1.2) ** 2, .35))
# 기어가기
T = t(.5); save('crawl', norm(bp(rng.standard_normal(len(T)), 600, 4000) * env(len(T), .1, .2) * .5, .4))
# 시계 똑딱
T = t(.05); save('tick', norm(knock(.05, 3000, .004), .3))
# 물 붓기
T = t(1.5); save('water', norm(bp(rng.standard_normal(len(T)), 800, 5000) * (0.5 + 0.5 * rng.random(len(T)) ** 8) * env(len(T), .1, .3), .4))
# 쿵 (조명 꺼짐)
T = t(1.5); save('power_off', norm(np.sin(2 * np.pi * 60 * T * (1 - T / 3)) * np.exp(-T / .5) + knock(1.5, 50, .2) * .5, .7))
# 오르골 (보류음 / 라디오 104.7) — 단순하고 조금 음이 틀린 멜로디
def musicbox(notes, bpm=84, detune=1.0, dur=None):
    beat = 60 / bpm; total = sum(d for _, d in notes) * beat
    out = np.zeros(int(SR * (dur or total))); pos = 0.0
    for m, d in notes:
        if m is not None:
            f = 440 * 2 ** ((m - 69) / 12) * detune; n = int(SR * 2.5); T = np.arange(n) / SR
            tone = (np.sin(2 * np.pi * f * T) + .3 * np.sin(2 * np.pi * f * 2.01 * T) + .1 * np.sin(2 * np.pi * f * 3.98 * T)) * np.exp(-T / .7)
            s = int(pos * SR) % len(out); e = min(len(out), s + n); out[s:e] += tone[:e - s]
            if s + n > len(out): out[:s + n - len(out)] += tone[e - s:]  # wrap → 주기적
        pos += d * beat
    return out
mel = [(72, 1), (76, 1), (79, 1), (76, 1), (74, 1), (71, 1), (67, 2), (69, 1), (72, 1), (76, 1), (74, .5), (72, .5), (71, 3), (None, 1),
       (72, 1), (76, 1), (79, 1), (81, 1), (79, 1), (76, 1), (74, 2), (72, 1), (71, 1), (69, 1), (67, 1), (72, 3), (None, 1)]
bass = [(48, 4), (43, 4), (45, 4), (43, 4), (48, 4), (41, 4), (43, 4), (48, 4)]
mb = musicbox(mel, 84) + .5 * musicbox(bass, 84, dur=sum(d for _, d in mel) * 60 / 84)
save('hold_music', norm(lpv(mb, 3500), .45), loop=True)
mb2 = musicbox(mel, 76, 0.985) + .6 * musicbox(bass, 76, 0.985, dur=sum(d for _, d in mel) * 60 / 76)
save('radio_song', norm(lpv(mb2, 2600) + bp(periodic_noise(len(mb2) / SR), 1000, 5000) * .03, .45), loop=True)
# 타이틀 테마: 아주 느린 패드
d = 16; T = t(d)
pad = sum(np.sin(2 * np.pi * f * T + np.sin(2 * np.pi * T / 16) * 2) for f in [110, 130.8125, 164.8125, 196.0 * 1.0025])
save('title_pad', norm(lpv(pad, 900) * (0.7 + 0.3 * np.sin(2 * np.pi * T / 8)), .4), loop=True)
json.dump(loops, open(os.path.join(OUT, 'loops.json'), 'w'), indent=1)
