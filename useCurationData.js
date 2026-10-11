import { useCallback, useEffect, useState } from "react";

/**
 * 저장소 루트의 data.json을 불러온다 (vite.config.js의 플러그인이 배포 결과에 포함시킴).
 * - 같은 출처(정적 파일)에서 읽으므로 CORS 문제가 없음
 * - 크롤링은 GitHub Actions(서버)에서 끝내고 결과 파일만 배포
 * - BASE_URL을 붙여 GitHub Pages 하위 경로에서도 동작
 */
export default function useCurationData() {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.items)) throw new Error("data.json 형식이 올바르지 않아요 (items 없음)");
      setState({ status: "ready", data, error: null });
    } catch (e) {
      setState({ status: "error", data: null, error: e.message || String(e) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
