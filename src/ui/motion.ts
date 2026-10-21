// Shared motion values (plan §6). Springs for movement, ease-out for fades.
export const ease = [0.2, 0.8, 0.2, 1] as const
export const spring = { type: 'spring', stiffness: 380, damping: 32 } as const
export const springSoft = { type: 'spring', stiffness: 260, damping: 30 } as const
export const fade = { duration: 0.18, ease } as const
export const springSheet = { type: 'spring', stiffness: 400, damping: 40 } as const
export const easeInOut = [0.77, 0, 0.175, 1] as const
