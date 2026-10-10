import { useMemo, useState } from "react";
import { Arrow, SectionHead, Table, TrustBadge } from "./ui.jsx";
import { diff } from "../lib/utils.js";

const QNET = "https://www.q-net.or.kr/crf021.do?id=crf02101";
const TOEIC = "https://exam.toeic.co.kr/";
const GISA_HEAD = ["회차", "필기 접수", "필기 시험", "실기 접수", "실기 시험", "최종 발표"];

/** 레퍼런스 이미지 스타일: 원형 점선 일러스트 + 중앙 정렬 텍스트 + 하단 버튼 2개 */
function CertCard({ c, fit, index, total, onEducation }) {
  const [open, setOpen] = useState(false);
  const btn = "flex select-none items-center justify-center gap-1 rounded-full py-2.5 text-xs font-bold transition-all duration-200 active:scale-95";

  return (
    <article
      className={`flex flex-col items-center rounded-3xl bg-slate-800 px-6 pb-6 pt-8 text-center ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
        fit ? "ring-emerald-500/40" : "ring-white/5 hover:ring-white/15"
      }`}
    >
      {/* ① 원형 일러스트 */}
      <div className="relative h-36 w-36">
        <span className={`absolute inset-4 rounded-full ${c.tint}`} />
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-slate-600" />
        <span className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg transition-transform duration-300 hover:scale-110" aria-hidden>
          {c.art.main}
        </span>
        <span className="absolute -left-1 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xl ring-1 ring-white/10" aria-hidden>
          {c.art.a}
        </span>
        <span className="absolute -right-1 bottom-5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xl ring-1 ring-white/10" aria-hidden>
          {c.art.b}
        </span>
      </div>

      {/* ② 명칭 · 설명 */}
      <div className="mt-6 flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-violet-300/90">{c.type}</span>
        {fit && <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-300">맞춤</span>}
      </div>
      <h3 className="mt-1.5 text-lg font-bold leading-snug text-white">{c.name}</h3>
      <p className="mt-3 min-h-[4.5rem] text-sm leading-relaxed text-slate-400">{c.desc}</p>

      {/* 상세보기 펼침 */}
      <div className={`grid w-full transition-all duration-300 ease-out ${open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 rounded-2xl bg-slate-900/60 p-4 text-left text-xs leading-relaxed">
            <p className="text-slate-300">
              <span className="text-slate-500">추천 직무 · </span>
              {c.role}
            </p>
            <p className="text-slate-300">{c.detail}</p>
            {c.caution && <p className="text-amber-200/80">⚠️ {c.caution}</p>}
            <div className="pt-1">
              <TrustBadge trust={c.trust} />
            </div>
          </div>
        </div>
      </div>

      {/* 페이지 인디케이터 */}
      <div className="mt-5 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-slate-300" : "w-1.5 bg-slate-600"}`} />
        ))}
      </div>

      {/* ③ 하단 버튼 */}
      <div className="mt-5 grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${btn} bg-slate-700/70 text-slate-200 hover:bg-slate-700`}>
          {open ? "접기" : "상세보기"}
        </button>
        {c.action === "education" ? (
          <button type="button" onClick={onEducation} className={`${btn} bg-white text-slate-900 hover:bg-slate-200`}>
            {c.urlLabel}
          </button>
        ) : (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white text-slate-900 hover:bg-slate-200`}>
            {c.urlLabel} <Arrow className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function CertView({ certs, schedules, hideClosed, profile, onEducation }) {
  const sorted = useMemo(() => {
    const picked = profile.interests;
    return [...certs].sort((a, b) => Number(picked.includes(b.track)) - Number(picked.includes(a.track)));
  }, [certs, profile.interests]);

  const cur = schedules.gisaCurrent || { rows: [] };
  const next = schedules.gisaNext || { rows: [] };
  const toeic = schedules.toeic || { rows: [] };
  const curRows = cur.rows.filter((r) => !hideClosed || !r.fd || diff(r.fd) >= 0);
  const toeicRows = toeic.rows.filter((r) => !hideClosed || diff(r.ed) >= 0);

  return (
    <div className="space-y-16">
      <section>
        <SectionHead title="바이오·제약 필수 자격증" desc="관심 분야를 고르면 관련 자격이 앞으로 와요. 교육·아카데미 프로그램은 '전체 공고 > 교육·아카데미'에서 볼 수 있어요." />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((c, i) => (
            <CertCard key={c.name} c={c} index={i} total={sorted.length} fit={profile.interests.includes(c.track)} onEducation={onEducation} />
          ))}
        </div>
      </section>

      <section>
        <SectionHead title={`${cur.year || ""} 정기 기사·산업기사`} desc="큐넷 공고 확정 일정이에요. 지난 회차는 흐리게 표시돼요." link={QNET} linkLabel="큐넷 원서접수" />
        <Table head={GISA_HEAD} rows={curRows.map((r) => [r.r, r.a, r.w, r.pa, r.p, r.f])} dimIndex={(i) => !!curRows[i].fd && diff(curRows[i].fd) < 0} />
      </section>

      <section>
        <SectionHead
          title={`${next.year || ""} 정기 기사·산업기사`}
          badge={
            next.status === "expected" ? (
              <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300 ring-1 ring-amber-400/30">예상 시기</span>
            ) : (
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">확정</span>
            )
          }
          desc={
            next.status === "expected"
              ? "시행계획 공고 전이에요(예년 11~12월 발표). 전년도 패턴 기반의 예상 시기이니, 공고 후 data/curated.json을 확정 일정으로 바꿔 주세요."
              : "큐넷 공고 확정 일정이에요."
          }
          link={QNET}
          linkLabel="큐넷 연간 일정"
        />
        <Table head={GISA_HEAD} rows={next.rows.map((r) => [r.r, r.a, r.w, r.pa, r.p, r.f])} />
      </section>

      <section>
        <SectionHead
          title={`${toeic.year || ""} 토익 정기시험`}
          desc="한국TOEIC위원회 공식 일정이에요. 정기접수는 마감일 오전 10시에 닫히고, 이후 특별추가접수(할증)가 열려요. 다음 해 일정은 보통 전년 11월 초에 발표돼요."
          link={TOEIC}
          linkLabel="TOEIC 공식 접수"
        />
        <Table head={["회차", "🎯 시험일", "정기 접수 기간"]} rows={toeicRows.map((r) => [r.r, r.e, r.a])} dimIndex={(i) => diff(toeicRows[i].ed) < 0} />
      </section>
    </div>
  );
}
