#!/usr/bin/env python3
"""
bio-spec AI 비서 — 데이터 갱신 스크립트

curated.json(사람이 검증한 데이터) + 크롤링 결과를 병합해
data.json 을 만든다. GitHub Actions에서 매일 새벽 실행된다.

  python update_data.py            # 크롤링 + 병합
  python update_data.py --offline  # 네트워크 없이 병합만 (로컬 테스트용)

설계 원칙
- 표준 라이브러리만 사용 (pip 설치 불필요)
- robots.txt를 확인하고 허용된 경로만, 요청 사이 지연을 두고 정중하게 수집
- 크롤링이 실패해도 사이트가 비지 않도록: curated + 직전 data.json의 유효 항목을 유지
- 사람이 검증한 curated 항목이 크롤링 항목보다 항상 우선 (같은 URL이면 curated 사용)
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent  # 모든 파일이 한 폴더(저장소 루트)에 있는 구조
CURATED = ROOT / "curated.json"
OUTPUT = ROOT / "data.json"

KST = timezone(timedelta(hours=9))
UA = "bio-spec-curation-bot/1.0 (+https://github.com/; daily, polite)"
REQUEST_DELAY_SEC = 1.5
MAX_DETAIL_PAGES = 60          # 한 번 실행에 방문할 상세 페이지 상한
KEEP_CLOSED_DAYS = 30          # 마감 후 며칠까지 '마감' 상태로 보여줄지
ALL_GRADES = ["1학년", "2학년", "3학년", "4학년", "휴학생"]

# ------------------------------------------------------------------ #
#  분류 규칙
# ------------------------------------------------------------------ #

BIO_KEYWORDS = ["바이오", "생명", "제약", "의약", "신약", "헬스", "의료", "보건", "임상", "GMP",
                "유전", "세포", "미생물", "식품", "화학", "생물", "백신", "진단"]
EXCLUDE_KEYWORDS = ["토익", "TOEIC", "토스", "오픽", "어린이", "초등", "유아", "중학생", "고등학생 대상"]
EDU_KEYWORDS = ["교육", "과정", "아카데미", "부트캠프", "양성", "캠프", "스쿨", "특강"]
JOB_KEYWORDS = ["채용", "신입사원", "공개채용", "경력사원"]
STUDENT_TARGET_HINTS = ["대학", "누구나", "제한없음", "제한 없음", "일반", "청년", "국민"]

TAG_RULES = {
    "rnd": ["연구", "R&D", "신약", "실험", "논문", "과학"],
    "gmp": ["GMP", "품질", "생산", "공정", "안전", "제조"],
    "venture": ["창업", "스타트업", "사업화", "벤처"],
    "ai": ["AI", "인공지능", "데이터", "빅데이터", "디지털", "해커톤"],
    "sales": ["마케팅", "홍보", "서포터즈", "광고", "콘텐츠", "영상", "숏폼", "브랜드"],
}

# 주최처가 이 패턴에 맞으면 ✅ 공신력 인증, 아니면 ⚠️ 주의/비공식
TRUSTED_HOST = re.compile(
    r"(부|처|청|원|공단|공사|진흥원|재단|협회|학회|위원회|대학교|연구원|공제회|은행|그룹|"
    r"삼성|LG|SK|현대|롯데|CJ|한화|포스코|GS|KT|네이버|카카오|넷마블|효성|DB)"
)


def classify(title: str, host: str, path_kind: str) -> dict:
    text = f"{title} {host}"
    if any(k in text for k in JOB_KEYWORDS):
        cat = "채용"
    elif any(k in title for k in EDU_KEYWORDS):
        cat = "교육"
    else:
        cat = "공모전" if path_kind == "contest" else "대외활동"
    tags = [tag for tag, kws in TAG_RULES.items() if any(k in text for k in kws)]
    return {
        "cat": cat,
        "isBio": any(k in text for k in BIO_KEYWORDS),
        "tags": tags,
        "trust": "verified" if host and TRUSTED_HOST.search(host) else "caution",
    }


# ------------------------------------------------------------------ #
#  HTTP 유틸
# ------------------------------------------------------------------ #

_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


def allowed(url: str) -> bool:
    base = re.match(r"https?://[^/]+", url).group(0)
    if base not in _robots_cache:
        rp = urllib.robotparser.RobotFileParser(base + "/robots.txt")
        try:
            rp.read()
        except Exception:
            rp = None  # robots.txt를 못 읽으면 보수적으로 차단
        _robots_cache[base] = rp
    rp = _robots_cache[base]
    return bool(rp and rp.can_fetch(UA, url))


def get(url: str) -> str:
    if not allowed(url):
        raise PermissionError(f"robots.txt disallows {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko"})
    with urllib.request.urlopen(req, timeout=20) as res:
        charset = res.headers.get_content_charset() or "utf-8"
        body = res.read().decode(charset, errors="replace")
    time.sleep(REQUEST_DELAY_SEC)
    return body


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|dd|dt|h\d)>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"[ \t ]+", " ", text)


# ------------------------------------------------------------------ #
#  소스 1: 씽유 (thinkyou.co.kr) 공모전·대외활동
#  - 목록: 메인 페이지에서 /contest/{id}, /extAct/{id} 링크 수집
#  - 상세: 텍스트에서 '주최', '접수기간 YYYY-MM-DD ~ YYYY-MM-DD', '응모대상'을 정규식으로 추출
#  ※ 사이트 구조가 바뀌면 이 함수의 정규식만 고치면 됩니다.
# ------------------------------------------------------------------ #

THINKYOU = "https://thinkyou.co.kr/"
RE_LINK = re.compile(r'href="(/(contest|extAct)/(\d+)/?)"')
RE_PERIOD = re.compile(r"접수기간\s*:?\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})")
RE_HOST = re.compile(r"주최\s*:?\s*\n?\s*([^\n]{2,60})")
RE_TARGET = re.compile(r"응모대상\s*:?\s*\n?\s*([^\n]{2,80})")
RE_TITLE = re.compile(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', re.I)


def scrape_thinkyou(log: list) -> list[dict]:
    listing = get(THINKYOU)
    seen, links = set(), []
    for href, kind, num in RE_LINK.findall(listing):
        if num not in seen:
            seen.add(num)
            links.append((urljoin(THINKYOU, href), kind, num))
    log.append(f"thinkyou: {len(links)} links found")

    items = []
    for url, kind, num in links[:MAX_DETAIL_PAGES]:
        try:
            raw = get(url)
        except Exception as e:  # 개별 실패는 건너뜀
            log.append(f"thinkyou: skip {url} ({e})")
            continue
        text = html_to_text(raw)
        period = RE_PERIOD.search(text)
        if not period:
            continue
        m_title = RE_TITLE.search(raw)
        title = html.unescape(m_title.group(1)).split("|")[0].strip() if m_title else ""
        host = (RE_HOST.search(text).group(1).strip() if RE_HOST.search(text) else "")
        target = (RE_TARGET.search(text).group(1) if RE_TARGET.search(text) else "")
        if not title or any(k in title for k in EXCLUDE_KEYWORDS):
            continue
        if target and not any(h in target for h in STUDENT_TARGET_HINTS):
            continue  # 대학생이 참여할 수 없는 공고 제외
        c = classify(title, host, kind)
        items.append({
            "id": f"ty-{kind}-{num}",
            "cat": c["cat"],
            "kind": "apply",
            "isBio": c["isBio"],
            "title": title,
            "host": host or "주최 정보 없음",
            "start": period.group(1),
            "end": period.group(2),
            "url": url,
            "trust": c["trust"] if host else "caution",
            "grades": ALL_GRADES,
            "tags": c["tags"],
            "note": "씽유 공고 원문" + ("" if c["trust"] == "verified" else " · 주최 규모를 확인하세요"),
            "source": "thinkyou",
        })
    log.append(f"thinkyou: {len(items)} items parsed")
    return items


# 새 소스를 추가하려면: 함수를 만들고 SCRAPERS에 등록하세요.
# 각 함수는 위 스키마의 dict 리스트를 돌려주면 됩니다.
SCRAPERS = {"thinkyou": scrape_thinkyou}


# ------------------------------------------------------------------ #
#  병합
# ------------------------------------------------------------------ #

def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def is_stale(item: dict, today: date) -> bool:
    if item.get("always") or not item.get("end"):
        return False
    try:
        end = date.fromisoformat(item["end"])
    except ValueError:
        return True
    return end < today - timedelta(days=KEEP_CLOSED_DAYS)


def merge(curated: dict, scraped: list[dict], previous: dict, today: date) -> list[dict]:
    by_url: dict[str, dict] = {}
    # 1) 직전 실행의 크롤링 항목 (오늘 크롤링이 실패해도 유지)
    for it in previous.get("items", []):
        if it.get("source") not in (None, "curated"):
            by_url[it["url"]] = it
    # 2) 오늘 크롤링 결과로 덮어쓰기
    for it in scraped:
        by_url[it["url"]] = it
    # 3) 사람이 검증한 curated가 최우선
    curated_items = curated.get("items", [])
    curated_urls_ids = {(it["url"], it["id"]) for it in curated_items}
    curated_urls = {u for u, _ in curated_urls_ids}
    merged = list(curated_items) + [it for u, it in by_url.items() if u not in curated_urls]
    # curated는 날짜가 지나도 남김(캘린더·이력용), 크롤링 항목만 오래된 것 정리
    kept = [it for it in merged if it.get("source") == "curated" or not is_stale(it, today)]
    return stamp_first_seen(kept, previous, today)


def stamp_first_seen(items: list[dict], previous: dict, today: date) -> list[dict]:
    """
    'NEW' 뱃지용: 각 공고가 data.json에 처음 들어온 날짜(firstSeen)를 기록한다.
    - 직전 data.json에 같은 id가 있으면 그 firstSeen을 그대로 이어받음
    - 직전 파일에 firstSeen이 없던 시절의 항목(최초 도입 시)은 접수 시작일과
      직전 갱신일 중 이른 날짜로 채워, 기존 공고가 한꺼번에 NEW로 뜨지 않게 함
    - 처음 보는 id는 오늘 날짜
    """
    prev_items = {it.get("id"): it for it in previous.get("items", [])}
    prev_updated = (previous.get("meta", {}).get("updatedAt") or "")[:10]
    out = []
    for it in items:
        it = dict(it)
        before = prev_items.get(it.get("id"))
        if before and before.get("firstSeen"):
            it["firstSeen"] = before["firstSeen"]
        elif before:
            candidates = [d for d in (it.get("start"), prev_updated) if d]
            it["firstSeen"] = min(candidates) if candidates else today.isoformat()
        else:
            it["firstSeen"] = today.isoformat()
        out.append(it)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="크롤링 없이 병합만 수행")
    args = ap.parse_args()

    now = datetime.now(KST)
    curated = load_json(CURATED, None)
    if curated is None:
        print("curated.json을 읽을 수 없습니다.", file=sys.stderr)
        return 1
    previous = load_json(OUTPUT, {})

    log, scraped, status = [], [], {}
    if not args.offline:
        for name, fn in SCRAPERS.items():
            try:
                got = fn(log)
                scraped += got
                status[name] = {"ok": True, "count": len(got)}
            except Exception as e:
                status[name] = {"ok": False, "error": str(e)[:200]}
                log.append(f"{name}: FAILED {e}")

    items = merge(curated, scraped, previous, now.date())
    out = {
        "meta": {
            "updatedAt": now.isoformat(timespec="minutes"),
            "itemCount": len(items),
            "sources": status or {"offline": {"ok": True, "count": 0}},
        },
        "items": items,
        "certs": curated.get("certs", []),
        "schedules": curated.get("schedules", {}),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for line in log:
        print(line)
    print(f"wrote {OUTPUT.relative_to(ROOT)}: {len(items)} items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
