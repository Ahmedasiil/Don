import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        paper: "#FFFFFF",
        ink: "#0B1020",
        navy: { DEFAULT: "#0B1020", 600: "#161B2B", 400: "#2A3145" },
        blue: { DEFAULT: "#2E5BFF", 600: "#2449D8", 50: "#EEF2FF" },
        sky: "#EEF2FF",
        line: "#E7E9EF",
        muted: "#667085",
        ok: "#0E9F66",
        warn: "#C77C00",
        crit: "#D9334C",
      },
      fontFamily: {
        display: ["var(--font-display)", "Sora", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,12,23,.04), 0 8px 24px -12px rgba(11,16,32,.12)",
        lift: "0 24px 60px -24px rgba(11,16,32,.35)",
        glow: "0 0 0 1px rgba(46,91,255,.15), 0 12px 40px -12px rgba(46,91,255,.45)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pulseRing: { "0%": { transform: "scale(.8)", opacity: ".7" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
      animation: {
        rise: "rise .7s cubic-bezier(.2,.7,.2,1) both",
        float: "float 6s ease-in-out infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
