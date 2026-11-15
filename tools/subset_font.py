#!/usr/bin/env python3
"""Pretendard(OFL) 가변 폰트를 게임에 실제로 쓰는 글자만 남기고(FULL=1 이면 KS X 1001 한글 2350자 추가), 굵기 축을 400–800 으로 줄여 assets/fonts/ 에 저장.
사용: python3 tools/subset_font.py /path/PretendardVariable.woff2"""
import sys, os, glob, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set()
for pat in ['*.html', 'js/**/*.js', 'data/*.js', 'css/*.css']:
    for f in glob.glob(os.path.join(ROOT, pat), recursive=True): chars |= set(open(f, encoding='utf-8').read())
for b1 in (range(0xB0, 0xC9) if os.environ.get('FULL') else []):  # KS X 1001 완성형 한글
    for b2 in range(0xA1, 0xFF):
        try: chars.add(bytes([b1, b2]).decode('euc-kr'))
        except Exception: pass
chars |= set(chr(c) for c in range(0x20, 0x7F)) | set('…·—–‘’“”←→↑↓◀▶◆◇●○■□★☆①②③④⑤')
txt = os.path.join('/tmp', 'chars.txt'); open(txt, 'w', encoding='utf-8').write(''.join(sorted(c for c in chars if c.isprintable())))
out = os.path.join(ROOT, 'assets', 'fonts', 'PretendardVariable.subset.woff2')
src = sys.argv[1]
try:
    subprocess.check_call([sys.executable, '-m', 'fontTools.varLib.instancer', src, 'wght=400:800', '-o', '/tmp/pv_inst.ttf']); src = '/tmp/pv_inst.ttf'
except Exception as e: print('instancer 실패, 원본 사용', e)
subprocess.check_call(['pyftsubset', src, f'--text-file={txt}', '--flavor=woff2', f'--output-file={out}', '--layout-features=*'])
print(out, os.path.getsize(out))
