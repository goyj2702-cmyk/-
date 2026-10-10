import { Chip } from "./ui.jsx";
import { GRADES, INTERESTS } from "../lib/utils.js";

/** 학년(단일) + 관심 분야(복수) 개인화 바 — 값은 localStorage에 저장 */
export default function ProfileBar({ profile, setProfile }) {
  const toggleInterest = (k) =>
    setProfile((p) => ({ ...p, interests: p.interests.includes(k) ? p.interests.filter((x) => x !== k) : [...p.interests, k] }));

  return (
    <section className="rounded-2xl bg-slate-800/50 p-5 ring-1 ring-white/5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
        <div className="shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">My Profile</p>
          <p className="mt-1 text-sm text-slate-300">
            {profile.grade ? <b className="text-white">{profile.grade}</b> : "학년 미선택"}
            {profile.interests.length > 0 && <span className="text-slate-500"> · 관심 {profile.interests.length}개</span>}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-8">
          <div>
            <p className="mb-2 text-xs text-slate-500">학년</p>
            <div className="flex flex-wrap gap-1.5">
              {GRADES.map((g) => (
                <Chip key={g} active={profile.grade === g} onClick={() => setProfile((p) => ({ ...p, grade: p.grade === g ? "" : g }))}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-slate-500">생명 계열 관심 분야 (복수 선택)</p>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map((i) => (
                <Chip key={i.key} active={profile.interests.includes(i.key)} onClick={() => toggleInterest(i.key)}>
                  {i.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
