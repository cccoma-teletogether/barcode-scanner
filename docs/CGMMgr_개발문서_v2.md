# CGMMgr 개발 문서 v2

> 최종 업데이트: 2026-06-08  
> 배포 URL: https://gregarious-stardust-f2d61d.netlify.app/

---

## 1. 제품 개요 (PRD)

### 목적
CGM(연속혈당측정) 센서 재고를 스마트폰에서 관리하는 개인용 웹앱.  
서버 없이 브라우저 localStorage에 데이터 저장, Netlify 정적 호스팅으로 배포.

### 사용자
- 당뇨 환자 본인 (1인 사용)
- Android Chrome, 한국어 UI

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 대시보드 | 현재 사용 센서 잔여일(프로그레스 바), 재고현황 4칸 그리드, 다음 만료 예정 |
| 재고목록 | 제품/상태 필터, 카드 리스트, 빠른 액션 버튼(사용시작/종료), 상세 모달 |
| 센서추가 | 카메라 촬영 → 자동인식, GS1 텍스트 붙여넣기, 수동 입력 |
| 설정 | 알림기준일, 제품관리, AI API 키 입력, 백업/복원 |
| 중복방지 | LOT + 제품종류 동일 시 경고 후 확인 |

---

## 2. 제품 데이터

| 제품명 | ID | 착용일수 | GTIN | 모델 | 색상 |
|--------|-----|---------|------|------|------|
| 케어센스 에어 | caresens_air | 15일 | 08809126640655 | CGM-ST-002 | #00c6fb |
| 바로젠핏 | barogen_fit | 15일 | 08806712005959 | CGM-ST-003 | #43e97b |
| Dexcom G7 | dexcom_g7 | 10일 | 00386270000467 | — | #f7971e |
| 파코링(피코링) | fakoring | 15일 | 06958590313168 | — | #f953c6 |
| GS1 (Sibionics) | gs1 | 14일 | 06972831642299 | — | #a78bfa |
| FreeStyle Libre 2 | libre2 | 14일 | — | — | #38bdf8 |
| 기타/커스텀 | custom | 14일 | — | — | #94a3b8 |

### 제품 자동 구별 로직 (3단계)
1. **GTIN 코드** (가장 정확) — DataMatrix/QR에서 추출
2. **모델명** — CGM-ST-002 → 케어센스 에어, CGM-ST-003 → 바로젠핏
3. **브랜드 텍스트** — 케어센스/caresens, Barozen/barozen

---

## 3. 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | 순수 바닐라 JavaScript (프레임워크 없음) |
| 번들링 | 단일 HTML 파일 (라이브러리 인라인 내장) |
| 스타일 | CSS-in-JS (style 객체) |
| 데이터 | localStorage (`cgm_v5` 키) |
| 배포 | Netlify 정적 호스팅 (HTTPS) |
| 인식 라이브러리 | jsQR (QR), ZXing/esbuild (DataMatrix), Anthropic API (AI) |

### 파일 구성
```
cgm-manager.html   # 메인 앱 (약 700KB, 라이브러리 인라인 포함)
manifest.json      # PWA 메타 정보
netlify.toml       # Netlify 헤더 설정
```

---

## 4. 아키텍처

### 상태(State) 구조
```javascript
// localStorage 'cgm_v5'
{
  sensorTypes: [{
    id, name, wearDays, color, gtin, model
  }],
  inventory: [{
    id,        // uid()로 생성
    typeId,    // sensorTypes[].id 참조
    lot,       // 제조번호
    expiry,    // 유효기간 YYYY-MM-DD
    openedAt,  // 부착일 YYYY-MM-DD (null이면 미개봉)
    notes,     // 메모
    archived,  // 보관 처리 여부
    createdAt, // 등록일
    labelImg,  // 라벨 사진 base64 (하단 75% 크롭)
    serial     // 시리얼 번호
  }],
  settings: { alertDays: 30 }
}

// 별도 저장
localStorage 'cgm_key'  // Anthropic API 키
```

### 센서 상태 정의
| 상태 | 조건 | 색상 |
|------|------|------|
| 미개봉 | openedAt=null, 만료 아님 | #00c6fb (파랑) |
| 사용중 | openedAt 있음 | #43e97b (초록) |
| 만료임박 | D-N일 이하 (설정값) | #f7971e (주황) |
| 만료 | daysUntil < 0 | #ff4d4d (빨강) |
| 보관 | archived=true | #888 (회색) |

### DOM 헬퍼 함수
```javascript
// 요소 생성
el(tag, props, ...children)
// SVG 요소 생성
sv(tag, attrs, ...children)
// 모달 열기/닫기
openModal(contentEl)
closeModal()
// 토스트 메시지
toast(message, type='ok'|'err')
```

---

## 5. 바코드 인식 플로우

```
사진 선택 (카메라 촬영 or 갤러리)
  ↓
이미지 → base64 변환
라벨 이미지 크롭 (하단 75%)
  ↓
1단계: jsQR (QR코드 전용)
   - 전체 이미지 800px 축소
   - 전체 이미지 원본
   - 90°/180°/270° 회전
   - 4등분 크롭
   → 성공 시 즉시 완료
  ↓ 실패
2단계: ZXing (DataMatrix 전용)
   - 이진화 전처리 (gray > 128 ? 255 : 0)
   - 3단계 시도 (전체→확대→위치추정크롭)
   - 정방향 + 반전 각각 시도
   → 성공 시 즉시 완료
  ↓ 실패
3단계: AI (Anthropic API)
   - API 키 있을 때만 실행
   - claude-sonnet-4-20250514 모델
   - 라벨 이미지 base64 전송
   → 성공 시 완료
  ↓ 실패 또는 API 키 없음
4단계: GS1 텍스트 붙여넣기 안내
   - (17)YYMMDD(10)LOT 형태 직접 입력
   - 자동 파싱
  ↓
5단계: 수동 입력 (날짜 선택기)
```

---

## 6. GS1 파서

### parseGS1(rawString)
DataMatrix/QR에서 읽은 원시 문자열 파싱.

```
입력 예: "01088091266406551726072910250701C001"
출력:    { gtin:"08809126640655", expiry:"2026-07-29", lot:"250701C001" }
```

| AI 코드 | 키 | 길이 | 설명 |
|---------|-----|------|------|
| (01) | gtin | 14 | GTIN |
| (11) | mfg | 6 | 제조일자 YYMMDD |
| (17) | expiry | 6 | 유효기간 YYMMDD |
| (10) | lot | 가변 | 제조번호 |
| (21) | serial | 가변 | 시리얼 |

### parseText(string)
라벨 텍스트에서 GS1 패턴 정규식 추출 (붙여넣기용).

```
입력: "(17)260729(10)250701C001"
출력: { expiry:"2026-07-29", lot:"250701C001" }
```

### yymmddToDate(YYMMDD)
- YY < 50 → 20YY, YY ≥ 50 → 19YY
- DD = 00 → 해당 월 말일

---

## 7. AI 인식 프롬프트

```
CGM 센서 포장 라벨입니다. JSON만 반환. 다른 텍스트 없이.

제품명 구별 규칙:
- "케어센스" 또는 "CGM-ST-002" 또는 GTIN 08809126640655 → "케어센스 에어"
- "Barozen" 또는 "CGM-ST-003" 또는 GTIN 08806712005959 → "바로젠핏"
- "dexcom" 또는 "G7" → "Dexcom G7"
- "FreeStyle" 또는 "Libre" → "FreeStyle Libre 2"
- "Sibionics" 또는 "GS1" → "GS1 (Sibionics)"
- "피코링" 또는 "Picoling" → "파코링(피코링)"

유효기간: (17)YYMMDD → YYYY-MM-DD, 또는 유효기간: 직접 표기
제조번호: (10) 또는 제조번호: 뒤 코드

반환:
{
  "expiry": "YYYY-MM-DD 또는 빈 문자열",
  "lot": "제조번호 또는 빈 문자열",
  "productName": "제품명 또는 빈 문자열",
  "serial": "시리얼 또는 빈 문자열",
  "gtin": "14자리 또는 빈 문자열"
}
```

---

## 8. 주요 개발 이슈 및 해결

### 8-1. ZXing 인라인 삽입 SyntaxError
**문제**: ZXing UMD 번들에 ES6 백틱(템플릿 리터럴) 17개 포함 → Android Chrome에서 SyntaxError  
**시도 1**: 백틱을 ```으로 치환 → 일부 케이스에서 여전히 파싱 에러  
**시도 2**: 템플릿 리터럴을 문자열 연결로 수동 변환 → 복잡한 표현식에서 실패  
**최종 해결**: esbuild로 ZXing을 ES2015 IIFE 번들로 재컴파일 → 문법 검증 통과

```bash
esbuild zxing_entry.js --bundle --format=iife --target=es2015 --minify --outfile=zxing_min.js
```

### 8-2. jsQR window 등록 실패
**문제**: jsQR UMD 마지막 호출 `})(typeof self !== 'undefined' ? self : this, factory)` 를 `})(window)` 로 잘못 패치 → factory 자리에 window가 들어가 TypeError  
**해결**: 원본 UMD 그대로 유지 + 실행 후 별도 등록

```javascript
if(typeof self!=='undefined'&&self.jsQR) window.jsQR=self.jsQR;
```

### 8-3. content:// 로컬 파일 환경 제약
| 기능 | content:// | HTTPS |
|------|-----------|-------|
| getUserMedia 카메라 | ❌ 차단 | ✅ 가능 |
| 외부 CDN 로드 | ❌ 차단 | ✅ 가능 |
| Anthropic API 호출 | ❌ CORS | ✅ 가능 |
| localStorage | ✅ 가능 | ✅ 가능 |
| input[capture] 카메라 | ✅ 가능 | ✅ 가능 |

**해결**: Netlify 배포 → HTTPS 환경

### 8-4. DataMatrix 인식 실패 (미해결)
**문제**: 케어센스 에어, 바로젠핏 라벨이 DataMatrix 형식 → jsQR(QR 전용) 인식 불가  
**ZXing 시도**: HTTPS 환경에서 로드는 되지만 실제 decode 성공률 낮음  
**현실적 대안**:
- GS1 텍스트 붙여넣기: `(17)260729(10)250701C001`
- AI API 키 등록 후 AI 인식 (건당 약 5원)

### 8-5. el() 함수 null 자식 에러
**문제**: `el('div', null, condition ? el(...) : null)` 형태에서 `null`이 `flat()`으로 처리되지 않고 `appendChild(null)` 호출 → TypeError  
**해결**: `openDetail` 함수를 `el()` 대신 `createElement` + `appendChild` 직접 사용으로 재작성

### 8-6. 부착일 변경 즉시 저장 문제
**문제**: `<input type="date">` onchange 이벤트가 날짜 선택 즉시 발화 → 모달 닫힘  
**해결**: onchange 이벤트 제거, 별도 [저장] 버튼으로만 저장

---

## 9. UI 컴포넌트 구조

```
App (#app)
├── Header (날짜 표시, sticky)
├── Main (탭 콘텐츠)
│   ├── Dashboard
│   │   ├── 현재 사용 센서 카드 (프로그레스 바)
│   │   ├── 재고현황 2×2 그리드
│   │   ├── 다음 만료 예정 카드
│   │   └── 제품별 재고 리스트
│   ├── Inventory
│   │   ├── 필터 (제품종류 / 상태)
│   │   └── 센서 카드 목록
│   │       ├── 정보 영역 (탭 → 상세 모달)
│   │       └── 빠른 액션 버튼 (사용시작/종료/상세)
│   ├── AddForm
│   │   ├── 카메라 스캔 섹션
│   │   │   ├── 프리뷰 영역
│   │   │   ├── 📷 카메라로 촬영 버튼
│   │   │   └── 🖼 갤러리에서 선택 버튼
│   │   ├── GS1 코드 붙여넣기 섹션
│   │   └── 수동 입력 폼
│   │       ├── 제품 종류 select
│   │       ├── 추가 수량 number
│   │       ├── 유효기간 date (필수)
│   │       ├── 제조번호 text
│   │       ├── 메모 textarea
│   │       └── + N개 추가 버튼 (중복체크 포함)
│   └── Settings
│       ├── 알림기준일 설정
│       ├── CGM 제품 관리 (추가/삭제)
│       ├── AI API 키 입력
│       └── 백업/복원
└── BottomNav (대시보드/재고목록/센서추가/설정)

DetailModal (하단 슬라이드업)
├── 제품명 + 닫기 버튼
├── 상태 배지
├── 정보 테이블 (유효기간, 제조번호, 등록일, 시리얼, 메모, 센서종료일)
├── 부착일 편집 (날짜선택 + [저장] + [초기화])
├── 라벨 이미지 (있을 경우)
└── 액션 버튼 (사용시작/종료, 보관처리, 삭제)
```

---

## 10. 재개발 시 Claude 프롬프트

### 초기 프롬프트

```
CGM 센서 재고 관리 웹앱 "CGMMgr"를 React + Vite로 만들어줘.
Netlify HTTPS 배포, Android Chrome 최적화, localStorage 저장 (서버 없음).

제품 목록:
케어센스 에어(15일, GTIN:08809126640655, CGM-ST-002, #00c6fb)
바로젠핏(15일, GTIN:08806712005959, CGM-ST-003, #43e97b)
Dexcom G7(10일, GTIN:00386270000467, #f7971e)
파코링(15일, GTIN:06958590313168, #f953c6)
GS1 Sibionics(14일, GTIN:06972831642299, #a78bfa)
FreeStyle Libre 2(14일, #38bdf8)
기타(14일, #94a3b8)

핵심 기능:
1. 대시보드: 현재 사용 센서 잔여일(프로그레스 바), 재고현황 4칸 그리드
2. 재고목록: 필터, 카드, 빠른 액션 버튼(사용시작/종료), 상세 모달
3. 센서추가: 카메라→AI인식, GS1 텍스트 붙여넣기, 수동입력, 중복체크(LOT+제품 동일)
4. 설정: 알림기준일, 제품관리, Anthropic API 키, 백업/복원

제품 자동 구별: GTIN → 모델명 → 브랜드텍스트 순 매칭
GS1 파싱: (17)YYMMDD→유효기간, (10)→LOT, (01)14자리→GTIN, DD=00은 말일

상태: 미개봉(파랑), 사용중(초록), 만료임박(주황), 만료(빨강), 보관(회색)
localStorage 'cgm_v5': { sensorTypes, inventory, settings:{alertDays:30} }
API 키: localStorage 'cgm_key' 별도 저장

UI: 다크 테마(#0d0d0d), max-width 480px, 하단 탭 네비게이션
부착일(openedAt) 변경 시 저장 버튼으로만 저장 (즉시 저장 금지)
```

### 바코드 인식 추가 프롬프트

```
센서 인식 기능 추가:

1. jsQR (CDN: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js)
   QR코드 전용. inversionAttempts 'dontInvert'/'invertFirst' 시도.

2. ZXing DataMatrix (esbuild 번들 필요)
   npm install @zxing/library
   esbuild로 IIFE 번들 후 인라인 삽입:
   esbuild entry.js --bundle --format=iife --target=es2015 --minify
   entry.js: import * as ZXing from '@zxing/library'; window.ZXing = ZXing;
   이진화 전처리: gray > 128 ? 255 : 0 적용 후 decode

3. Anthropic AI
   모델: claude-sonnet-4-20250514
   헤더: x-api-key, anthropic-version: 2023-06-01
         anthropic-dangerous-direct-browser-access: true
   라벨 하단 75% 크롭 → base64 → API 전송
   응답에서 JSON 블록 추출 파싱

인식 순서: jsQR → ZXing → AI → GS1 텍스트 붙여넣기 안내
```

---

## 11. 로컬 개발 환경 재현

```bash
# 1. jsQR 설치
npm install jsqr

# 2. ZXing esbuild 번들 생성
npm install @zxing/library esbuild

cat > zxing_entry.js << 'EOF'
import * as ZXing from '@zxing/library';
window.ZXing = ZXing;
EOF

npx esbuild zxing_entry.js \
  --bundle --format=iife --target=es2015 \
  --minify --outfile=zxing_min.js

# 3. HTML 빌드 스크립트 실행
python3 write_app.py   # 앱 기본 코드 생성
python3 build.py       # jsQR + ZXing 인라인 삽입

# 4. 문법 검증
node -e "
const html = require('fs').readFileSync('cgm-manager.html','utf8');
[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>{
  try{new Function(m[1]);console.log('블록'+(i+1)+':OK');}
  catch(e){console.log('블록'+(i+1)+':ERR',e.message);}
});
"
```
