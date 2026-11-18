#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_data.py  —  공고 자동 수집 · 정규화 · 생명/보건 분류 · 병합 (파이썬 기본 라이브러리만 사용)

실행 흐름
  1) curated.json(사람이 검수한 공고/자격증/일정)을 읽는다
  2) 여러 사이트(링커리어/씽유/캠퍼스픽/위비티)를 '사이트별로 독립 실행' (한 곳이 죽어도 나머지는 계속)
  3) 사이트마다 다른 데이터를 normalize()로 '같은 모양의 공고 객체'로 통일
  4) bio_classify()로 생명/보건 계열 여부를 엄격하게 판정 (다중 키워드 가중치)
  5) 병합(curated > 크롤링) → 제목 중복 제거 → NEW 표시용 firstSeen 기록 → data.json 저장

★ 키워드를 고치고 싶다면 아래 [A. 키워드 설정] 구역만 수정하세요. 다른 곳은 건드릴 필요 없습니다.
"""
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import date, datetime, timedelta, timezone
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CURATED = ROOT / "curated.json"
OUTPUT = ROOT / "data.json"

KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).date()

UA = "Mozilla/5.0 (compatible; BioSpecCurationBot/1.0; personal non-commercial project)"
REQUEST_DELAY = 1.5        # 요청 사이 대기(초) — 사이트에 부담을 주지 않기 위함
TIMEOUT = 20               # 요청 한 번당 최대 대기(초)
MAX_LIST_LINKS = 30        # 사이트·목록 1개당 읽을 최대 공고 수
MAX_DETAIL_PAGES = 40      # 사이트 1개당 상세페이지 최대 방문 수
KEEP_CLOSED_DAYS = 30      # 마감 후 이 기간이 지난 크롤링 공고는 삭제
CARRY_OVER_DAYS = 7        # 사이트 수집이 통째로 실패하면, 지난 데이터를 이 기간까지 유지
NEW_DAYS = 3               # (프론트와 동일) 처음 발견 후 3일간 NEW
GRADES_ALL = [1, 2, 3, 4, "휴학"]   # 크롤링 공고의 기본 대상 학년. 프론트의 학년 값 형식에 맞추세요.

# ═══════════════════════════════════════════════════════════════════════
# [A. 키워드 설정]  ← 여기만 고치면 됩니다. 한글은 부분일치, 영문은 단어 단위로 일치합니다.
# ═══════════════════════════════════════════════════════════════════════

# (1) 강한 키워드: 이 단어가 '제목 또는 해시태그'에 있어야 생명/보건 계열로 인정됩니다.
#     "이 단어가 보이면 거의 확실히 생명/보건 분야"인 것만 넣으세요.
STRONG_KEYWORDS = [
    # 생명·바이오
    "바이오", "의생명", "생명과학", "생명공학", "생물학", "분자생물", "합성생물", "미생물",
    "유전자", "유전체", "게놈", "크리스퍼", "광유전학", "뇌과학", "신경과학", "줄기세포",
    "세포치료", "오가노이드", "단백질", "항체", "백신", "감염병",
    "re:생태(?!계)",   # "생태조사/생태학"은 인정, "○○ 생태계"는 제외 (정규식은 앞에 re: 를 붙입니다)
    # 제약·의료
    "제약", "신약", "의약", "약학", "의료기기", "의공학", "진단키트", "임상", "식약처", "GMP",
    # 보건·헬스케어
    "보건", "헬스케어", "디지털헬스", "공중보건",
    # 영문 (대소문자 무시, 단어 단위)
    "bio", "biotech", "biohealth", "bioinformatics", "pharma", "pharmaceutical",
    "healthcare", "genome", "crispr", "clinical", "neuroscience",
]

# (2) 약한 키워드: 혼자서는 절대 통과하지 못하고, 강한 키워드를 '보조'할 때만 점수에 더해집니다.
WEAK_KEYWORDS = [
    "생명", "생태계", "의료", "의학", "건강", "질병", "치료", "환자", "진단", "병원",
    "연구소", "실험", "화학", "식품", "동물", "환경",
]

# (3) 오탐 방지 문구: 아래 문구는 검사 전에 지워버립니다. (예: '생명보험'의 '생명', 'IT 생태계'의 '생태')
MASK_PHRASES = [
    r"[가-힣A-Za-z]{0,4}생명(?:보험|화재|금융|보험사)", r"(?:삼성|한화|교보|신한|농협|흥국|동양|ABL|DB|KDB|푸본현대)생명",
    r"생명(?:줄|선)", r"생명\s*존중\s*(?:캠페인|문화)",
    r"(?:스타트업|창업|산업|혁신|플랫폼|디지털|콘텐츠|문화|지역|AI|IT|게임|웹툰|브랜드|상권|벤처|투자|금융)\s*생태계",
    r"생태\s*계\s*(?:조성|구축|활성화)",
]

# (4) 점수 규칙 — 필드별 배율 × 키워드 가중치
WEIGHT_STRONG = 3.0
WEIGHT_WEAK = 1.0
FIELD_MULT = {"title": 2.0, "tags": 2.0, "host": 1.5, "body": 0.5}
PASS_SCORE = 6.0          # 이 점수 이상이어야 통과
# 주최기관(host)이 바이오/제약 기업·기관이라서 통과시키고 싶을 때: host에 강한 키워드 + 제목에 아래 직무 단어
HOST_ASSIST_TITLE_WORDS = ["연구", "R&D", "품질", "생산", "임상", "개발", "QA", "QC", "RA", "MR", "공정", "분석", "실험"]

# (5) 분야 태그(rnd/gmp/venture/ai/sales) 추정 규칙 — 생명/보건 공고에만 붙습니다.
TAG_RULES = {
    "rnd":     ["연구", "R&D", "실험", "논문", "학술", "신약", "임상", "연구원"],
    "gmp":     ["GMP", "품질", "QA", "QC", "생산", "제조", "공정", "바이오공정"],
    "venture": ["창업", "스타트업", "벤처", "사업화", "IR", "아이디어", "엑셀러레이터"],
    "ai":      ["AI", "인공지능", "빅데이터", "딥러닝", "머신러닝", "디지털헬스", "데이터"],
    "sales":   ["영업", "마케팅", "MR", "마케터", "세일즈"],
}

# (6) 목록에서 제외할 공고(어학시험 등)
EXCLUDE_TITLE = re.compile(r"토익|TOEIC|토플|TOEFL|오픽|OPIc|텝스|TEPS", re.I)

# (7) 믿을 수 있는 주최기관(공신력 뱃지 ✅)
TRUSTED_HOST = re.compile(
    r"(부|처|청|원|공단|공사|진흥원|연구원|연구소|재단|협회|학회|위원회|센터|대학교?|KT|KG|LG|SK|삼성|현대|한미|유한|대웅|"
    r"종근당|녹십자|셀트리온|바이오로직스|뉴스|일보|신문|방송|TV|복지재단|굿네이버스|월드비전|적십자)"
)
LOCAL_GOV = re.compile(r"(특별자치도|특별자치시|특별시|광역시|[가-힣]{1,5}(시|군|구|도))$")


# ═══════════════════════════════════════════════════════════════════════
# [B. 생명/보건 분류기]  — 다중 키워드 가중치 + AND 조건
# ═══════════════════════════════════════════════════════════════════════
def _compile_kw(words):
    """"re:" 로 시작하면 정규식. 한글 포함 단어는 부분일치, 순수 영문은 '앞뒤가 영문이 아닐 때만' 일치(예: bio ≠ biography)."""
    pats = {}
    for w in words:
        if w.startswith("re:"):                       # 정규식 직접 지정
            pats[w] = re.compile(w[3:], re.I)
        elif re.search(r"[A-Za-z]", w) and not re.search(r"[가-힣]", w):
            pats[w] = re.compile(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z])", re.I)
        else:
            pats[w] = re.compile(re.escape(w), re.I)
    return pats


_STRONG = _compile_kw(STRONG_KEYWORDS)
_WEAK = _compile_kw(WEAK_KEYWORDS)
_MASK = [re.compile(p) for p in MASK_PHRASES]


def _mask(text):
    for rx in _MASK:
        text = rx.sub(" ", text)
    return text


def bio_classify(title="", host="", tags=None, body=""):
    """
    반환: (is_bio: bool, score: float, why: str)

    통과 조건(모두 AND):
      ① 오탐 문구를 지운 뒤에도 '강한 키워드'가 제목 또는 해시태그에 1개 이상 있다  AND
      ② 가중 점수 합계 ≥ PASS_SCORE
    예외(HOST_ASSIST): 주최기관에 강한 키워드(예: ○○제약) + 제목에 직무 단어(연구/품질/생산…) 가 함께 있으면 통과
    약한 키워드(생명/건강/환경 …)만 있는 경우, 본문(body)에서만 발견된 경우는 통과하지 못합니다.
    """
    fields = {
        "title": _mask(title or ""),
        "tags": _mask(" ".join(tags or [])),
        "host": _mask(host or ""),
        "body": _mask(body or ""),
    }
    score, strong_hits, weak_hits = 0.0, {}, {}
    for fname, text in fields.items():
        if not text.strip():
            continue
        for kw, rx in _STRONG.items():
            if rx.search(text):
                strong_hits.setdefault(fname, []).append(kw)
                score += WEIGHT_STRONG * FIELD_MULT[fname]
        for kw, rx in _WEAK.items():
            if rx.search(text):
                weak_hits.setdefault(fname, []).append(kw)
                score += WEIGHT_WEAK * FIELD_MULT[fname]

    strong_in_core = bool(strong_hits.get("title") or strong_hits.get("tags"))
    host_assist = bool(
        strong_hits.get("host")
        and any(w.lower() in fields["title"].lower() for w in HOST_ASSIST_TITLE_WORDS)
    )
    ok = (strong_in_core and score >= PASS_SCORE) or host_assist
    why = ",".join(f"{f}:{'/'.join(k)}" for f, k in strong_hits.items()) or "-"
    return ok, round(score, 1), why


def infer_tags(title, tags, body=""):
    text = f"{title} {' '.join(tags or [])} {body}"
    out = []
    for tag, words in TAG_RULES.items():
        for w in words:
            pat = (r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z])") if re.fullmatch(r"[A-Za-z&]+", w) else re.escape(w)
            if re.search(pat, text, re.I):
                out.append(tag)
                break
    return out


# ═══════════════════════════════════════════════════════════════════════
# [C. 정규화] — 사이트마다 제각각인 데이터를 '하나의 모양'으로
# ═══════════════════════════════════════════════════════════════════════
def clean(s):
    s = unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()


def to_iso(v):
    """'2026.11.18' '2026-11-18' '26.11.18' 에폭(ms/s) '2026년 11월 18일' → 'YYYY-MM-DD' / 실패 시 None"""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)) or (isinstance(v, str) and v.strip().isdigit() and len(v.strip()) >= 10):
        n = float(v)
        n = n / 1000 if n > 1e11 else n
        try:
            return datetime.fromtimestamp(n, KST).date().isoformat()
        except Exception:
            return None
    s = str(v)
    m = re.search(r"(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", s)
    if not m:
        m = re.search(r"\b(\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\b", s)
        if m:
            y = 2000 + int(m.group(1))
            return _safe_date(y, int(m.group(2)), int(m.group(3)))
        return None
    return _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))


def _safe_date(y, mo, d):
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def make_id(source, url, native_id=None):
    key = native_id or hashlib.sha1(url.encode()).hexdigest()[:10]
    return f"{source}-{key}"


def guess_cat(title, kind_hint):
    """kind_hint: contest | activity | recruit  →  공모전|대외활동|채용|교육"""
    if re.search(r"채용|인턴|신입|경력|모집공고|공채", title) and kind_hint != "contest":
        return "채용"
    if re.search(r"아카데미|교육|부트캠프|캠프|강좌|과정|연수|스쿨", title) and kind_hint != "contest":
        return "교육"
    return {"contest": "공모전", "activity": "대외활동", "recruit": "채용"}.get(kind_hint, "대외활동")


def classify_trust(host, source_curated=False):
    if source_curated:
        return "verified"
    h = (host or "").strip()
    if h and (TRUSTED_HOST.search(h) or LOCAL_GOV.search(h)):
        return "verified"
    return "caution"


def normalize(raw, source, base_url, kind_hint):
    """
    raw: 어떤 사이트에서 왔든 {title, host, start, end, url, tags, body, native_id} 정도의 느슨한 dict
    반환: 프론트가 쓰는 표준 공고 객체 / 쓸 수 없으면 None
    """
    title = clean(raw.get("title"))
    url = urllib.parse.urljoin(base_url, (raw.get("url") or "").strip())
    if not title or len(title) < 4:
        return None
    if urllib.parse.urlparse(url).scheme not in ("http", "https"):
        return None
    if EXCLUDE_TITLE.search(title):
        return None
    end = to_iso(raw.get("end"))
    start = to_iso(raw.get("start"))
    if not end:                        # 마감일을 모르는 공고는 신뢰할 수 없어 제외
        return None
    if start and start > end:
        start = None
    host = clean(raw.get("host"))[:40]
    tags = [clean(t).lstrip("#") for t in (raw.get("tags") or []) if clean(t)]
    body = clean(raw.get("body"))[:300]

    is_bio, score, why = bio_classify(title, host, tags, body)
    cat = guess_cat(title, kind_hint)
    item = {
        "id": make_id(source, url, raw.get("native_id")),
        "cat": cat,
        "kind": "apply",
        "isBio": is_bio,
        "essential": False,
        "always": False,
        "title": title,
        "host": host or "주최 정보 없음",
        "start": start or end,
        "end": end,
        "url": url,
        "trust": classify_trust(host),
        "grades": list(GRADES_ALL),
        "tags": infer_tags(title, tags, body) if is_bio else [],
        "note": f"{SOURCE_LABEL.get(source, source)} 공고 원문",
        "source": source,
        "bioScore": score,       # 디버깅용: 점수/근거 (프론트는 무시)
        "bioWhy": why,
    }
    return item


# ═══════════════════════════════════════════════════════════════════════
# [D. 수집] — 공통 HTTP + 사이트별 어댑터
# ═══════════════════════════════════════════════════════════════════════
_robots = {}


def allowed(url):
    p = urllib.parse.urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                rp.parse(r.read().decode("utf-8", "ignore").splitlines())
        except Exception:
            rp = None            # robots를 못 읽으면(404 등) 허용으로 간주하되, 목록 1페이지만 보수적으로 사용
        _robots[base] = rp
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(UA, url)


def fetch(url, retries=1):
    if not allowed(url):
        raise PermissionError(f"robots.txt 가 접근을 허용하지 않음: {url}")
    last = None
    for i in range(retries + 1):
        try:
            time.sleep(REQUEST_DELAY)
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                raw = r.read()
                enc = r.headers.get_content_charset() or "utf-8"
            try:
                return raw.decode(enc, "ignore")
            except LookupError:
                return raw.decode("utf-8", "ignore")
        except Exception as e:      # 네트워크/차단/타임아웃 모두 여기서 처리
            last = e
    raise last


# ---- 상세페이지 범용 파서: JSON-LD → __NEXT_DATA__ → 본문 라벨(정규식) 순서로 시도 ----
RANGE = re.compile(
    r"(\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}|\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2})"
    r"[^0-9~∼\-–]{0,12}[~∼\-–]\s*"
    r"(\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}|\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2})"
)
LABEL_END = re.compile(r"(?:마감일?|접수\s*마감|모집\s*마감|종료일?)\s*[:：]?\s*(\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2})")
LABEL_HOST = re.compile(r"(?:주최\s*/?\s*주관|주최|주관|기관명|기업명|회사명|호스트)\s*[:：]?\s*([^\n|<>]{2,30})")
KEY_TITLE = ("title", "name", "subject", "activityTitle", "contestTitle")
KEY_START = ("recruitStartAt", "startDate", "startAt", "applyStartDate", "beginDate", "start")
KEY_END = ("recruitCloseAt", "endDate", "endAt", "closeDate", "deadline", "applyEndDate", "dueDate", "end")
KEY_HOST = ("organizationName", "organization", "host", "company", "companyName", "hostName", "organizer", "sponsor")


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def _pick(d, keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, "", [], {}):
            if isinstance(v, dict):
                v = v.get("name") or v.get("title")
            if v not in (None, ""):
                return v
    return None


def _from_json_blobs(html):
    blobs = []
    for m in re.finditer(r'<script[^>]+type="application/(?:ld\+)?json"[^>]*>(.*?)</script>', html, re.S | re.I):
        blobs.append(m.group(1))
    m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if m:
        blobs.append(m.group(1))
    for b in blobs:
        try:
            data = json.loads(b)
        except Exception:
            continue
        for d in _walk(data):
            t, e = _pick(d, KEY_TITLE), _pick(d, KEY_END)
            if t and e and to_iso(e):
                return {"title": t, "start": _pick(d, KEY_START), "end": e, "host": _pick(d, KEY_HOST)}
    return None


def parse_detail(html):
    """어떤 사이트의 상세페이지든 {title,start,end,host,body,tags} 를 최대한 뽑는다. 못 뽑으면 빈 dict."""
    out = {}
    j = _from_json_blobs(html)
    if j:
        out.update({k: v for k, v in j.items() if v})
    text = clean(re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I))
    if not out.get("end"):
        m = RANGE.search(text)
        if m:
            out["start"], out["end"] = m.group(1), m.group(2)
        else:
            m = LABEL_END.search(text)
            if m:
                out["end"] = m.group(1)
    if not out.get("title"):
        m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html) or re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S) \
            or re.search(r"<title[^>]*>(.*?)</title>", html, re.S)
        if m:
            out["title"] = re.split(r"\s[|\-–]\s", clean(m.group(1)))[0]
    if not out.get("host"):
        m = LABEL_HOST.search(re.sub(r"<[^>]+>", "\n", html)) or LABEL_HOST.search(text)
        if m:
            out["host"] = clean(m.group(1))
    m = re.search(r'<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]*)"', html)
    out["body"] = clean(m.group(1)) if m else ""
    out["tags"] = re.findall(r"#([가-힣A-Za-z0-9_]{2,15})", text)[:10]
    return out


# ---- 사이트별 설정: 목록 URL + 상세링크 정규식 + 종류 힌트. (사이트가 바뀌면 여기만 고치면 됩니다) ----
SOURCES = {
    "linkareer": {
        "label": "링커리어",
        "base": "https://linkareer.com",
        "lists": [("https://linkareer.com/list/contest", "contest"), ("https://linkareer.com/list/activity", "activity")],
        "link": re.compile(r'href="(/activity/\d+)"'),
    },
    "thinkyou": {
        "label": "씽유",
        "base": "https://www.thinkyou.co.kr",
        "lists": [("https://www.thinkyou.co.kr/contest/", "contest")],
        "link": re.compile(r'href="((?:https://www\.thinkyou\.co\.kr)?/contest/\d+/?[^"#]*)"'),
    },
    "campuspick": {
        "label": "캠퍼스픽",
        "base": "https://www.campuspick.com",
        "lists": [("https://www.campuspick.com/contest", "contest"), ("https://www.campuspick.com/activity", "activity")],
        "link": re.compile(r'href="(/(?:contest|activity)/view\?id=\d+)"'),
    },
    "wevity": {
        "label": "위비티",
        "base": "https://www.wevity.com",
        "lists": [("https://www.wevity.com/?c=find&s=1&gub=1&cidx=20", "contest"),   # 과학/공학
                  ("https://www.wevity.com/?c=find&s=1&gub=1", "contest")],           # 전체(최신)
        "link": re.compile(r'href="(\?c=find[^"]*?gbn=view[^"]*?ix=\d+[^"]*)"'),
    },
}
SOURCE_LABEL = {k: v["label"] for k, v in SOURCES.items()}


def scrape_source(name, spec, log):
    """한 사이트를 수집해 '원시 dict 리스트' 반환. 개별 공고 실패는 건너뛰고, 사이트 전체 실패는 예외로 올린다."""
    results, seen = [], set()
    list_errors = 0
    for list_url, kind in spec["lists"]:
        try:
            html = fetch(list_url)
        except Exception as e:
            list_errors += 1
            log(f"  [{name}] 목록 실패 {list_url}: {type(e).__name__}: {e}")
            continue
        links = []
        for m in spec["link"].finditer(html):
            href = unescape(m.group(1))
            if href not in seen:
                seen.add(href)
                links.append(href)
        log(f"  [{name}] {kind} 링크 {len(links)}개 발견")
        for href in links[:MAX_LIST_LINKS]:
            if len(results) >= MAX_DETAIL_PAGES:
                break
            url = urllib.parse.urljoin(spec["base"] + "/", href)
            try:
                d = parse_detail(fetch(url))
                if d.get("title") and d.get("end"):
                    d.update({"url": url, "kind": kind})
                    results.append(d)
            except Exception as e:          # 공고 1개 실패는 무시
                log(f"  [{name}] 상세 건너뜀 {url}: {type(e).__name__}")
    if list_errors == len(spec["lists"]):
        raise RuntimeError("모든 목록 페이지 접근 실패(차단/구조변경/네트워크)")
    return results


def run_sources(previous_items, log):
    """모든 사이트를 '서로 격리해서' 실행. 한 사이트 실패 → 지난 데이터 유지(CARRY_OVER_DAYS) 후 계속."""
    items, report = [], {}
    for name, spec in SOURCES.items():
        try:
            raws = scrape_source(name, spec, log)
            normed = []
            for r in raws:
                try:
                    it = normalize(r, name, spec["base"], r.get("kind", "contest"))
                    if it:
                        normed.append(it)
                except Exception as e:      # 정규화 오류 1건이 전체를 막지 않도록
                    log(f"  [{name}] 정규화 건너뜀: {type(e).__name__}: {e}")
            if not normed:
                raise RuntimeError("파싱된 공고 0건(구조 변경 의심)")
            items += normed
            report[name] = {"status": "ok", "count": len(normed), "bio": sum(i["isBio"] for i in normed)}
            log(f"{name}: {len(normed)} items parsed (생명/보건 {report[name]['bio']})")
        except Exception as e:
            carried = [p for p in previous_items if p.get("source") == name and _within(p.get("end"), CARRY_OVER_DAYS)]
            items += carried
            report[name] = {"status": "failed", "error": f"{type(e).__name__}: {e}"[:120], "carriedOver": len(carried)}
            log(f"{name}: FAILED → 지난 데이터 {len(carried)}건 유지 ({e})")
    return items, report


def _within(end_iso, days):
    try:
        return date.fromisoformat(end_iso) >= TODAY - timedelta(days=days)
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════
# [E. 병합] curated > 크롤링, 제목 중복 제거, NEW(firstSeen) 기록, 마감 정리
# ═══════════════════════════════════════════════════════════════════════
def norm_title(t):
    return re.sub(r"[^0-9a-z가-힣]", "", (t or "").lower())


def dedupe_by_title(items):
    """같은 공고가 여러 사이트에 올라온 경우 1개만 남김. 우선순위: curated > 공신력 > 먼저 들어온 것"""
    def rank(it):
        return (0 if it.get("source") in (None, "curated") else 1, 0 if it.get("trust") == "verified" else 1)

    best = {}
    for it in items:
        key = norm_title(it.get("title"))
        if not key:
            continue
        if key not in best or rank(it) < rank(best[key]):
            best[key] = it
    return list(best.values())


def stamp_first_seen(items, previous_items):
    prev = {p["id"]: p.get("firstSeen") for p in previous_items if p.get("id") and p.get("firstSeen")}
    for it in items:
        it["firstSeen"] = prev.get(it["id"]) or it.get("firstSeen") or TODAY.isoformat()
    return items


def prune_closed(items):
    keep = []
    for it in items:
        if it.get("source") in (None, "curated") or it.get("always"):
            keep.append(it)
        elif _within(it.get("end"), KEEP_CLOSED_DAYS):
            keep.append(it)
    return keep


def merge(curated_items, crawled_items, previous_items):
    for c in curated_items:
        c.setdefault("source", "curated")
    merged = dedupe_by_title(list(curated_items) + list(crawled_items))
    merged = prune_closed(merged)
    return stamp_first_seen(merged, previous_items)


# ═══════════════════════════════════════════════════════════════════════
def main():
    logs = []

    def log(msg):
        print(msg, flush=True)
        logs.append(msg)

    if not CURATED.exists():
        sys.exit("curated.json 이 없습니다.")
    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    curated_items = curated.get("items", []) if isinstance(curated, dict) else curated

    previous_items = []
    if OUTPUT.exists():
        try:
            prev = json.loads(OUTPUT.read_text(encoding="utf-8"))
            previous_items = prev.get("items", []) if isinstance(prev, dict) else []
        except Exception:
            pass

    crawled, report = run_sources(previous_items, log)
    items = merge(curated_items, crawled, previous_items)

    out = dict(curated) if isinstance(curated, dict) else {}
    out["items"] = items
    out["updatedAt"] = datetime.now(KST).isoformat(timespec="seconds")
    out["sources"] = report
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"저장 완료: 총 {len(items)}건 (curated {len(curated_items)} + crawled {len(items) - len(curated_items)}±)")
    # 모든 사이트가 실패해도 curated 데이터로 사이트는 정상 동작하므로 종료 코드는 0 유지


if __name__ == "__main__":
    main()
