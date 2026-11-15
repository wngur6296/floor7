# 내레이터 후보 A/B 샘플 생성 → voice_samples/
import asyncio, os, subprocess, sys, tempfile
import edge_tts
sys.path.insert(0, os.path.dirname(__file__)); from voice_fx import process
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'voice_samples')
TEXT = '0427은 오늘도 정시에 출근했습니다. 0427 앞에 문이 네 개 있었습니다. 0427은 왼쪽 문으로 들어갔습니다. 빨간 점이 0427입니다. 점이 멈추면, 저는 조금 불안해집니다.'
CANDS = {
  'A_InJoon_energetic': ('ko-KR-InJoonNeural', '+8%', '-2Hz', '+15%'),
  'B_Hyunsu_present': ('ko-KR-HyunsuMultilingualNeural', '+6%', '-2Hz', '+15%'),
  'C_InJoon_deep': ('ko-KR-InJoonNeural', '+3%', '-8Hz', '+15%'),
  'Z_before_original': ('ko-KR-InJoonNeural', '-10%', '-3Hz', '+0%'),
}
async def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (v, r, p, vol) in CANDS.items():
        raw = os.path.join(tempfile.gettempdir(), name + '.mp3')
        await edge_tts.Communicate(TEXT, v, rate=r, pitch=p, volume=vol).save(raw)
        if name.startswith('Z_'): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-ac', '1', '-b:a', '32k', os.path.join(OUT, name + '.mp3')], check=True)
        else: process(raw, os.path.join(OUT, name + '.mp3'))
        print('ok', name)
asyncio.run(main())
