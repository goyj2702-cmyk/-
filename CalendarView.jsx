import { useMemo, useState } from "react";
import { Badge, Chevron, TrustBadge } from "./ui.jsx";
import { EMOJI, WEEK, catName, fmt, pad, parse, statusOf, toKey } from "../lib/utils.js";

const LABELS = {
  apply: { start: "접수 시작", end: "접수 마감", single: "접수 마감" },
  exam: { start: "시험 시작", end: "시험 종료", single: "시험일" },
  announce: { start: "발표·행사", end: "발표·행사", single: "발표·행사" },
};

/** 날짜별 마커: 단일 일정 1개, 기간 일정은 시작(시험만)·종료일. 접수는 마감일 중심으로 가볍게 */
const buildMarks = (items) => {
  const map = {};
  const add = (k, v) => (map[k] = [...(map[k] || []), v]);
  items.forEach((it) => {
    if (it.always || !it.start) return;
    const L = LABELS[it.kind] || LABELS.apply;
    if (it.start === it.end) add(it.start, { it, label: L.single });
    else {
      if (it.kind !== "apply") add(it.start, { it, label: L.start });
      add(it.end, { it, label: L.end });
    }
  });
  return map;
};

export default function CalendarView({ items }) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(toKey(now));
  const [hover, setHover] = useState(null);

  const marks = useMemo(() => buildMarks(items), [items]);
  const cells = useMemo(() => {
    const off = new Date(cur.y, cur.m, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => new Date(cur.y, cur.m, 1 - off + i));
  }, [cur]);

  const move = (n) =>
    setCur(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const todayKey = toKey(now);
  const active = hover || sel;
  const entries = marks[active] || [];
  const monthList = Object.entries(marks)
    .filter(([k]) => parse(k).getFullYear() === cur.y && parse(k).getMonth() === cur.m)
    .sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <div className="grid gap-8 md:grid-cols-[340px_minmax(0,1fr)] md:items-start">
      {/* 컴팩트 월간 그리드 */}
      <div className="w-full max-w-[340px] rounded-2xl bg-slate-800/60 p-5 ring-1 ring-white/5 md:sticky md:top-28">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tabular-nums text-white">
            {cur.y}. {pad(cur.m + 1)}
          </h2>
          <div className="flex items-center text-slate-400">
            <button type="button" aria-label="이전 달" onClick={() => move(-1)} className="rounded-lg p-1.5 transition-all hover:bg-slate-700 hover:text-white active:scale-90">
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCur({ y: now.getFullYear(), m: now.getMonth() });
                setSel(todayKey);
              }}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold transition-all hover:bg-slate-700 hover:text-white active:scale-90"
            >
              오늘
            </button>
            <button type="button" aria-label="다음 달" onClick={() => move(1)} className="rounded-lg p-1.5 transition-all hover:bg-slate-700 hover:text-white active:scale-90">
              <Chevron dir="right" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-500">
          {WEEK.map((w) => (
            <span key={w} className="pb-2">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
          {cells.map((d) => {
            const k = toKey(d);
            const list = marks[k] || [];
            const isSel = k === sel;
            const isToday = k === todayKey;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSel(k)}
                onMouseEnter={() => setHover(list.length ? k : null)}
                className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[13px] tabular-nums transition-all duration-150 active:scale-90 ${
                  isSel ? "bg-emerald-500 font-semibold text-slate-950" : list.length ? "bg-slate-700/30 text-slate-100 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-700/50"
                } ${d.getMonth() === cur.m ? "" : "opacity-25"} ${isToday && !isSel ? "ring-1 ring-emerald-400/70" : ""}`}
              >
                <span className="leading-none">{d.getDate()}</span>
                {list.length > 0 && (
                  <span className="text-[10px] leading-none" aria-hidden>
                    {[...new Set(list.map((e) => EMOJI[e.it.cat]))].join("")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-white/5 pt-4 text-[11px] text-slate-400">
          <p>🎯 토익 시험·접수 마감</p>
          <p>🚀 공모전·대외활동·채용 마감</p>
          <p>📚 교육·아카데미 모집 마감</p>
          <p>📝 국가기술자격 시험·접수</p>
        </div>
      </div>

      {/* 날짜 상세 + 이번 달 목록 */}
      <div className="space-y-10">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{hover ? "미리보기" : "선택한 날짜"}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{fmt(active)}</h3>
          <div key={active} className="mt-5 animate-view-in space-y-2.5">
            {entries.length === 0 ? (
              <p className="rounded-xl bg-slate-800/40 p-5 text-sm text-slate-500">이 날은 일정이 없어요. 이모티콘이 있는 날짜를 눌러 보세요.</p>
            ) : (
              entries.map(({ it, label }, i) => (
                <a
                  key={`${it.id}-${i}`}
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-xl bg-slate-800/70 p-4 ring-1 ring-white/5 transition-all duration-200 hover:bg-slate-800 hover:ring-emerald-400/30 active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900/70 text-lg" aria-hidden>
                    {EMOJI[it.cat]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">
                      {catName(it.cat)} · {label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-100">{it.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge s={statusOf(it)} />
                    <TrustBadge trust={it.trust} />
                  </div>
                </a>
              ))
            )}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">이번 달 일정</p>
          <ul className="mt-3 divide-y divide-white/5">
            {monthList.length === 0 && <li className="py-3 text-sm text-slate-500">일정이 없어요.</li>}
            {monthList.flatMap(([k, list]) =>
              list.map(({ it, label }, i) => (
                <li key={`${k}-${it.id}-${i}`}>
                  <button type="button" onClick={() => setSel(k)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm transition-colors hover:text-white">
                    <span className="w-10 shrink-0 tabular-nums text-slate-500">{parse(k).getDate()}일</span>
                    <span aria-hidden>{EMOJI[it.cat]}</span>
                    <span className="truncate text-slate-300">
                      {label} · {it.title}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
