import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"]
      },
      colors: {
        surface: "#F8F7FB",
        "surface-container": "#EFECF4",
        "surface-high": "#FFFFFF",
        "on-surface": "#1E1B24",
        "on-surface-variant": "#5E596B",
        primary: "#5A5AC9",
        "primary-soft": "#ECECFF",
        accent: "#0D9488",
        "accent-soft": "#CCFBF1",
        outline: "#D7D2E2",
        success: "#2E7D32",
        danger: "#C62828",
        warning: "#EF6C00"
      },
      boxShadow: {
        card: "0 2px 10px rgba(20, 16, 34, 0.08)",
        soft: "0 1px 3px rgba(20, 16, 34, 0.08)"
      },
      borderRadius: {
        xl2: "1.125rem"
      }
    }
  },
  plugins: []
};

export default config;
