import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // OPTX JettChat design system (Scira-inspired, custom branded)
        background: "#0a0a0a",
        surface: "#111111",
        card: "#1a1a1a",
        border: "#2a2a2a",
        "border-hover": "#3a3a3a",
        accent: {
          DEFAULT: "#f5e6c8",
          muted: "#c4a97d",
          dim: "#8b7355",
        },
        text: {
          primary: "#e8e8e8",
          secondary: "#888888",
          muted: "#555555",
        },
        badge: {
          pro: "#f5e6c8",
          beta: "#88ccff",
          max: "#ff8855",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
