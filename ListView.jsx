import { Arrow, Badge, Empty, TrustBadge } from "./ui.jsx";
import { CAT_STYLE, CAT_TABS, INTEREST_LABEL, catName, matchOf, periodOf, statusOf } from "./utils.js";

export function CategoryTabs({ value, onChange, counts }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="공고 카테고리">
      {CAT_TABS.map((c) => {
        const on = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(c.key)}
            className={`flex select-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-all duration-200 ease-out active:scale-95 ${
              on ? "bg-white text-slate-900 ring-white shadow-lg shadow-black/30" : "bg-slate-800/60 text-slate-400 ring-white/5 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {c.label}
            <span className={`rounded-md px-1.5 text-[11px] tabular-nums ${on ? "bg-slate-900/10 text-slate-600" : "bg-slate-700/60 text-slate-400"}`}>{counts[c.key] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function NoticeCard({ it, profile }) {
  const s = statusOf(it);
  const m = matchOf(it, profile);
  const tags = [catName(it.cat), ...(it.isBio ? ["생명계열"] : []), ...(it.tags || []).map((k) => INTEREST_LABEL[k]).filter(Boolean)];

  return (
    <article
      className={`group flex flex-col rounded-2xl bg-slate-800/70 ring-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-slate-800 hover:shadow-2xl hover:shadow-black/40 ${
        m.fit ? "ring-emerald-500/30 hover:ring-emerald-400/50" : "ring-white/5 hover:ring-white/15"
      } ${s.closed ? "opacity-55 hover:opacity-90" : ""}`}
    >
      {/* ① D-Day · 카테고리 | 신뢰 뱃지 */}
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <div className="flex items-center gap-1.5">
          <Badge s={s} />
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[it.cat]}`}>{catName(it.cat)}</span>
          {m.fit && <span className="text-[11px] font-bold text-emerald-400">맞춤</span>}
        </div>
        <TrustBadge trust={it.trust} />
      </div>

      {/* ② 주최사 → 제목 → 메모 → 해시태그 */}
      <div className="flex-1 px-5 pt-4">
        <p className="line-clamp-1 text-xs font-medium text-slate-400">{it.host}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug text-slate-100 group-hover:text-white">{it.title}</h3>
        {it.note && <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${it.trust === "caution" ? "text-amber-200/75" : "text-slate-500"}`}>{it.note}</p>}
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {tags.map((t) => (
            <span key={t} className="text-[11px] font-medium text-slate-500">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* ③ 기간 | 공고 보러 가기 */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 px-5 py-4">
        <span className="text-xs tabular-nums text-slate-400">{periodOf(it)}</span>
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex shrink-0 select-none items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
            s.closed ? "bg-slate-700/70 text-slate-300 hover:bg-slate-700" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          }`}
        >
          공고 보러 가기 <Arrow className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

export default function ListView({ items, profile }) {
  if (!items.length) return <Empty />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => (
        <NoticeCard key={it.id} it={it} profile={profile} />
      ))}
    </div>
  );
}
