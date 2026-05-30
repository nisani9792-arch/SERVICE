import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"]
      },
      colors: {
        "jm3-primary": "var(--jm3-color-primary)",
        "jm3-surface": "var(--jm3-color-surface)",
        "jm3-on-surface": "var(--jm3-color-on-surface)",
        "jm3-outline": "var(--jm3-color-outline)",
        surface: "var(--j-surface)",
        "surface-container": "var(--j-surface-container)",
        "surface-high": "var(--j-surface-high)",
        "on-surface": "var(--j-on-surface)",
        "on-surface-variant": "var(--j-on-surface-variant)",
        primary: "var(--j-primary)",
        "primary-soft": "var(--j-primary-soft)",
        accent: "var(--j-accent)",
        "accent-soft": "var(--j-accent-soft)",
        outline: "var(--j-outline)",
        success: "var(--j-success)",
        danger: "var(--j-danger)",
        warning: "var(--j-warning)",
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          600: "#475569",
          900: "#0f172a"
        },
        indigo: {
          50: "#eef2ff",
          200: "#c7d2fe",
          600: "#4f46e5",
          700: "#4338ca"
        },
        emerald: {
          50: "#ecfdf5",
          200: "#a7f3d0"
        }
      },
      boxShadow: {
        glow: "var(--j-glow-primary)",
        "glow-sm": "var(--j-glow-sm)",
        "glow-accent": "var(--j-glow-accent)",
        glass: "var(--j-glass-edge)"
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.5rem"
      },
      backdropBlur: {
        glass: "20px"
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};

export default config;
