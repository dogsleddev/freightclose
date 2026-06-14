import type { Config } from "tailwindcss";

// Palette + type matched to dogsled.dev ("a builder's log for modern finance"):
// deep ink + warm parchment, with burnt-orange / sky-blue / pine accents.
// We remap Tailwind's slate/emerald/amber/sky/red scales to the dogsled palette
// so existing utility classes inherit the brand without per-element edits.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // brand tokens
        ink: "#0e1116",
        "ink-soft": "#161a21",
        "ink-line": "#2a3038",
        parchment: { DEFAULT: "#f4eddb", light: "#faf6ec", deep: "#ede3cd" },
        trail: { DEFAULT: "#e66a3c", dark: "#c25431" },
        // sky-700 is var-driven so accent TEXT lightens in dark mode (it otherwise
        // falls back to Tailwind's dark default and fails contrast on dark cards).
        sky: { DEFAULT: "#8fb8d6", dark: "#4a779e", 700: "rgb(var(--sky-700) / <alpha-value>)" },
        pine: { DEFAULT: "#6fe0b4", dark: "#2a8e6d" },

        // Surface (the card "white") and the warm-gray text/border scale are
        // driven by CSS variables so light/dark flips with one class on <html>
        // and every existing bg-white / slate-* / border-slate-* utility (and
        // its /alpha variants) inherits — no per-component dark: classes.
        // Light values are byte-identical to the original parchment palette.
        white: "rgb(var(--surface) / <alpha-value>)",
        slate: {
          50: "rgb(var(--slate-50) / <alpha-value>)",
          100: "rgb(var(--slate-100) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
          700: "rgb(var(--slate-700) / <alpha-value>)",
          800: "rgb(var(--slate-800) / <alpha-value>)",
          900: "rgb(var(--slate-900) / <alpha-value>)",
        },
        // good / pass / engine-win -> pine green
        emerald: {
          50: "#e8f6ef",
          100: "#cdeede",
          200: "#a6e1c6",
          300: "#74cfa6",
          500: "#2fa379",
          600: "#2a8e6d",
          700: "rgb(var(--emerald-700) / <alpha-value>)",
          800: "#1c5e48",
        },
        // warn / attention -> trail orange
        amber: {
          50: "#fdefe6",
          100: "#f9ddca",
          200: "#f2c3a1",
          300: "#e89b6f",
          500: "#e66a3c",
          700: "rgb(var(--amber-700) / <alpha-value>)",
          800: "#9e4327",
        },
        // error / over -> brick
        red: {
          50: "#fbe9e3",
          100: "#f6d2c7",
          200: "#edae9d",
          500: "#c2452f",
          700: "rgb(var(--red-700) / <alpha-value>)",
          800: "#882e1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "ui-serif", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
