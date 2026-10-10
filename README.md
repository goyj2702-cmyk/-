# bio-spec · 생명과학 전공 스펙/공고 AI 비서

생명과학·바이오 전공 대학생을 위한 공고·자격증 큐레이션 대시보드예요.
프론트엔드(React + Vite + Tailwind)는 `public/data.json`만 읽고, 데이터는 매일 새벽 GitHub Actions가 갱신해요.

```
biospec-ai/
├─ .github/workflows/
│  ├─ update.yml        # 매일 03:00 KST: 크롤링 → data.json 커밋
│  └─ deploy.yml        # push / 데이터 갱신 완료 시 GitHub Pages 배포
├─ data/curated.json    # 사람이 검증한 데이터 (자격증·토익·기사 일정·핵심 공고)
├─ public/data.json     # 화면이 읽는 최종 데이터 (스크립트가 생성)
├─ scripts/update_data.py  # 크롤러 + 병합기 (표준 라이브러리만 사용)
└─ src/
   ├─ App.jsx           # 탭·토글·필터 상태
   ├─ hooks/useCurationData.js   # data.json fetch
   ├─ lib/utils.js      # D-Day·정렬·프로필 매칭
   └─ components/       # ProfileBar, AssistantBrief, ListView, CalendarView, CertView, ui
```

## 로컬 실행

```bash
npm install
npm run data:offline   # 네트워크 없이 curated → public/data.json 생성
npm run dev            # http://localhost:5173
```

크롤링까지 해보려면 `npm run data` (= `python3 scripts/update_data.py`)를 실행하세요.

## 배포 (GitHub Pages)

1. 이 폴더를 GitHub 저장소로 push
2. **Settings → Pages → Source: GitHub Actions** 선택
3. **Settings → Actions → General → Workflow permissions: Read and write** 선택 (data.json 커밋용)
4. Actions 탭에서 `Update data`를 한 번 수동 실행(Run workflow) → 이후 매일 자동

Vercel·Netlify를 쓴다면 deploy.yml은 지우고 저장소만 연결하세요. update.yml의 커밋이 push로 들어가면 자동 재배포돼요.

## 왜 CORS 문제가 없나요?

브라우저가 링커리어·씽유 같은 외부 사이트를 직접 호출하지 않아요.
크롤링은 GitHub Actions 서버에서 끝내고, 브라우저는 **같은 출처의 정적 파일** `data.json`만 읽어요.

## 데이터 흐름과 우선순위

```
data/curated.json ─┐
오늘 크롤링 결과 ───┼─▶ merge ─▶ public/data.json ─▶ React
직전 data.json ────┘   (같은 URL이면 curated 우선)
```

- 크롤링이 실패해도 직전 data.json의 항목을 유지해서 사이트가 비지 않아요.
- 크롤링 항목은 마감 후 30일이 지나면 자동으로 정리돼요 (`KEEP_CLOSED_DAYS`).
- 소스별 성공/실패는 `data.json`의 `meta.sources`에 기록돼요.

## 크롤링 가이드라인

**지켜야 할 것**
- `robots.txt`를 확인하고 허용된 경로만 수집해요 (스크립트에 구현됨, 못 읽으면 차단으로 간주).
- 요청 사이에 1.5초 지연, 1회 실행당 상세 페이지 60개 상한을 둬요.
- User-Agent에 봇임을 밝혀요. 로그인이 필요한 페이지나 API는 수집하지 마세요.
- 각 사이트의 **이용약관**을 직접 확인하세요. 상업적 재배포를 금지하는 곳은 제목·마감일·원문 링크만 쓰고 본문은 복제하지 마세요.

**새 소스 추가 방법** (`scripts/update_data.py`)
1. 아래 스키마의 dict 리스트를 돌려주는 함수를 작성해요.
2. `SCRAPERS = {"thinkyou": scrape_thinkyou, "my_source": scrape_my_source}`에 등록해요.

```json
{
  "id": "고유 ID", "cat": "채용|공모전|대외활동|교육|어학|자격증",
  "kind": "apply|exam|announce", "isBio": true,
  "title": "", "host": "", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD",
  "url": "원문 링크", "trust": "verified|caution",
  "grades": ["1학년","2학년","3학년","4학년","휴학생"], "tags": ["rnd","gmp","venture","ai","sales"],
  "note": "한 줄 메모", "source": "소스 이름"
}
```

**자동 분류 규칙** (스크립트 상단에서 수정)

| 규칙 | 기준 |
|---|---|
| 카테고리 | 제목에 `채용` → 채용공고, `교육·과정·아카데미…` → 교육, 그 외 경로(`contest`/`extAct`)로 구분 |
| 생명 계열 | 제목·주최에 `바이오·제약·의약·임상·GMP…` 포함 |
| 제외 | `토익·오픽·어린이·초등…` 포함 공고, 응모대상에 대학생이 없는 공고 |
| 신뢰 등급 | 주최가 정부부처·공단·진흥원·학회·대기업 패턴이면 ✅, 아니면 ⚠️ |

신뢰 등급은 패턴 기반이라 완벽하지 않아요. 중요한 공고는 `data/curated.json`에 직접 넣어 `trust`를 사람이 정해 주세요.

## 사람이 직접 관리하는 데이터 (`data/curated.json`)

자동 수집이 어렵거나 정확도가 중요한 데이터는 사람이 관리해요.

| 항목 | 갱신 시기 | 출처 |
|---|---|---|
| 기사·산업기사 일정 (`schedules.gisaCurrent/gisaNext`) | 매년 11~12월 시행계획 공고 후 | 큐넷 |
| 토익 정기시험 (`schedules.toeic` + 어학 items) | 매년 11월 초 다음 해 일정 발표 후 | 한국TOEIC위원회 |
| 자격증 카드 (`certs`) | 필요 시 | 큐넷, SOCRA 등 |

**2027년 기사 일정은 현재 '예상 시기'(`status: "expected"`)예요.** 공고가 나오면 `rows`를 확정 날짜로 바꾸고 `status`를 `"confirmed"`로 바꾸면 화면 뱃지도 '확정'으로 바뀌어요.
큐넷은 공공데이터포털(data.go.kr)에서 시험일정 Open API를 제공해요. 자동화하고 싶다면 API 키를 Actions Secret에 넣고 새 스크래퍼 함수로 연결하세요. 엔드포인트와 응답 필드는 포털의 최신 명세를 확인해야 해요.

## 'AI 비서' 브리핑에 대해

리스트 상단의 브리핑은 **규칙 기반 요약**이에요. 외부 AI API를 호출하지 않고, 프로필과 data.json으로 3일 내 마감, 다음 토익·기사 시험, 맞춤 공고 수를 계산해요.
LLM 요약을 붙이려면 update.yml에서 API 키(Secret)로 요약을 생성해 data.json의 `meta.brief`에 넣고, `AssistantBrief`가 그 값을 우선 보여주게 바꾸면 돼요. 키를 프론트엔드 코드에 넣으면 공개되니 주의하세요.
