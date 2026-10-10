/* 공용 UI 조각 */

export const Arrow = ({ className = "h-3.5 w-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const Chevron = ({ dir }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>
);

const TONE = {
  urgent: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40",
  warn: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
  normal: "bg-slate-700/70 text-slate-300",
  live: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  soon: "bg-indigo-500/15 text-indigo-300",
  muted: "bg-slate-800 text-slate-500",
};

export const Badge = ({ s }) => (
  <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ${TONE[s.tone]}`}>{s.label}</span>
);

export const TrustBadge = ({ trust }) =>
  trust === "verified" ? (
    <span className="whitespace-nowrap rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25">✅ 공신력 인증</span>
  ) : (
    <span className="whitespace-nowrap rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">⚠️ 주의/비공식</span>
  );

/** 슬라이드 + 눌림(scale-95) 모션 토글 */
export const Toggle = ({ on, onClick, label, hint }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    title={hint}
    className={`group flex select-none items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm ring-1 transition-all duration-200 ease-out active:scale-95 ${
      on ? "bg-emerald-500/10 text-white ring-emerald-500/40" : "bg-slate-800/60 text-slate-400 ring-white/5 hover:text-slate-200 hover:ring-white/10"
    }`}
  >
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${on ? "bg-emerald-500" : "bg-slate-600"}`}>
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:w-[18px] ${
          on ? "translate-x-[18px] group-active:translate-x-[14px]" : "translate-x-[3px]"
        }`}
      />
    </span>
    {label}
  </button>
);

export const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`select-none rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-all duration-200 ease-out active:scale-95 ${
      active ? "bg-emerald-500 text-slate-950 ring-emerald-400 shadow-lg shadow-emerald-500/20" : "bg-slate-800/60 text-slate-400 ring-white/5 hover:bg-slate-800 hover:text-slate-200"
    }`}
  >
    {children}
  </button>
);

export const Empty = ({ title = "조건에 맞는 공고가 없습니다!", desc = "토글을 끄거나 프로필 조건을 바꿔 보세요." }) => (
  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 text-center">
    <p className="text-base font-semibold text-slate-300">{title}</p>
    <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
  </div>
);

export const SectionHead = ({ title, desc, link, linkLabel, badge }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {badge}
      </div>
      {desc && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>}
    </div>
    {link && (
      <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 transition-all hover:text-emerald-300 active:scale-95">
        {linkLabel} <Arrow />
      </a>
    )}
  </div>
);

export const Table = ({ head, rows, dimIndex = () => false }) => (
  <div className="overflow-x-auto rounded-2xl ring-1 ring-white/5">
    <table className="w-full text-[13px]">
      <thead className="bg-slate-800/70 text-[11px] uppercase tracking-wider text-slate-500">
        <tr>
          {head.map((h) => (
            <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5 bg-slate-900/40">
        {rows.map((r, i) => (
          <tr key={i} className={`transition-colors hover:bg-slate-800/40 ${dimIndex(i) ? "text-slate-600" : "text-slate-200"}`}>
            {r.map((c, j) => (
              <td key={j} className={`whitespace-nowrap px-4 py-3 tabular-nums ${j === 0 ? "font-semibold" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
