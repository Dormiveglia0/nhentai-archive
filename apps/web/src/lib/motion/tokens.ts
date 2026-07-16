export const duration = { fast: 0.18, base: 0.28, slow: 0.5 } as const;

export const ease = {
  standard: [0.4, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  spring: { type: "spring", stiffness: 320, damping: 30 },
} as const;

export const stagger = { base: 0.05 } as const;
