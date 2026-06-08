# CGMMgr — 재개발 문서 패키지

---

# 1. PRD (Product Requirements Document)

## 제품 개요
**CGMMgr**는 CGM(연속혈당측정) 센서 재고를 스마트폰에서 관리하는 개인용 웹앱입니다.
서버 없이 브라우저 로컬스토리지에 데이터를 저장하며, Netlify 등 정적 호스팅으로 배포합니다.

## 사용자
- 당뇨 환자 본인 (1인 사용)
- Android Chrome 사용
- 한국어 UI

## 핵심 문제
- CGM 센서는 유효기간이 있어 재고 관리가 중요
- 센서 포장 라벨의 GS1 바코드(DataMatrix)에서 유효기간·제조번호를 자동 인식하고 싶음
- 여러 제품(케어센스 에어, 바로젠핏, Dexcom G7, 파코링, GS1 Sibionics, FreeStyle Libre 2)을 함께 관리

## 기능 요구사항

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 재고 추가 | 카메라 촬영 → 자동 인식 또는 수동 입력 |
| 재고 목록 | 전체/제품별/상태별 필터링 |
| 대시보드 | 현재 사용 센서 잔여일, 재고 현황, 다음 만료 예정 |
| 사용 관리 | 사용 시작/종료, 보관 처리, 삭제 |
| 알림 기준 | 만료 임박 D-N일 기준 설정 |
| 백업/복원 | JSON 파일 내보내기/가져오기 |

### 센서 인식 (우선순위 순)
1. **QR코드** (jsQR) — Dexcom G7 등 QR 라벨
2. **DataMatrix** (ZXing 또는 AI) — 케어센스 에어, 바로젠핏 등
3. **AI 이미지 인식** (Anthropic API) — 모든 라벨 범용 인식
4. **GS1 텍스트 붙여넣기** — `(17)260725(10)250703B003` 형태 직접 입력
5. **수동 입력** — 날짜 직접 선택

### 제품 구별 로직 (중요)
케어센스 에어와 바로젠핏은 외관이 유사하므로 3단계 매칭:
1. GTIN 코드 (가장 정확)
2. 모델명 (CGM-ST-002 / CGM-ST-003)
3. 브랜드 텍스트 (케어센스 / Barozen)

## 제품 데이터
| 제품명 | ID | 착용일수 | GTIN | 모델 | 색상 |
|--------|-----|---------|------|------|------|
| 케어센스 에어 | caresens_air | 15일 | 08809126640655 | CGM-ST-002 | #00c6fb |
| 바로젠핏 | barogen_fit | 15일 | 08806712005959 | CGM-ST-003 | #43e97b |
| Dexcom G7 | dexcom_g7 | 10일 | 00386270000467 | — | #f7971e |
| 파코링(피코링) | fakoring | 15일 | 06958590313168 | — | #f953c6 |
| GS1 (Sibionics) | gs1 | 14일 | 06972831642299 | — | #a78bfa |
| FreeStyle Libre 2 | libre2 | 14일 | — | — | #38bdf8 |
| 기타/커스텀 | custom | 14일 | — | — | #94a3b8 |

## 비기능 요구사항
- **오프라인 동작**: 데이터는 localStorage, 인터넷 없이 기본 기능 사용 가능
- **HTTPS 필수**: AI 인식, 카메라 직접 접근을 위해 HTTPS 환경 필요
- **모바일 최적화**: max-width 480px, 다크 테마
- **단일 파일**: HTML 하나로 배포 (또는 Netlify 정적 호스팅)

---

# 2. CRD (Component Requirements Document)

## 화면 구조
```
App
├── Header (날짜 표시)
├── Main Content (탭별)
│   ├── 대시보드 탭
│   ├── 재고목록 탭
│   ├── 센서추가 탭
│   └── 설정 탭
└── BottomNav (4개 탭)
```

## 컴포넌트 상세

### BottomNav
- 대시보드 / 재고목록 / 센서추가(+) / 설정
- 재고목록: 만료임박+만료 수 배지 표시

### Dashboard
- 현재 사용 센서 카드 (잔여일 프로그레스 바, 색상 경고)
- 재고 현황 그리드 (전체/사용중/만료임박/만료)
- 다음 만료 예정 카드
- 제품별 재고 리스트

### InventoryList
- 제품종류 / 상태 필터 (select)
- 센서 카드: 제품명, LOT, 유효기간, 상태 배지, 잔여일, 라벨 썸네일
- 카드 탭 → 상세 모달

### DetailModal (하단 슬라이드업)
- 센서 정보 테이블
- 라벨 이미지 (full width)
- 액션 버튼: 사용 시작 / 사용 종료 / 보관 처리 / 삭제

### AddForm
- **카메라 스캔 섹션**
  - 📷 카메라로 촬영 (`<input capture="environment">`)
  - 🖼 갤러리에서 선택
  - 결과 메시지 (성공/실패)
- **GS1 코드 붙여넣기 섹션**
  - textarea + 자동채우기 버튼
  - 안내: "Google 렌즈로 텍스트 복사 → 붙여넣기"
- **수동 입력 섹션**
  - 제품 종류 select
  - 추가 수량 number
  - 유효기간 date (필수)
  - 제조번호 text (선택)
  - 메모 textarea (선택)
  - + N개 추가 버튼

### Settings
- 알림 기준일 설정
- CGM 제품 관리 (추가/삭제)
- AI API 키 입력 (localStorage 저장)
- 데이터 백업/복원

## 상태(State) 구조
```javascript
{
  sensorTypes: [{ id, name, wearDays, color, gtin, model }],
  inventory: [{
    id, typeId, lot, expiry, openedAt,
    notes, archived, createdAt, labelImg, serial
  }],
  settings: { alertDays: 30 }
}
// localStorage key: 'cgm_v5'
// API key: localStorage 'cgm_key' (별도 저장)
```

## 센서 상태 정의
| 상태 | 조건 | 색상 |
|------|------|------|
| 미개봉 | openedAt 없음, 만료 아님 | #00c6fb |
| 사용중 | openedAt 있음 | #43e97b |
| 만료임박 | D-N일 이하 | #f7971e |
| 만료 | daysUntil < 0 | #ff4d4d |
| 보관 | archived = true | #888 |

---

# 3. 기술 스택 및 아키텍처

## 권장 스택 (재개발 시)

### Option A: 단순 HTML (현재 방식)
- **장점**: 단일 파일, 배포 간단
- **단점**: 코드 유지보수 어려움
- **추천**: Netlify에 단일 HTML 배포

### Option B: React + Vite (권장)
```
프로젝트 구조:
src/
├── App.jsx
├── components/
│   ├── Dashboard.jsx
│   ├── Inventory.jsx
│   ├── AddForm.jsx
│   ├── Settings.jsx
│   ├── DetailModal.jsx
│   └── BottomNav.jsx
├── lib/
│   ├── gs1Parser.js      # GS1 바코드 파싱
│   ├── productMatcher.js # 제품 자동 매칭
│   ├── storage.js        # localStorage CRUD
│   └── aiScan.js         # Anthropic API 호출
└── constants/
    └── products.js       # 제품 목록, GTIN 테이블
```

## 핵심 라이브러리
| 라이브러리 | 용도 | 비고 |
|-----------|------|------|
| jsQR | QR코드 인식 | npm install jsqr |
| @zxing/library | DataMatrix 인식 | HTTPS 환경에서만 안정적 |
| Anthropic API | AI 이미지 인식 | API 키 필요, 건당 ~5원 |

## AI 인식 플로우 (HTTPS 환경)
```
사진 촬영 (getUserMedia 또는 input file)
  ↓
1. jsQR로 QR 시도 (빠름, ~100ms)
  ↓ 실패
2. ZXing으로 DataMatrix 시도 (~500ms)
  ↓ 실패
3. Anthropic API AI 인식 (~3초, API 키 필요)
  ↓ 실패
4. GS1 텍스트 붙여넣기 안내
```

---

# 4. AI 인식 프롬프트

## Anthropic API 시스템 프롬프트
```
CGM 센서 포장 라벨 사진입니다. JSON만 반환하세요. 다른 텍스트 없이.

제품명 구별 규칙:
- "케어센스" 또는 "CGM-ST-002" 또는 GTIN 08809126640655 → "케어센스 에어"
- "Barozen" 또는 "CGM-ST-003" 또는 GTIN 08806712005959 → "바로젠핏"
- "dexcom" 또는 "G7" → "Dexcom G7"
- "FreeStyle" 또는 "Libre" → "FreeStyle Libre 2"
- "Sibionics" 또는 "GS1" → "GS1 (Sibionics)"
- "피코링" 또는 "Picoling" → "파코링(피코링)"

유효기간 추출 (우선순위):
1. 사용기한/유효기간: YYYY-MM-DD 직접 표기
2. GS1 코드 (17)YYMMDD → YYYY-MM-DD 변환
   예: (17)260725 → 2026-07-25
   예: (17)270325 → 2027-03-25
3. EXP/USE BY 뒤 날짜
4. 없으면 빈 문자열

제조번호: 제조번호/LOT/(10) 뒤 코드
시리얼: 시리얼번호/일련번호/(21) 뒤 코드
GTIN: (01) 뒤 14자리

반환 형식:
{
  "expiry": "YYYY-MM-DD 또는 빈 문자열",
  "lot": "제조번호 또는 빈 문자열",
  "productName": "제품명 또는 빈 문자열",
  "serial": "시리얼 또는 빈 문자열",
  "gtin": "14자리 GTIN 또는 빈 문자열"
}
```

---

# 5. GS1 파서 구현

## parseGS1(rawString)
```javascript
// GS1 바코드 문자열 파싱
// 입력: "(01)08809126640655(17)260725(10)250701C001"
// 또는 DataMatrix raw: "\x1d0108809126640655\x1d17260725\x1d10250701C001"

function yymmddToDate(s) {
  if (!s || s.length !== 6) return '';
  const yy = s.slice(0,2), mm = s.slice(2,4), dd = s.slice(4,6);
  const year = (parseInt(yy) < 50 ? '20' : '19') + yy;
  const day = dd === '00'
    ? new Date(parseInt(year), parseInt(mm), 0).getDate()
    : parseInt(dd);
  return year + '-' + mm + '-' + String(day).padStart(2,'0');
}

function parseGS1(raw) {
  if (!raw) return {};
  // 심볼로지 식별자 제거, 구분자 정규화
  let s = raw.replace(/^\][A-Za-z][0-9A-Fa-f]/, '')
             .replace(/[\x1d\x1c\x04\x1e]/g, '|');
  const r = {};
  const FIXED = [
    {ai:'01', key:'gtin',   len:14},
    {ai:'11', key:'mfg',    len:6},
    {ai:'17', key:'expiry', len:6},
  ];
  const VAR = [
    {ai:'10', key:'lot'},
    {ai:'21', key:'serial'},
  ];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '|') { i++; continue; }
    let matched = false;
    for (const p of FIXED) {
      if (s.startsWith(p.ai, i)) {
        r[p.key] = s.substr(i + p.ai.length, p.len);
        i += p.ai.length + p.len;
        matched = true; break;
      }
    }
    if (!matched) for (const p of VAR) {
      if (s.startsWith(p.ai, i)) {
        const st = i + p.ai.length;
        const sep = s.indexOf('|', st);
        r[p.key] = sep >= 0 ? s.substring(st, sep) : s.substring(st);
        i = sep >= 0 ? sep + 1 : s.length;
        matched = true; break;
      }
    }
    if (!matched) i++;
  }
  if (r.expiry) r.expiry = yymmddToDate(r.expiry);
  return r;
}
```

---

# 6. 개발 우선순위 및 로드맵

## Phase 1 — 기본 앱 (1~2일)
- [ ] React + Vite 프로젝트 셋업
- [ ] 기본 레이아웃 (4탭 네비게이션)
- [ ] localStorage CRUD
- [ ] 대시보드, 재고목록, 수동 입력 폼
- [ ] 상태 배지, 만료 계산

## Phase 2 — 인식 기능 (1~2일)
- [ ] GS1 텍스트 파서
- [ ] jsQR 통합 (QR코드)
- [ ] ZXing 통합 (DataMatrix) — HTTPS 필수
- [ ] 카메라 직접 접근 (getUserMedia) — HTTPS 필수

## Phase 3 — AI 인식 (0.5일)
- [ ] Anthropic API 연동
- [ ] API 키 설정 UI
- [ ] 라벨 이미지 저장 (base64 썸네일)

## Phase 4 — 배포 및 마감 (0.5일)
- [ ] Netlify 배포
- [ ] PWA manifest (홈 화면 추가)
- [ ] 백업/복원

---

# 7. 주의사항 (삽질 방지)

## 환경 제약
- **`content://` 로컬 파일**: `getUserMedia` 카메라 API 차단됨 → HTTPS 필수
- **`content://` 로컬 파일**: 외부 CDN 스크립트 로드 차단됨 → Netlify 배포 필수
- **DataMatrix**: jsQR은 QR 전용, DataMatrix는 ZXing 사용 (HTTPS에서만 안정)

## ZXing 주의사항
- ZXing UMD 빌드를 HTML에 인라인 삽입 시 ES6 백틱 템플릿 리터럴 때문에 SyntaxError 발생
- esbuild로 번들링하거나 CDN 동적 로드 사용할 것
- **HTTPS 환경에서는 CDN 로드 그냥 사용 가능**: `https://cdn.jsdelivr.net/npm/@zxing/library/umd/index.min.js`

## 제품 구별
- 케어센스 에어(CGM-ST-002)와 바로젠핏(CGM-ST-003)은 외관이 매우 유사
- GTIN으로 구별하는 것이 가장 정확
- AI 프롬프트에 모델명 명시 필수

## GS1 날짜 파싱
- `(17)YYMMDD` 형식, DD=00이면 해당 월 말일
- YY < 50 → 20YY, YY >= 50 → 19YY
- 라벨에 `유효기간: 2026-07-25` 형태로 직접 표기된 경우도 파싱

## 데이터 마이그레이션
- 이전 버전(cgm_v1~v4) 데이터 자동 마이그레이션 필요
- Dexcom G6, libre3(→libre2로 rename) 처리
- wearDays 업데이트: caresens_air=15, barogen_fit=15, dexcom_g7=10
---

# 8. Claude 재개발 프롬프트

PC에서 Claude에게 붙여넣을 프롬프트입니다.

---

## 초기 프롬프트

```
CGM(연속혈당측정) 센서 재고 관리 웹앱 "CGMMgr"를 React + Vite로 새로 만들어줘.

## 환경
- Netlify 정적 호스팅 (HTTPS)
- Android Chrome 모바일 최적화
- localStorage로 데이터 저장 (서버 없음)

## 제품 목록
케어센스 에어(15일, GTIN:08809126640655, 모델:CGM-ST-002),
바로젠핏(15일, GTIN:08806712005959, 모델:CGM-ST-003),
Dexcom G7(10일), 파코링(15일), GS1 Sibionics(14일),
FreeStyle Libre 2(14일), 기타(14일)

## 핵심 기능
1. 대시보드: 현재 사용 센서 잔여일(프로그레스 바), 재고현황(4칸 그리드), 다음만료예정
2. 재고목록: 제품/상태 필터, 카드 리스트, 탭하면 상세모달
3. 센서추가:
   - 카메라 촬영 → AI 인식 (Anthropic API)
   - QR 인식 (jsQR CDN)
   - DataMatrix 인식 (ZXing CDN)
   - GS1 텍스트 붙여넣기 (예: (17)260725(10)250703B003)
   - 수동 입력 폼
4. 설정: 알림기준일, 제품관리, API키 입력, 백업/복원

## 제품 자동 구별 (중요)
GTIN → 모델명 → 브랜드텍스트 순으로 매칭
케어센스/CGM-ST-002 → caresens_air
Barozen/CGM-ST-003 → barogen_fit

## GS1 파싱
(17)YYMMDD → 유효기간, (10)xxx → 제조번호, (01)14자리 → GTIN
DD=00이면 해당월 말일, YY<50이면 20YY

## AI 프롬프트 (Anthropic API)
이미지를 받아 JSON으로 expiry(YYYY-MM-DD), lot, productName, serial, gtin 반환
케어센스/CGM-ST-002/08809126640655 → "케어센스 에어"
Barozen/CGM-ST-003/08806712005959 → "바로젠핏"

## UI 스펙
- 다크 테마 (#0d0d0d 배경)
- max-width 480px
- 하단 탭 네비게이션
- 센서 상태: 미개봉(파랑), 사용중(초록), 만료임박(주황), 만료(빨강)

## 데이터 구조
localStorage 'cgm_v5' 키에 저장:
{ sensorTypes: [...], inventory: [{id, typeId, lot, expiry, openedAt, notes, archived, createdAt, labelImg, serial}], settings: {alertDays: 30} }
API키는 별도로 'cgm_key'에 저장

먼저 프로젝트 구조와 package.json을 보여주고, 단계별로 구현해줘.
```

## 인식 기능 추가 프롬프트 (2단계)

```
센서 인식 기능을 추가해줘.

1. jsQR (CDN: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js)
   - canvas에 이미지 그려서 픽셀 데이터 추출
   - inversionAttempts: 'dontInvert', 'invertFirst' 두 가지 시도
   - 성공 시 parseGS1()로 파싱

2. ZXing DataMatrix (CDN: https://cdn.jsdelivr.net/npm/@zxing/library/umd/index.min.js)
   - DataMatrix 전용 hints 설정
   - HTMLCanvasElementLuminanceSource + HybridBinarizer 사용
   - 이진화 전처리: gray > 128 ? 255 : 0
   - 여러 크롭 영역 시도 (전체, 중간 띠, 왼쪽 절반 등)
   - 정반전 버전도 시도

3. Anthropic AI (https://api.anthropic.com/v1/messages)
   - 모델: claude-sonnet-4-20250514
   - 헤더: x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access: true
   - 라벨 하단 75% 크롭해서 base64로 전송
   - 응답에서 JSON 블록 추출 파싱

인식 순서: jsQR → ZXing → AI → 실패 시 붙여넣기 안내
```
