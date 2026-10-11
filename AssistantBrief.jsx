import { useMemo } from "react";
import { diff, fmt, matchOf, statusOf } from "./utils.js";

/**
 * "AI 비서" 오늘의 브리핑 — 규칙 기반 요약 (외부 AI API 호출 없음)
 * 프로필과 data.json을 바탕으로 지금 챙길 일정을 3줄로 정리한다.
 */
export default function AssistantBrief({ items, profile, onOpenCalendar }) {
  const brief = useMemo(() => {
    const open = items.filter((it) => !statusOf(it).closed && !it.always);
    const notices = open.filter((it) => ["채용", "공모전", "대외활동", "교육"].includes(it.cat));
    const urgent = notices.filter((it) => diff(it.start) <= 0 && diff(it.end) <= 3);
    const fit = profile.interests.length ? notices.filter((it) => matchOf(it, profile).fit) : [];
    const upcomingExam = (cat) =>
      open.filter((it) => it.cat === cat && it.kind === "exam" && diff(it.start) >= 0).sort((a, b) => diff(a.start) - diff(b.start))[0];
    return { urgent, fit, toeic: upcomingExam("어학"), gisa: upcomingExam("자격증") };
  }, [items, profile]);

  const lines = [
    brief.urgent.length
      ? `🚀 3일 안에 마감되는 공고가 ${brief.urgent.length}건 있어요. (${brief.urgent[0].title}${brief.urgent.length > 1 ? " 외" : ""})`
      : "🚀 3일 안에 마감되는 공고는 없어요. 여유 있게 준비해요.",
    brief.toeic ? `🎯 다음 토익 정기시험은 ${fmt(brief.toeic.start)}, D-${diff(brief.toeic.start)}예요.` : null,
    brief.gisa ? `📝 ${brief.gisa.title}: ${fmt(brief.gisa.start)} 시작 (D-${diff(brief.gisa.start)})` : null,
    profile.interests.length
      ? `✨ 내 관심 분야에 맞는 진행 중 공고는 ${brief.fit.length}건이에요.`
      : "✨ 프로필에서 관심 분야를 고르면 맞춤 공고를 추려 드려요.",
  ].filter(Boolean);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-800/40 to-sky-500/10 p-5 ring-1 ring-emerald-500/20 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">AI 비서 · 오늘의 브리핑</p>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="select-none rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-700/60 hover:text-white active:scale-95"
        >
          캘린더로 보기 →
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
