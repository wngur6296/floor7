# 내레이션 후처리: 저역 보강(따뜻함) + 존재감 대역 + 컴프레서 + 아주 옅은 방 잔향 + -16 LUFS 정규화 → 48kbps 모노 MP3 (샘플은 56k)
import subprocess
TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,'  # 앞뒤 무음 제거 → 트리거 즉시 말이 시작됨
FX = ('highpass=f=65,equalizer=f=180:t=q:w=0.9:g=3,equalizer=f=450:t=q:w=1.2:g=-1.5,equalizer=f=3000:t=q:w=1.0:g=2.5,'
      'acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3,aecho=0.9:0.5:22|37:0.10|0.06,'
      'loudnorm=I=-16:TP=-1.5:LRA=6')
def process(src, dst, bitrate='48k', trim=True):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', (TRIM if trim else '') + FX, '-ac', '1', '-ar', '24000', '-b:a', bitrate, dst], check=True)
