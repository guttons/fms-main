---
name: Aviation Fuel Operations Design System
description: Instructions for maintaining and applying the "Tactical Command" design system for Aviation Fuel Operations.
---

# Design System Specification: Aviation Fuel Operations

## 1. Creative North Star: "The Tactical Command"
- **Philosophy**: Mission-critical, high-stakes environment where data density coexists with immediate cognitive clarity.
- **Aesthetic**: "High-End Industrial"—deep aviation blues combined with laboratory-grade lightness.
- **Layout**: **Intentional Asymmetry**. Break traditional grids. Heavy data visualizations (70%) balanced by expansive white space or high-level labels (30%).

## 2. Colors & Tonal Layering
Do **not** use 1px solid borders. Structure is defined by background shifts.

### Tokens
- `--color-surface`: `#f7f9fb` (Global Canvas)
- `--color-surface-container-low`: `#f2f4f6` (Module Zones)
- `--color-surface-container-lowest`: `#ffffff` (Actionable Cards/Data)
- `--color-surface-container-highest`: `#e0e3e5` (Live Alerts/High Importance)
- `--color-primary`: `#002046` (Aviation Blue)
- `--color-primary-container`: `#1b365d`
- `--color-on-surface`: `#191c1e` (Primary Text - Never use pure black)
- `--color-outline-variant`: `rgba(196, 198, 207, 0.2)` (Ghost Border - Only for extreme density)
- `--color-error`: `#ba1a1a` (Critical)
- `--color-tertiary`: `#361900` (Warning/Low - Earthy Amber)

### Kinetic Gradient
Use a 135-degree gradient from `--color-primary` to `--color-primary-container` for CTAs.

## 3. Typography: Inter
- **Telemetry (Headline-LG)**: `2rem`, Semi-Bold. Primary focus.
- **Context (Title-MD)**: `1.125rem`, Medium. Module labels.
- **Data (Body-MD)**: `0.875rem`. Secondary metrics.
- **Meta (Label-SM)**: `0.6875rem`, All-Caps, `+0.05em` spacing. For "TANK ID," "LAST UPDATED," etc.

## 4. Components & Elevation

### Elevation
- **Shadow**: `0 12px 40px rgba(25, 28, 30, 0.06)` (Ambient diffusion).
- **Glassmorphism**: `surface_container_lowest` (80% opacity) + `backdrop-blur: 12px` for sticky alerts.

### Status Chips
- **Stable**: `on_secondary_container` on `secondary_container`.
- **Critical**: `on_error_container` on `error_container`.

### Rules
- **Radius**: `sm` (0.125rem) to `xl` (0.75rem). Max `xl`. Avoid "round" feel.
- **Spacing**: No dividers. Use 16px vertical spacing for lists.
- **Alerts**: 4px left-border accent in `error` for critical modules.
- **Pulse**: 6px pulse using `error` with 40% opacity outer ring for live telemetry.
