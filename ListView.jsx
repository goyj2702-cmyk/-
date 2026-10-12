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

/** 반짝이는 NEW 뱃지: 핑크→주황 그라데이션 + 빛 스침 + 깜빡이는 점 */
function NewBadge() {
  return (
    <span className="relative inline-flex items-center gap-1 overflow-hidden rounded-md bg-gradient-to-r from-fuchsia-500 to-orange-400 px-2 py-0.5 text-[10px] font-black tracking-wider text-white shadow-lg shadow-fuchsia-500/30">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      NEW
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 animate-shine bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </span>
  );
}

/** 읽음 체크 버튼: 누를 때마다 읽음 ↔ 안 읽음 전환 */
function ReadButton({ read, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={read}
      title={read ? "읽음 표시 취소" : "읽음으로 표시"}
      className={`flex shrink-0 select-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-all duration-200 active:scale-95 ${
        read ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40 hover:bg-emerald-500/25" : "bg-transparent text-slate-400 ring-white/10 hover:bg-slate-700/60 hover:text-slate-200"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${read ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-slate-500"}`}>
        {read && (
          <svg className="h-3 w-3 animate-pop" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L20 7" />
          </svg>
        )}
      </span>
      {read ? "읽음" : "읽음 표시"}
    </button>
  );
}

function NoticeCard({ it, profile, isNew, read, onToggleRead, onOpen }) {
  const s = statusOf(it);
  const m = matchOf(it, profile);
  const tags = [catName(it.cat), ...(it.isBio ? ["생명계열"] : []), ...(it.tags || []).map((k) => INTEREST_LABEL[k]).filter(Boolean)];

  // 카드 테두리: NEW(핑크 빛) > 맞춤(초록) > 기본
  const ring = isNew
    ? "ring-fuchsia-500/50 shadow-lg shadow-fuchsia-500/10 hover:ring-fuchsia-400/70"
    : m.fit
    ? "ring-emerald-500/30 hover:ring-emerald-400/50"
    : "ring-white/5 hover:ring-white/15";
  // 읽은 공고 / 마감 공고는 흐리게 (마우스를 올리면 다시 또렷하게)
  const dim = read ? "opacity-45 saturate-50 hover:opacity-90 hover:saturate-100" : s.closed ? "opacity-55 hover:opacity-90" : "";

  return (
    <article
      className={`group flex flex-col rounded-2xl ring-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
        read ? "bg-slate-800/40" : "bg-slate-800/70 hover:bg-slate-800"
      } ${ring} ${dim}`}
    >
      {/* ① NEW · D-Day · 카테고리 | 신뢰 뱃지 */}
      <div className="flex items-center justify-between gap-2 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {isNew && <NewBadge />}
          <Badge s={s} />
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[it.cat]}`}>{catName(it.cat)}</span>
          {m.fit && <span className="text-[11px] font-bold text-emerald-400">맞춤</span>}
        </div>
        <TrustBadge trust={it.trust} />
      </div>

      {/* ② 주최사 → 제목 → 기간 → 메모 → 해시태그 */}
      <div className="flex-1 px-5 pt-4">
        <p className="line-clamp-1 text-xs font-medium text-slate-400">{it.host}</p>
        <h3
          className={`mt-1.5 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug transition-colors ${
            read ? "text-slate-400 line-through decoration-slate-500/70" : "text-slate-100 group-hover:text-white"
          }`}
        >
          {it.title}
        </h3>
        <p className="mt-2 text-xs tabular-nums text-slate-400">📅 {periodOf(it)}</p>
        {it.note && <p className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${it.trust === "caution" ? "text-amber-200/75" : "text-slate-500"}`}>{it.note}</p>}
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {tags.map((t) => (
            <span key={t} className="text-[11px] font-medium text-slate-500">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* ③ 읽음 표시 | 공고 보러 가기 */}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/5 px-5 py-4">
        <ReadButton read={read} onToggle={onToggleRead} />
        <div className="flex shrink-0 items-center">
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className={`flex shrink-0 select-none items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
              s.closed || read ? "bg-slate-700/70 text-slate-300 hover:bg-slate-700" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            공고 보러 가기 <Arrow className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function ListView({ items, profile, readState }) {
  if (!items.length) return <Empty />;
  const { read, isNew, toggleRead, markOpened } = readState;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => (
        <NoticeCard
          key={it.id}
          it={it}
          profile={profile}
          isNew={isNew(it)}
          read={read.has(it.id)}
          onToggleRead={() => toggleRead(it.id)}
          onOpen={() => markOpened(it.id)}
        />
      ))}
    </div>
  );
}
