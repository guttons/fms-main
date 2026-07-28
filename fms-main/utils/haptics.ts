/**
 * Centralized Haptic Feedback Utility
 * 
 * Provides tactile vibration feedback on Android via navigator.vibrate().
 * On iOS (where vibrate() is blocked), falls back to a subtle visual
 * micro-animation on the triggering element.
 * 
 * User preference is persisted in localStorage under 'fms-haptics-enabled'.
 */

// ── Vibration Patterns ────────────────────────────────────────────────────────
export const HapticPattern = {
  TAP:          [10],                     // Light single tap — nav press, toggle
  SUCCESS:      [15, 50, 15],             // Double pulse — form success, job complete
  WARNING:      [30, 30, 60],             // Escalating — validation error, alert
  ERROR:        [80, 50, 80, 50, 80],     // Triple heavy — critical error, access denied
  PULL_REFRESH: [5],                      // Subtle tick — pull threshold reached
  LONG_PRESS:   [20],                     // Medium — long press confirmed
  SELECTION:    [8],                      // Ultra-light — dropdown selection
  TOGGLE:       [12],                     // Soft — switch/checkbox toggle
} as const;

export type HapticType = keyof typeof HapticPattern;

// ── Preference Management ─────────────────────────────────────────────────────
const HAPTIC_STORAGE_KEY = 'fms-haptics-enabled';

export function isHapticEnabled(): boolean {
  try {
    const stored = localStorage.getItem(HAPTIC_STORAGE_KEY);
    // Default to enabled if not set
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setHapticEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTIC_STORAGE_KEY, String(enabled));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ── Reduced Motion Check ──────────────────────────────────────────────────────
const REDUCED_MOTION_STORAGE_KEY = 'fms-reduced-motion';

export function isReducedMotion(): boolean {
  try {
    const stored = localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch { /* fall through */ }
  // Respect OS-level prefers-reduced-motion by default
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function setReducedMotion(enabled: boolean): void {
  try {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(enabled));
  } catch { /* ignore */ }
}

// ── Core Haptic Function ──────────────────────────────────────────────────────
/**
 * Fire a haptic feedback pattern.
 * 
 * @param type - The haptic pattern name (TAP, SUCCESS, WARNING, etc.)
 * @param element - Optional DOM element to apply visual fallback on iOS
 */
export function haptic(type: HapticType, element?: HTMLElement | null): void {
  if (!isHapticEnabled()) return;

  const pattern = HapticPattern[type];

  // Try native vibration (Android Chrome, some desktop browsers)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
      return;
    } catch {
      // vibrate() threw — fall through to visual fallback
    }
  }

  // Visual fallback for iOS and unsupported browsers
  // Apply a brief scale micro-animation to the element
  if (element && !isReducedMotion()) {
    applyVisualFeedback(element, type);
  }
}

/**
 * Visual micro-feedback for platforms without vibration.
 * Applies a brief CSS scale transform animation.
 */
function applyVisualFeedback(element: HTMLElement, type: HapticType): void {
  const intensity = getVisualIntensity(type);
  const duration = getVisualDuration(type);

  // Store original transform
  const originalTransform = element.style.transform;

  element.style.transition = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
  element.style.transform = `scale(${intensity})`;

  // Spring back
  requestAnimationFrame(() => {
    setTimeout(() => {
      element.style.transform = originalTransform || '';
      // Clean up transition after animation completes
      setTimeout(() => {
        element.style.transition = '';
      }, duration);
    }, duration / 2);
  });
}

function getVisualIntensity(type: HapticType): number {
  switch (type) {
    case 'TAP':
    case 'SELECTION':
      return 0.97;
    case 'SUCCESS':
    case 'TOGGLE':
      return 0.95;
    case 'PULL_REFRESH':
    case 'LONG_PRESS':
      return 0.96;
    case 'WARNING':
      return 0.94;
    case 'ERROR':
      return 0.92;
    default:
      return 0.97;
  }
}

function getVisualDuration(type: HapticType): number {
  switch (type) {
    case 'TAP':
    case 'SELECTION':
    case 'PULL_REFRESH':
      return 100;
    case 'SUCCESS':
    case 'TOGGLE':
    case 'LONG_PRESS':
      return 150;
    case 'WARNING':
      return 180;
    case 'ERROR':
      return 250;
    default:
      return 120;
  }
}
