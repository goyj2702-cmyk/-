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
      },
      animation: {
        "view-in": "viewIn .35s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
