import type { Config } from "tailwindcss";

/**
 * Jusic M3 Expressive — Tailwind extension preset
 * @see DESIGN.md and src/design-system/tokens/jusic-m3-tokens.css
 */
export const jm3TailwindPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        "jm3-primary": "var(--jm3-color-primary)",
        "jm3-surface": "var(--jm3-color-surface)",
        "jm3-on-surface": "var(--jm3-color-on-surface)",
        "jm3-on-surface-variant": "var(--jm3-color-on-surface-variant)",
        "jm3-outline": "var(--jm3-color-outline)"
      },
      borderRadius: {
        "jm3-sm": "var(--jm3-shape-sm)",
        "jm3-md": "var(--jm3-shape-md)",
        "jm3-lg": "var(--jm3-shape-lg)",
        "jm3-xl": "var(--jm3-shape-xl)",
        "jm3-full": "var(--jm3-shape-full)"
      },
      transitionTimingFunction: {
        "jm3-standard": "var(--jm3-motion-ease-standard)",
        "jm3-emphasized": "var(--jm3-motion-ease-emphasized)"
      },
      boxShadow: {
        "jm3-1": "var(--jm3-elevation-1)",
        "jm3-2": "var(--jm3-elevation-2)",
        "jm3-glow": "var(--jm3-glow-primary)"
      }
    }
  }
};
