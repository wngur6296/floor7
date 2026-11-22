# 정연빌딩 7층 — 다음 지시가 있을 때까지

브라우저에서 바로 실행되는 1인칭 3D 심리 공포 탐험 게임입니다. 점프 스케어, 고어, 괴물은 없습니다.
사원 0427은 지시대로만 일해 왔습니다. 그런데 오늘은 지시가 오지 않고, 7층에 남은 사람은 아무도 없습니다. 0427이 할 일을 하나하나 설명해 주는 목소리만 남아 있습니다. 그 목소리를 따를지, 거스를지, 되물을지, 침묵할지는 당신이 정합니다.

- 정적 파일만으로 동작합니다(빌드 없음). `index.html`이 루트에 있고 경로는 모두 상대 경로입니다. three.js r160은 `vendor/`에 들어 있습니다(CDN 없음).
- iPhone Safari를 우선으로 만들었고 데스크톱 브라우저도 지원합니다. PWA로 홈 화면에 추가할 수 있습니다.

## 실행
```bash
cd uncanny && python3 -m http.server 8000   # → http://localhost:8000
```
모듈 스크립트라서 `file://`로 열면 동작하지 않습니다. 반드시 HTTP 서버를 통해 여세요. GitHub Pages에 올려도 됩니다.

## 조작
| | 모바일 | 데스크톱 |
|---|---|---|
| 이동 | 왼쪽 엄지 조이스틱 (설정에서 좌우 바꾸기 가능) | WASD / 방향키, Shift 걷기 |
| 시점 | 화면 오른쪽 드래그 | 마우스 (포인터 잠금) |
| 조사·사용 | 물체 탭 / 하단 안내 버튼 탭 | 클릭 / E |
| 갈림길 | 화면을 누르는 선택지는 없음 — 걸어가기·바라보기·조사·가만히 서 있기로 고른다 | 〃 |
| 메뉴 | 우상단 ❚❚ | Esc / P · 메뉴에서는 ↑↓ Enter Esc, 탭 전환은 Q/E |

공략(결말 12개, 잠긴 문, 이스터에그)은 [GUIDE.md](GUIDE.md)에 있습니다.

## 구조
```
index.html            화면 마크업 (메뉴·일시정지·슬롯·설정·도전과제·갤러리·크레딧·결말·확인창·HUD)
css/style.css         UI 디자인 시스템 (Pretendard, 글래스 시트, 포커스 하이라이트, 안전 영역)
js/main.js            부팅, 화면 스택, 키보드/컨트롤러식 내비게이션, 설정 연결, 저장 슬롯 UI
js/engine/            엔진 (데이터를 모름)
  game.js             게임 루프·이벤트 버스·내레이터 큐·감시(Tracker)·결말·저장/불러오기
  world.js            data/level.js → 3D 월드 (방·문·소품·트리거, 재질별 병합, 조명 풀)
  player.js           입력(조이스틱·드래그·포인터 잠금) + 충돌 이동
  props.js            소품 프리미티브 빌더 (GLB 대체용 기본 형태)
  assets.js           에셋 매니페스트 로더 (텍스처 URL→절차 텍스처, GLB→프리미티브 대체)
  proctex.js          절차적 캔버스 텍스처
  audio.js            Web Audio (루프·효과음·음성·리버브·더킹·전화 필터·역재생)
  post.js             후처리 (그레인·비네트·색수차·왜곡·페이드)
  ui.js               HUD·모달(문서·컴퓨터·키패드·엘리베이터·라디오·전화·조사·오락기)
  save.js             프로필 (회차·결말·도전과제·설정)  localStorage 'jungyeon7f.save.v1'
  slots.js            저장 슬롯 (자동 + 수동 3개, 썸네일)  localStorage 'jungyeon7f.slots.v1'
data/                 ★ 콘텐츠: 여기만 고치면 게임이 바뀝니다
  level.js            방(ROOMS)·문(DOORS)·소품(PROPS)·트리거·순간이동·스폰
  story.js            이벤트 → 연출 스크립트 (STORY), 불순종 반응 (REACT)
  lines.js            대사 전체 (id → 문장)
  docs.js             메일·문서·메모·슬라이드·라디오 채널·포스터
  achievements.js     도전과제 31개 (hidden:true → ???)
  endings.js          결말 12개
  assets.js           ★ 에셋 매니페스트 (텍스처·재질·모델·사운드·음성 폴더)
assets/voice/         대사 음성 MP3 (edge-tts)
assets/audio/         합성 사운드 MP3 + loops.json (끊김 없는 루프 지점)
assets/img/           자막 미리보기 배경(webp)·아이콘
assets/fonts/         Pretendard 서브셋 (OFL)
tools/                생성·검증 스크립트
```

## 에셋 교체 (그래픽·사운드 바꾸기)
모든 에셋은 **`data/assets.js` 한 파일**에서 관리합니다. 엔진 코드는 고칠 필요가 없습니다.

### 텍스처
```js
carpet: { url: 'assets/img/carpet.jpg', proc: 'carpet' },
```
`url`이 있으면 그 이미지를 먼저 씁니다. 불러오지 못하면 `proc`(절차 텍스처)로 대신합니다. 크기는 2의 거듭제곱(512, 1024 등)이 좋습니다. 반복 간격은 `MATERIALS`의 `tile` 값(텍스처 한 장이 덮는 미터 수)으로 조절합니다.

### 재질
`MATERIALS.id = { tex, color, tile, emissive, opacity }` 형식입니다. 벽·바닥·천장·소품이 이 id로 재질을 참조합니다.

### 3D 모델 (GLB)
```js
desk: { glb: 'assets/models/desk.glb', scale: 1, rotY: 0, y: 0 },
```
- id는 `js/engine/props.js`에 있는 프리미티브 이름과 같습니다(desk, chair, monitor, phone, copier, plant, duck 등).
- GLB가 없거나 불러오지 못하면 같은 이름의 프리미티브가 자동으로 쓰입니다. 그래서 하나씩 바꿔 나가도 게임이 깨지지 않습니다.
- 원점은 바닥 중앙, +Z를 앞으로, 단위는 미터(1 = 1m)로 맞춰 주세요. 충돌 박스와 상호작용 영역은 `data/level.js`의 소품 정의(w/d/h)를 따릅니다.
- `keepPrimitive: true`를 주면 GLB와 프리미티브를 함께 표시합니다. 화면, 라벨처럼 프리미티브 쪽에 붙은 동적 텍스처가 필요한 경우에 씁니다.

### 사운드
`SOUNDS.id = { url, loop?, vol? }` 형식입니다. 루프 사운드는 `assets/audio/loops.json`의 루프 구간(앞뒤 0.2초 여유)을 사용합니다. 새 파일로 바꿀 때는 해당 항목을 지우면 파일 전체를 반복 재생합니다.
기본 사운드는 `python3 tools/gen_audio.py`로 numpy 합성해 생성합니다(ffmpeg 필요).

### 대사 · 음성
1. `data/lines.js`에서 문장을 고치거나 새 id를 추가합니다. 앞에 `@A `를 붙이면 여성 목소리, `@B `를 붙이면 남성 목소리 2로 녹음됩니다.
2. `python3 tools/gen_voice.py [대사id ...]`를 실행합니다(전부 다시 만들려면 `--force`). 내레이터는 `ko-KR-HyunsuMultilingualNeural`(속도 +6%, 음높이 -2Hz, 볼륨 +15%), `@A`는 SunHi, `@B`(관리실·라디오)는 InJoon입니다. 생성된 음성은 `tools/voice_fx.py`로 앞뒤 무음 제거 → EQ(저역 따뜻함·3kHz 존재감) → 컴프레서 → 옅은 잔향 → -16 LUFS 정규화 → 48kbps 모노로 처리됩니다. 이후 `node tools/gen_voicemap.mjs`로 미리 받기 지도를 갱신하세요. `pip install edge-tts`와 ffmpeg가 필요합니다. 후보 목소리 비교 샘플은 `voice_samples/`(`tools/voice_samples.py`)에 있습니다.
3. `node tools/export_script.mjs`를 실행하면 SCRIPT.md의 전체 대사 표가 갱신됩니다.
4. UI에 새 글자를 넣었다면 `python3 tools/subset_font.py <PretendardVariable.woff2>`로 글꼴 서브셋을 다시 만듭니다.
음성 파일이 없는 대사는 자막만 표시됩니다.

### 레벨 · 스토리
- 방을 추가하려면 `ROOMS`에 사각형 영역(x0, z0, x1, z1), 높이, 재질, 조명 기준점을 넣습니다. 문은 `DOORS`, 소품은 `PROPS`에 넣습니다.
- 소품의 `interact.type`은 drawer, computer, phone, doc, inspect, take, sit, switch, radio, keypad, elevator, event 등입니다. 사용하면 `use:<id>` 이벤트가 발생합니다.
- 연출은 `data/story.js`의 `STORY['enter:<방>']`, `STORY['use:<소품>']` 같은 핸들러에 씁니다. 여기서 `G.say`, `G.beat`, `G.expect`, `G.ending`, `G.ach` 등의 API를 쓸 수 있습니다.
- 내레이터가 "왼쪽으로 가라"고 지시하는 부분은 `G.expect({ to: [...], wrong: { 방: '대사id' } })`로 씁니다. 반대로 가기, 되돌아가기, 가만히 있기, 맴돌기, 천장 보기는 Tracker가 자동으로 감지합니다.

## 저장
- **자동 저장**: 방에 들어갈 때마다 저장합니다(6초 간격 제한).
- **수동 저장**: 일시정지 → 저장하기 → 슬롯 1~3. 덮어쓸 때는 확인창이 뜹니다.
- 슬롯에는 장면(방), 위치, 시선, 플래그, 소지품, 문과 서랍 상태, 진행 중인 지시, 플레이 시간, 시각, 썸네일이 들어갑니다.
- 결말, 도전과제, 회차, 설정은 프로필 저장(`save.js`)에 따로 보관합니다. 안내 음성이 지난 출근을 기억하는 데 쓰는 정보입니다.

## 테스트
```bash
python3 -m http.server 18427 &
npm i playwright && npx playwright install chromium
node tools/smoke.cjs   # 각 방 스크린샷 → screens/
node tools/flows.cjs   # 결말 12개 자동 검증
node tools/ui.cjs      # 메뉴/설정/슬롯/저장·불러오기/결말 UI 검증 + 스크린샷 (데스크톱·아이폰 세로/가로)
node tools/qa.cjs all  # ★ 종합 QA: 콘솔 오류·Promise 거부·404 0건 단언, 설정 전 항목, 슬롯 1·2·3·자동, iPhone 14 터치 에뮬레이션으로 결말 12개, 성능 측정
```

## 내레이션 반응성
- **선택지 UI 없음.** 갈림길은 `G.beat(대사, { toward, to, look, reply })`가 플레이어의 몸짓(걸어감·멀어짐·바라봄·조사·가만히)을 읽어 순종/반항/호기심/침묵으로 판정합니다.
- **낡은 말은 버립니다.** 모든 대사는 말한 방에 묶여 있어, 플레이어가 방을 떠나면 대기 중인 줄은 버리고 나오는 중인 줄은 0.3초 뒤 끊습니다(문턱에서 잠깐 넘나든 건 무시). 큐에서 6초 넘게 기다린 줄도 버립니다. 전화·라디오·결말 연출은 `sticky`라서 끝까지 나옵니다.
- **우선순위.** `interrupt`(2) > 일반(1) > `ifIdle`(0). 높은 줄이 오면 낮은 줄을 즉시 끊습니다. 줄 사이 간격은 0.2초입니다.
- **미리 받기.** `data/voicemap.js`(자동 생성)에 따라 방에 들어가는 순간 그 방과 이웃 방에서 나올 음성을 미리 받아 두고, 자막과 음성을 동시에 시작합니다. 긴 지시문은 둘로 나눴습니다.
- 방에 막 들어가 지시가 나오는 처음 3초 동안만 걷는 속도를 0.85배로 살짝 낮춥니다.

## 최적화 메모
- **정적 지오메트리 병합**: 움직이지 않는 벽·바닥·소품은 방 × 재질 단위로 하나의 메시로 합칩니다. 상호작용하는 소품도 움직이지 않는 부품은 재질별로 합칩니다. 따로 인스턴싱하는 것보다 드로우콜이 적습니다.
- **방 단위 가시성 + 거리 컬링**: 지금 있는 방에서 열린 문이나 개구부로 이어진 방만 그립니다. 안개 끝보다 먼 덩어리도 생략합니다. 배경색을 안개색과 맞춰 두어서 생략해도 눈에 띄지 않습니다.
- **조명**: 실시간 그림자를 쓰지 않습니다(그림자 캐스터 0). 포인트 라이트 5개를 풀로 두고 가까운 천장 조명에 돌려 씁니다.
- **거울**: 6m 밖에서는 반사를 갱신하지 않고, 중·저화질에서는 45ms에 한 번만 갱신합니다.
- **해상도**: 모바일은 픽셀 비율 상한이 1.6(아이폰 DPR 3이어도 1.6)이고, 저화질은 0.8입니다. 화질 '자동'은 실제 프레임 시간의 이동 평균을 보고 2초마다 단계를 올리거나 내립니다.
- **로딩**: GLB가 없으면 GLTFLoader(108KB)를 받지 않습니다. 대사 음성은 그 대사가 나올 때 받고(다음 대사 몇 개는 미리 받기), 디코딩한 버퍼는 최근 24개만 메모리에 남깁니다. 효과음과 환경음도 처음 재생될 때 받습니다.
- **용량**: 글꼴은 게임에 쓰는 글자만 남긴 서브셋에 굵기 축을 400–800으로 줄여 114KB입니다. 음성은 -16 LUFS로 맞춘 48kbps 모노입니다(`tools/voice_fx.py`). 이미지는 webp이고, 절차 텍스처는 256–512px입니다.
- **프레임당 할당 줄이기**: 레이캐스트용 벡터를 재사용하고, 안내 문구는 바뀌었을 때만 DOM을 갱신하며, 컬링은 0.1초 간격으로 돕니다.


## 라이선스 / 출처
- three.js (MIT), Pretendard (SIL OFL 1.1, `assets/fonts/LICENSE-Pretendard.txt`)
- 음성: Microsoft Edge 신경망 TTS (edge-tts). 효과음·음악: 절차 합성. 설정 화면 미리보기 이미지·아이콘: AI 이미지 생성.
