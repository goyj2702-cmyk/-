import { useEffect, useMemo, useState } from "react";
import useCurationData from "./useCurationData.js";
import { Toggle } from "./ui.jsx";
import ProfileBar from "./ProfileBar.jsx";
import AssistantBrief from "./AssistantBrief.jsx";
import ListView, { CategoryTabs } from "./ListView.jsx";
import CalendarView from "./CalendarView.jsx";
import CertView from "./CertView.jsx";
import { LIST_CATS, isNewItem, loadIdSet, matchOf, saveIdSet, sortItems, statusOf, storage } from "./utils.js";

const TABS = [
  { key: "list", label: "전체 공고" },
  { key: "calendar", label: "캘린더" },
  { key: "certs", label: "추천 자격증" },
];

const fmtUpdated = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 업데이트`;
};

export default function App() {
  const { status, data, error, reload } = useCurationData();

  const [tab, setTab] = useState("list");
  const [listCat, setListCat] = useState("전체");
  const [hideClosed, setHideClosed] = useState(() => storage.get("bs.hideClosed", false));
  const [bioOnly, setBioOnly] = useState(() => storage.get("bs.bioOnly", false));
  const [profile, setProfile] = useState(() => storage.get("bs.profile", { grade: "", interests: [] }));

  useEffect(() => storage.set("bs.profile", profile), [profile]);
  useEffect(() => storage.set("bs.hideClosed", hideClosed), [hideClosed]);
  useEffect(() => storage.set("bs.bioOnly", bioOnly), [bioOnly]);

  // ── 읽음 표시 · NEW 판정용 상태 (localStorage에 저장 → 새로고침·재접속해도 유지) ──
  const [read, setRead] = useState(() => loadIdSet("bs.read")); // 사용자가 직접 '읽음' 체크한 공고
  const [opened, setOpened] = useState(() => loadIdSet("bs.opened")); // '공고 보러 가기'로 열어본 공고 (NEW만 꺼짐)
  const [hideRead, setHideRead] = useState(() => storage.get("bs.hideRead", false));
  const [newOnly, setNewOnly] = useState(false);

  // data.json에서 사라진 공고 id는 저장할 때 정리해서 저장 공간이 계속 늘지 않게 함
  const validIds = useMemo(() => (data ? new Set(data.items.map((it) => it.id)) : null), [data]);
  useEffect(() => saveIdSet("bs.read", read, validIds), [read, validIds]);
  useEffect(() => saveIdSet("bs.opened", opened, validIds), [opened, validIds]);
  useEffect(() => storage.set("bs.hideRead", hideRead), [hideRead]);

  const readState = useMemo(
    () => ({
      read,
      isNew: (it) => isNewItem(it, { read, opened }),
      toggleRead: (id) =>
        setRead((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        }),
      markOpened: (id) => setOpened((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    }),
    [read, opened]
  );

  // 공통 필터 (리스트·캘린더·브리핑 공유)
  const items = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((it) => {
        if (hideClosed && statusOf(it).closed) return false;
        if (bioOnly && !it.isBio && !it.essential) return false; // 토익 등 공통 필수 스펙은 유지
        if (profile.grade && !(it.grades || []).includes(profile.grade)) return false;
        return true;
      })
      .sort((a, b) => sortItems(a, b, profile));
  }, [data, hideClosed, bioOnly, profile]);

  // 공고 리스트: 토익(어학)·자격증 일정 제외
  const listBase = useMemo(() => items.filter((it) => LIST_CATS.includes(it.cat)), [items]);
  const catItems = useMemo(() => (listCat === "전체" ? listBase : listBase.filter((it) => it.cat === listCat)), [listBase, listCat]);
  const newCount = catItems.filter(readState.isNew).length;
  const readCount = catItems.filter((it) => read.has(it.id)).length;
  // NEW 공고를 맨 위로, 읽은 공고는 숨기기 옵션 적용
  const listItems = useMemo(() => {
    const visible = catItems.filter((it) => (!hideRead || !read.has(it.id)) && (!newOnly || readState.isNew(it)));
    return [...visible].sort((a, b) => Number(readState.isNew(b)) - Number(readState.isNew(a)));
  }, [catItems, hideRead, newOnly, read, readState]);
  const counts = useMemo(() => {
    const c = { 전체: listBase.length };
    LIST_CATS.forEach((k) => (c[k] = listBase.filter((it) => it.cat === k).length));
    return c;
  }, [listBase]);
  const fitCount = listItems.filter((it) => !statusOf(it).closed && matchOf(it, profile).tagHit).length;
  const tabIndex = TABS.findIndex((t) => t.key === tab);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ---------- 헤더 ---------- */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-8">
            <div className="leading-tight">
              <span className="text-lg font-bold tracking-tight text-white">
                bio<span className="text-emerald-400">spec</span>
              </span>
              <p className="text-[10px] text-slate-500">{data ? fmtUpdated(data.meta?.updatedAt) : "AI 스펙 비서"}</p>
            </div>

            <nav className="relative grid grid-cols-3 rounded-xl bg-slate-800/80 p-1 ring-1 ring-white/5">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-slate-700 shadow-md transition-transform duration-300 ease-[cubic-bezier(.34,1.3,.64,1)]"
                style={{ transform: `translateX(${tabIndex * 100}%)` }}
              />
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative z-10 w-24 select-none rounded-lg py-2 text-sm font-medium transition-all duration-200 active:scale-95 sm:w-28 ${
                    tab === t.key ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Toggle on={hideClosed} onClick={() => setHideClosed((v) => !v)} label="마감 공고 숨기기" hint="지난 일정을 리스트·달력·일정표에서 숨겨요" />
            <Toggle on={bioOnly} onClick={() => setBioOnly((v) => !v)} label="생명 계열만 보기" hint="토익 등 공통 필수 스펙은 계속 보여요" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <ProfileBar profile={profile} setProfile={setProfile} />

        {status === "loading" && (
          <div className="space-y-4" aria-busy="true">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-800/60" />
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-800/60" />
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl bg-rose-500/10 p-6 text-sm text-rose-200 ring-1 ring-rose-500/30">
            <p className="font-semibold">데이터를 불러오지 못했어요.</p>
            <p className="mt-1 text-rose-200/70">{error} · data.json이 있는지 확인하세요.</p>
            <button type="button" onClick={reload} className="mt-4 rounded-lg bg-rose-500/20 px-3 py-1.5 font-semibold transition-all hover:bg-rose-500/30 active:scale-95">
              다시 시도
            </button>
          </div>
        )}

        {status === "ready" && (
          <div key={tab} className="animate-view-in">
            {tab === "list" && (
              <div className="space-y-8">
                <AssistantBrief items={items} profile={profile} onOpenCalendar={() => setTab("calendar")} />
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">공고 리스트</h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {listItems.length}건
                      {profile.interests.length > 0 && (
                        <>
                          {" "}· 관심 분야 일치 <b className="text-emerald-400">{fitCount}</b>건 우선
                        </>
                      )}{" "}
                      · 진행 중 공고 먼저, 마감 임박순
                    </p>
                  </div>
                  <CategoryTabs value={listCat} onChange={setListCat} counts={counts} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewOnly((v) => !v)}
                      aria-pressed={newOnly}
                      className={`flex select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-all duration-200 active:scale-95 ${
                        newOnly ? "bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white ring-fuchsia-400" : "bg-slate-800/60 text-fuchsia-300 ring-fuchsia-500/30 hover:bg-slate-800"
                      }`}
                    >
                      ✨ NEW만 보기 <span className="tabular-nums opacity-80">{newCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHideRead((v) => !v)}
                      aria-pressed={hideRead}
                      className={`flex select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-all duration-200 active:scale-95 ${
                        hideRead ? "bg-emerald-500 text-slate-950 ring-emerald-400" : "bg-slate-800/60 text-slate-400 ring-white/10 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      ✓ 읽은 공고 숨기기 <span className="tabular-nums opacity-80">{readCount}</span>
                    </button>
                    {read.size > 0 && (
                      <button
                        type="button"
                        onClick={() => window.confirm("모든 읽음 표시를 지울까요?") && setRead(new Set())}
                        className="select-none rounded-full px-3 py-1.5 text-xs text-slate-500 transition-all hover:text-slate-300 active:scale-95"
                      >
                        읽음 표시 초기화
                      </button>
                    )}
                  </div>
                </div>
                <div key={listCat} className="animate-view-in">
                  <ListView
                    items={listItems}
                    profile={profile}
                    readState={readState}
                  />
                </div>
              </div>
            )}

            {tab === "calendar" && (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">일정 캘린더</h1>
                  <p className="mt-1.5 text-sm text-slate-500">🚀 공고 마감, 🎯 토익 접수·시험, 📝 기사 시험 일정을 한 달 단위로 확인하세요.</p>
                </div>
                <CalendarView items={items} />
              </>
            )}

            {tab === "certs" && (
              <CertView
                certs={data.certs || []}
                schedules={data.schedules || {}}
                hideClosed={hideClosed}
                profile={profile}
                onEducation={() => {
                  setListCat("교육");
                  setTab("list");
                }}
              />
            )}
          </div>
        )}

        <footer className="pt-10 text-center text-xs leading-relaxed text-slate-600">
          <p>✅ 공신력 인증: 정부·공공기관·학회·대기업 주최이며 공식 사이트 또는 공고 원문으로 연결돼요.</p>
          <p>⚠️ 주의/비공식: 주최 규모가 작거나 공식 페이지 확인이 안 된 정보예요.</p>
          <p className="mt-2">매일 새벽 3시(KST) 자동 갱신 · 지원 전 반드시 공식 페이지에서 최신 요강을 확인하세요.</p>
        </footer>
      </main>
    </div>
  );
}
