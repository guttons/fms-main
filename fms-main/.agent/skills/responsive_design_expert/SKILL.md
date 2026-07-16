---
name: Responsive UI Design Expert
description: Guidelines for creating seamless, responsive, and readable interfaces across mobile, tablet, and desktop viewports in the MACL FMS dashboard.
---

# Responsive UI & Readability Design Specification

This guide defines the standards for developing highly-responsive, readable, and consistent layouts across mobile, tablet, and desktop screen sizes within the MACL Fuel Management System.

---

## 1. Breakpoint Grid Specification

Design interfaces systematically using standard breakpoints:

| Target Device | CSS Breakpoint | Navigation Strategy | Layout Structure | Spacing System |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` (default) | [BottomNav](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/components/BottomNav.tsx) (Fixed Bottom) | Single column layout (`flex-col`) | `p-4` (16px), `space-y-4` |
| **Tablet** | `768px` to `1024px` (`md:`) | Collapsing drawer/header menu | 2-column grid (`grid-cols-2`) | `p-6` (24px), `gap-6` |
| **Desktop** | `> 1024px` (`lg:`) | [Sidebar](file:///c:/Users/a-6600/OneDrive%20-%20Maldives%20Airports%20Company%20Ltd/Documents/fms-main/fms-main/components/Sidebar.tsx) (Left Side Panel) | Multi-column grid (`grid-cols-3`+) | `p-8` (32px), `gap-8` |

### Responsive Containers
- Standardize full-canvas layout containers with:
  ```html
  <div class="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
  ```

---

## 2. Typography & Readability Constraints

To keep layout elements highly viewable and legible under extreme ambient operating environments:
- **Font Sizing (Fluid Hierarchy)**: Use matching scaling prefixes:
  - Primary Headlines: `text-2xl md:text-3xl lg:text-4xl`
  - Section Titles: `text-lg md:text-xl`
  - Data Values: `text-sm md:text-base`
- **Line Length Limits**: Limit paragraphs or logs viewability width using `max-w-prose` (around 60ch) to prevent horizontal scan fatigue.
- **Contrast**: Rely on native HSL theme variables (e.g. `var(--color-on-surface)`). Never hardcode pure gray scale values (`#666`, `#333`) directly in inline styles.

---

## 3. Data Ingestion Density & Charts

### Data Tables
- Always wrap data-heavy elements or raw tables in a scrollable horizontal container:
  ```html
  <div class="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
    <table class="min-w-full">...</table>
  </div>
  ```
- **Mobile Card Fallback**: On screens `< 640px` (mobile), prefer converting complex table rows into discrete summary cards with toggle expanders to see detailed metrics.

### Visualizations & Charts
- Wrap SVG elements (e.g. `Recharts` graphs) inside a `<ResponsiveContainer width="100%" height={...}>` to automatically adapt parent resizing.
- Limit chart heights dynamically to avoid displacing content views:
  - Mobile: `h-[250px]` to `h-[300px]`
  - Tablet/Desktop: `h-[350px]` to `h-[450px]`

---

## 4. Interactive Elements & Touch Targets

- **Target Size**: Minimum interactive height and width must be `44px` (or `11rem` Tailwind equivalents) for mobile and tablet controls.
- **Spacing**: Keep action controls separated by at least `8px` (`space-x-2` / `gap-2`) to avoid accidental taps.
- **Hover Styles Exclusion**: Exclude hover effects on touch-based viewports to avoid sticky/active states:
  ```css
  @media (hover: hover) {
    .btn-action:hover {
      background-color: var(--color-primary-container);
    }
  }
  ```
- **Focus Rings**: Standardize active/focused states for accessibility:
  ```html
  <button class="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  ```
