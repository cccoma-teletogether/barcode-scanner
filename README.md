# CGMMgr — CGM 센서 재고 관리 웹앱

CGM(연속혈당측정) 센서 재고를 스마트폰에서 관리하는 개인용 PWA입니다.  
서버 없이 브라우저 `localStorage`에 데이터를 저장하며, GitHub Pages / Netlify 등 정적 호스팅으로 배포합니다.

---

## 주요 기능

| 탭 | 기능 |
|----|------|
| **대시보드** | 현재 사용 센서 잔여일·프로그레스 바, 재고 현황 4칸 그리드, 우선 사용 대상 목록 |
| **재고 목록** | 센서 종류·상태 필터, 유효기간·S/N 표시, 상세/수정/삭제 |
| **센서 추가** | 카메라 촬영 → 자동 인식 or 수동 입력 |
| **사용계획** | 월별 달력에 센서 사용 구간 시각화, 드래그로 날짜 변경 |
| **작업기록** | changelog.md 기반 변경 이력 표시 |
| **설정** | 알림 기준일, 센서 종류 관리, AI API 키, 백업/복원 |

---

## 센서 인식 파이프라인

이미지를 촬영하거나 업로드하면 아래 순서로 자동 인식합니다.

```
1. jsQR        — QR코드 인식 (~100ms)        Dexcom G7 등
2. ZXing-wasm  — DataMatrix 인식 (~500ms)    CareSens Air, Barozen Fit 등
3. Anthropic   — AI 이미지 인식 (~3초)        모든 라벨 범용 (API 키 필요)
4. GS1 붙여넣기 — 텍스트 직접 입력            예: (17)260725(10)250701C001
5. 수동 입력   — 날짜·S/N 직접 선택
```

---

## 지원 센서

| 제품명 | 착용 기간 | GTIN |
|--------|----------|------|
| CareSens Air | 15일 | 08809126640655 |
| Barozen Fit | 15일 | 08806712005959 |
| Dexcom G7 | 10일 | 00386270004673 |
| 피코링 / Picoling | 15일 | 06958590313168 |
| GS1 (Sibionics) | 14일 | 06972831642299 |
| FreeStyle Libre 2 | 14일 | — |

설정 탭에서 커스텀 센서 종류를 추가할 수 있습니다.

---

## 데이터 구조

`localStorage` 키 `cgm_v5`에 JSON으로 저장됩니다.

```json
{
  "sensorTypes": [{ "id", "name", "wearDays", "color", "gtin", "model" }],
  "inventory": [{
    "id", "typeId", "lot", "serial", "expiry",
    "openedAt", "notes", "archived", "createdAt", "labelImg"
  }],
  "plans": [{ "id", "invId", "typeId", "startDate", "createdAt" }],
  "settings": { "alertDays": 30 }
}
```

Anthropic API 키는 별도로 `cgm_key` 키에 저장됩니다.

---

## 로컬 실행

Python 서버를 사용합니다 (HTTPS 없이 카메라·ZXing 기능은 제한됩니다).

```bash
python server.py
# 또는
run.bat
```

브라우저에서 `http://localhost:8000/cgm-manager.html` 접속

> **카메라 직접 접근 / DataMatrix 인식 / AI 인식은 HTTPS 환경 필수입니다.**  
> 전체 기능을 사용하려면 아래 배포 환경을 이용하세요.

---

## 배포

GitHub Pages 또는 Netlify 정적 호스팅으로 배포합니다. `cgm-manager.html` 단일 파일이 앱 본체입니다.

```
https://<your-domain>/cgm-manager.html
```

---

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| QR 인식 | [jsQR](https://github.com/cozmo/jsQR) |
| DataMatrix 인식 | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), [@zxing/library](https://github.com/zxing-js/library) |
| AI 이미지 인식 | [Anthropic API](https://www.anthropic.com/) (claude-sonnet) |
| 데이터 저장 | Browser localStorage |
| 호스팅 | GitHub Pages / Netlify |

---

## 주의사항

- **ZXing**: HTTPS 환경에서만 안정적으로 동작합니다.
- **CareSens Air vs Barozen Fit**: 외관이 유사하므로 GTIN → 모델명 → 브랜드 텍스트 순으로 자동 구별합니다.
- **GS1 날짜**: `(17)YYMMDD` 형식, DD=00이면 해당 월 말일, YY<50이면 20YY로 처리합니다.
- **이전 데이터**: `cgm_v1`~`cgm_v4` 저장 데이터는 자동 마이그레이션됩니다.

---

## 변경 이력

[changelog.md](./changelog.md) 참조
