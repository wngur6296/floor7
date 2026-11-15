#!/usr/bin/env python3
"""data/lines.js → assets/voice/<id>.mp3 (edge-tts → voice_fx 후처리). 사용: python3 tools/gen_voice.py [--force] [id ...]
내레이터: ko-KR-HyunsuMultilingualNeural (+6%, -2Hz, 볼륨 +15%) — voice_samples/B_Hyunsu_present.mp3 와 같은 설정.
'@A' = 0425 서민지(SunHi), '@B' = 관리실·라디오(InJoon). 전부 voice_fx 로 EQ·컴프·옅은 잔향·-16 LUFS·48kbps 모노."""
import asyncio, json, os, re, subprocess, sys, tempfile
import edge_tts
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from voice_fx import process
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'voice')
VOICES = {'N': ('ko-KR-HyunsuMultilingualNeural', '+6%', '-2Hz', '+15%'),
          'A': ('ko-KR-SunHiNeural', '+0%', '+0Hz', '+10%'),
          'B': ('ko-KR-InJoonNeural', '+2%', '-4Hz', '+10%')}
lines = json.loads(subprocess.check_output(['node', '-e', "import('./data/lines.js').then(m=>console.log(JSON.stringify(m.LINES)))"], cwd=ROOT))
args = [a for a in sys.argv[1:] if not a.startswith('--')]; force = '--force' in sys.argv
os.makedirs(OUT, exist_ok=True)
sem = asyncio.Semaphore(6)
async def gen(k, t):
    v = 'N'
    m = re.match(r'^@([AB])\s+', t)
    if m: v = m.group(1); t = t[m.end():]
    if not re.search(r'[가-힣A-Za-z0-9]', t): return
    path = os.path.join(OUT, k + '.mp3')
    if os.path.exists(path) and not force and k not in args: return
    voice, rate, pitch, vol = VOICES[v]
    raw = os.path.join(tempfile.gettempdir(), 'tts_' + k + '.mp3')
    async with sem:
        for attempt in range(5):
            try:
                await edge_tts.Communicate(t, voice, rate=rate, pitch=pitch, volume=vol).save(raw)
                await asyncio.to_thread(process, raw, path); os.remove(raw); print('ok', k); return
            except Exception as e:
                print('retry', k, e); await asyncio.sleep(2 + attempt * 2)
        print('FAILED', k)
async def main():
    keys = [k for k in lines if not args or k in args]
    await asyncio.gather(*(gen(k, lines[k]) for k in keys))
asyncio.run(main())
# 고아 파일 정리 (lines.js 에서 지운 대사)
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f[:-4] not in lines: os.remove(os.path.join(OUT, f)); print('removed', f)
