/**
 * Centralized Haptic Feedback Utility
 * 
 * Provides tactile vibration feedback on Android via navigator.vibrate().
 * On iOS (where vibrate() is blocked), falls back to a subtle visual
 * micro-animation on the triggering element.
 * 
 * User preference is persisted in localStorage under 'fms-haptics-enabled'.
 */

// ── Vibration Patterns (Refined & Lightened for Premium Feel) ────────────────
export const HapticPattern = {
  TAP:          [10],                     // Crisp 10ms tick
  SUCCESS:      [12, 35, 12],             // Light double tick
  WARNING:      [16, 25, 18],             // Subtle warning pulse
  ERROR:        [25, 30, 25],             // Gentle error double pulse
  PULL_REFRESH: [8],                      // Micro tick
  LONG_PRESS:   [15],                     // Soft hold tick
  SELECTION:    [10],                     // Micro selection tick
  TOGGLE:       [14, 25, 14],             // Crisp double toggle tick
} as const;

export type HapticType = keyof typeof HapticPattern;

// ── Preference Management ─────────────────────────────────────────────────────
const HAPTIC_STORAGE_KEY = 'fms-haptics-enabled';

export function isHapticEnabled(): boolean {
  try {
    const stored = localStorage.getItem(HAPTIC_STORAGE_KEY);
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

  // Try native vibration (Android Chrome, supported mobile webviews)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    // Check Chrome User Activation requirement to prevent browser intervention warnings
    if ('userActivation' in navigator && !(navigator as any).userActivation?.hasBeenActive) {
      return;
    }
    try {
      navigator.vibrate(pattern);
      return;
    } catch {
      // fall through to visual fallback
    }
  }

  // Visual fallback for iOS
  if (element && !isReducedMotion()) {
    applyVisualFeedback(element, type);
  }
}

/**
 * Visual micro-feedback for platforms without vibration.
 * Applies a brief scale micro-animation.
 */
function applyVisualFeedback(element: HTMLElement, type: HapticType): void {
  const intensity = getVisualIntensity(type);
  const duration = getVisualDuration(type);

  const originalTransform = element.style.transform;

  element.style.transition = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
  element.style.transform = `scale(${intensity})`;

  requestAnimationFrame(() => {
    setTimeout(() => {
      element.style.transform = originalTransform || '';
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
    case 'PULL_REFRESH':
      return 0.988;
    case 'SUCCESS':
    case 'TOGGLE':
    case 'LONG_PRESS':
      return 0.978;
    case 'WARNING':
    case 'ERROR':
      return 0.968;
    default:
      return 0.988;
  }
}

function getVisualDuration(type: HapticType): number {
  switch (type) {
    case 'TAP':
    case 'SELECTION':
    case 'PULL_REFRESH':
      return 80;
    case 'SUCCESS':
    case 'TOGGLE':
    case 'LONG_PRESS':
      return 120;
    case 'WARNING':
      return 150;
    case 'ERROR':
      return 180;
    default:
      return 100;
  }
}
