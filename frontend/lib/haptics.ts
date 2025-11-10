/**
 * Haptic feedback utility for mobile devices
 * Provides different vibration patterns for various interactions
 */

export type HapticPattern =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "error"
  | "selection"
  | "impact"
  | "warning";

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  error: [10, 40, 10, 40, 10],
  selection: 15,
  impact: 25,
  warning: [50, 100, 50],
};

/**
 * Trigger haptic feedback
 * @param pattern - The haptic pattern to use
 * @returns true if vibration was triggered, false otherwise
 */
export function haptic(pattern: HapticPattern = "light"): boolean {
  // Check if vibration API is available
  if (!navigator.vibrate) {
    return false;
  }

  try {
    const vibrationPattern = patterns[pattern];
    navigator.vibrate(vibrationPattern);
    return true;
  } catch (error) {
    console.warn("Haptic feedback failed:", error);
    return false;
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic(): void {
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return "vibrate" in navigator;
}

/**
 * Custom vibration pattern
 * @param pattern - Custom pattern (number or array of numbers)
 */
export function customHaptic(pattern: number | number[]): boolean {
  if (!navigator.vibrate) {
    return false;
  }

  try {
    navigator.vibrate(pattern);
    return true;
  } catch (error) {
    console.warn("Custom haptic feedback failed:", error);
    return false;
  }
}
