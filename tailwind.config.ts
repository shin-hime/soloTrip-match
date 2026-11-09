import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#050816", 900: "#090e20", 800: "#0e1429", 700: "#151c35", 600: "#1d2642", 500: "#2a3558" },
        brand: { DEFAULT: "#00e0c6", dark: "#00bfa9", soft: "#00e0c61f" },
        violet: { brand: "#7c3aed", soft: "#7c3aed26" },
        muted: "#8b93ad",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      boxShadow: { glow: "0 0 28px rgba(0,224,198,.45)" },
    },
  },
  plugins: [],
};
export default config;
