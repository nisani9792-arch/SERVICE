/** Framer Motion / JS motion constants — mirror CSS tokens */

export const JM3_EASE_EMPHASIZED = [0.22, 1, 0.36, 1] as const;

export const JM3_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85
};

export const JM3_SPRING_SNAPPY = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.75
};

export const JM3_DURATION = {
  instant: 0.1,
  short: 0.15,
  medium: 0.28,
  long: 0.42
};
