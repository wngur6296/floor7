# 대사 MP3 를 32kbps 모노로 재인코딩 (음성은 이 정도면 충분, 용량 약 1/3 절감). 이미 32k 인 파일은 건너뜀.
import subprocess, pathlib, json, sys
d = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'voice'
n = 0
for f in sorted(d.glob('*.mp3')):
    br = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=bit_rate', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout.strip()
    if br and int(br) <= 33000: continue
    tmp = f.with_suffix('.tmp.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(f), '-ac', '1', '-ar', '24000', '-b:a', '32k', str(tmp)], check=True)
    tmp.replace(f); n += 1
print('재인코딩', n, '개')
