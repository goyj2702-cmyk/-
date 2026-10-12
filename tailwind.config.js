/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "system-ui", "sans-serif"],
      },
      keyframes: {
        viewIn: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        // NEW 뱃지 위를 빛이 스쳐 지나가는 효과
        shine: { "0%": { transform: "translateX(-120%)" }, "60%, 100%": { transform: "translateX(220%)" } },
        // 읽음 체크 시 체크 아이콘이 톡 튀어나오는 효과
        pop: { "0%": { transform: "scale(.4)", opacity: "0" }, "70%": { transform: "scale(1.2)" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "view-in": "viewIn .35s cubic-bezier(.2,.7,.2,1) both",
        shine: "shine 2.4s ease-in-out infinite",
        pop: "pop .3s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
