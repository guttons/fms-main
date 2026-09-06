/**
 * Centralized Haptic Feedback Utility
 * 
 * Provides tactile vibration feedback on Android via navigator.vibrate().
 * On iOS (where vibrate() is blocked), falls back to a subtle visual
 * micro-animation on the triggering element.
 * 
 * User preference is persisted in localStorage under 'fms-haptics-enabled'.
 */

// ── Vibration Patterns (Featherlight for Subtle Tactile Feel) ─────────────────
export const HapticPattern = {
  TAP:          [6],                      // Ultra-crisp 6ms micro tick
  NAV_TAP:      [4],                      // Featherlight 4ms tick for nav/sidebar
  SUCCESS:      [8, 25, 8],               // Gentle double tick
  WARNING:      [10, 20, 10],             // Soft warning pulse
  ERROR:        [15, 20, 15],             // Subtle error double pulse
  PULL_REFRESH: [5],                      // Micro tick
  LONG_PRESS:   [10],                     // Soft hold tick
  SELECTION:    [4],                      // Micro selection tick
  TOGGLE:       [5, 15, 5],              // Featherlight double toggle tick
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
let lastHapticTime = 0;
let lastHapticType = '';

export function haptic(type: HapticType, element?: HTMLElement | null): void {
  if (!isHapticEnabled()) return;

  const now = Date.now();
  // Prevent duplicate rapid calls (e.g. touchstart followed immediately by click/change within 60ms) from cancelling Android vibration
  if (now - lastHapticTime < 60 && lastHapticType === type) {
    return;
  }
  lastHapticTime = now;
  lastHapticType = type;

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
    case 'NAV_TAP':
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
    case 'NAV_TAP':
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
