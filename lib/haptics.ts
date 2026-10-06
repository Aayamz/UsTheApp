// Feature-detected haptic vibration utilities per AGENTS.md specification

export function triggerHaptic(pattern: number | number[]) {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if unsupported by permission policy
    }
  }
}

export const Haptics = {
  // Spark mutual answer reveal celebrate (light double pulse: [40, 60, 40])
  sparkReveal: () => triggerHaptic([40, 60, 40]),

  // Someday time capsule unlock (pop vibration: [70])
  capsuleUnlock: () => triggerHaptic(70),

  // Pick mutual match celebration (pattern: [50, 50, 100])
  pickMatch: () => triggerHaptic([50, 50, 100]),

  // Nudge send/receive (soft tap: [30])
  nudgeSent: () => triggerHaptic(30),
  softTap: () => triggerHaptic(30),

  // Standard interactive micro-tap
  lightTap: () => triggerHaptic(15),
};
