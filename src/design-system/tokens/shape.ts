/** Shape morph keys for layout-driven radius transitions */

export const JM3_SHAPE = {
  none: "0",
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  full: "9999px"
} as const;

export type Jm3ShapeKey = keyof typeof JM3_SHAPE;
