/* 상수 · 날짜 · 상태 계산 유틸 */

export const GRADES = ["1학년", "2학년", "3학년", "4학년", "휴학생"];

export const INTERESTS = [
  { key: "rnd", label: "바이오/제약 R&D" },
  { key: "gmp", label: "생산·품질(GMP)" },
  { key: "venture", label: "바이오 벤처/창업" },
  { key: "ai", label: "보건/의료 AI" },
  { key: "sales", label: "제약 영업/마케팅" },
];
export const INTEREST_LABEL = Object.fromEntries(INTERESTS.map((i) => [i.key, i.label]));

// 공고 리스트 카테고리 (토익=어학, 자격증 일정은 리스트에서 제외 → 캘린더·가이드 전용)
export const LIST_CATS = ["채용", "공모전", "대외활동", "교육"];
export const CAT_TABS = [
  { key: "전체", label: "전체" },
  { key: "채용", label: "채용공고" },
  { key: "공모전", label: "공모전" },
  { key: "대외활동", label: "대외활동" },
  { key: "교육", label: "교육·아카데미" },
];
const CAT_LABEL = { 채용: "채용공고", 교육: "교육·아카데미", 어학: "토익" };
export const catName = (c) => CAT_LABEL[c] || c;
export const CAT_STYLE = {
  공모전: "bg-sky-500/10 text-sky-300",
  대외활동: "bg-emerald-500/10 text-emerald-300",
  교육: "bg-teal-500/10 text-teal-300",
  채용: "bg-orange-500/10 text-orange-300",
};

// 캘린더 이모티콘
export const EMOJI = { 어학: "🎯", 자격증: "📝", 공모전: "🚀", 대외활동: "🚀", 채용: "🚀", 교육: "📚" };

export const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export const pad = (n) => String(n).padStart(2, "0");
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => new Date(`${s}T00:00:00`);

const today0 = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};
export const diff = (s) => Math.round((parse(s) - today0()) / 86400000);

export const fmt = (s) => {
  const d = parse(s);
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEK[d.getDay()]})`;
};
const range = (a, b) => (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`);

export const periodOf = (it) => {
  if (it.always) return "상시 운영 · 과정별 일정 확인";
  if (it.start === it.end && it.kind === "apply") return `${fmt(it.end)} 마감`;
  return range(it.start, it.end);
};

const toneOf = (d) => (d <= 3 ? "urgent" : d <= 7 ? "warn" : "normal");

/** D-Day 뱃지 계산 */
export const statusOf = (it) => {
  if (it.always) return { label: "상시", tone: "soon" };
  const toEnd = diff(it.end);
  const toStart = diff(it.start);
  if (toEnd < 0) return { closed: true, label: it.kind === "apply" ? "마감" : "종료", tone: "muted" };
  if (it.kind === "exam") {
    if (toStart > 0) return { label: `시험 D-${toStart}`, tone: toneOf(toStart) };
    return { label: toStart === 0 && toEnd === 0 ? "오늘 시험" : "시험 기간", tone: "live" };
  }
  if (it.kind === "apply" && toStart > 0) return { label: `오픈 D-${toStart}`, tone: "soon" };
  return { label: toEnd === 0 ? "D-Day" : `D-${toEnd}`, tone: toneOf(toEnd) };
};

/** 진행 중 공고 → 마감 임박순, 상시 과정은 진행 중 맨 뒤, 마감 공고는 최근 마감순 */
export const sortItems = (a, b, profile) => {
  const ca = !!statusOf(a).closed;
  const cb = !!statusOf(b).closed;
  if (ca !== cb) return ca ? 1 : -1;
  if (!ca && profile) {
    const fa = matchOf(a, profile).tagHit;
    const fb = matchOf(b, profile).tagHit;
    if (fa !== fb) return fa ? -1 : 1;
  }
  const key = (it) => (it.always ? 99999 : diff(it.end));
  return ca ? key(b) - key(a) : key(a) - key(b);
};

/** 프로필 매칭: 학년 조건 + 관심 분야 일치 */
export const matchOf = (it, profile) => {
  const gradeOk = !profile.grade || (it.grades || GRADES).includes(profile.grade);
  const tagHit = profile.interests.some((k) => (it.tags || []).includes(k));
  return { gradeOk, tagHit, fit: gradeOk && tagHit };
};

export const openUrl = (url) => window.open(url, "_blank", "noopener,noreferrer");

/** localStorage는 막혀 있을 수 있으므로 항상 try/catch */
export const storage = {
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  },
};
