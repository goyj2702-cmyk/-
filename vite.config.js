import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 모든 파일을 한 폴더(저장소 루트)에 두는 구조용 설정.
// data.json은 루트에 있고, 아래 플러그인이 개발 서버와 빌드 결과(dist)에 그대로 제공한다.
// → 화면은 계속 fetch("./data.json")으로 읽고, GitHub Actions가 매일 이 파일을 갱신한다.
const DATA_FILE = resolve(process.cwd(), "data.json");

const serveDataJson = () => ({
  name: "serve-data-json",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.split("?")[0].endsWith("/data.json")) return next();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(readFileSync(DATA_FILE));
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "data.json", source: readFileSync(DATA_FILE) });
  },
});

export default defineConfig({
  plugins: [react(), serveDataJson()],
  base: "./",
  publicDir: false, // 루트 전체가 복사되지 않도록 public 폴더 기능은 끔
});
