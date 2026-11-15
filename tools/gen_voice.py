#!/usr/bin/env python3
"""data/lines.js → assets/voice/<id>.mp3 (edge-tts). 사용: python3 tools/gen_voice.py [--force]"""
import asyncio, json, os, re, subprocess, sys
import edge_tts
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'voice')
VOICES = {'N': ('ko-KR-InJoonNeural', '-10%', '-3Hz'), 'A': ('ko-KR-SunHiNeural', '-4%', '+0Hz'), 'B': ('ko-KR-HyunsuMultilingualNeural', '-2%', '-2Hz')}
lines = json.loads(subprocess.check_output(['node', '-e', "import('./data/lines.js').then(m=>console.log(JSON.stringify(m.LINES)))"], cwd=ROOT))
force = '--force' in sys.argv
os.makedirs(OUT, exist_ok=True)
sem = asyncio.Semaphore(6)
async def gen(k, t):
    v = 'N'
    m = re.match(r'^@([AB])\s+', t)
    if m: v = m.group(1); t = t[m.end():]
    if not re.search(r'[가-힣A-Za-z0-9]', t): return
    path = os.path.join(OUT, k + '.mp3')
    if os.path.exists(path) and not force: return
    voice, rate, pitch = VOICES[v]
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(t, voice, rate=rate, pitch=pitch).save(path); print('ok', k); return
            except Exception as e:
                print('retry', k, e); await asyncio.sleep(2)
async def main():
    await asyncio.gather(*(gen(k, t) for k, t in lines.items()))
asyncio.run(main())

# 생성 후 32kbps 로 압축
import subprocess as _sp, sys as _sys, os as _os
_sp.run([_sys.executable, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'compress_voice.py')])
