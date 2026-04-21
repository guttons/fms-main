/**
 * Shared equipment badge color utilities — used across all components.
 * Color is determined by equipment ID prefix (vehicle type).
 */

/**
 * Returns Tailwind classes for a solid equipment badge based on the vehicle ID prefix.
 * RF → amber, HD → crimson, DT → emerald, HS → violet, default → slate
 */
export function equipmentBadgeClass(vehicleId: string): string {
  const id = vehicleId?.toUpperCase() ?? '';
  if (id.startsWith('RF')) return 'bg-amber-500 text-white border-amber-600';
  if (id.startsWith('HD')) return 'bg-red-600 text-white border-red-700';
  if (id.startsWith('DT')) return 'bg-emerald-600 text-white border-emerald-700';
  if (id.startsWith('HS')) return 'bg-violet-600 text-white border-violet-700';
  return 'bg-slate-500 text-white border-slate-600';
}

/**
 * Returns a subtle (tinted background) badge variant for inline use on cards.
 */
export function equipmentBadgeSoftClass(vehicleId: string): string {
  const id = vehicleId?.toUpperCase() ?? '';
  if (id.startsWith('RF')) return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
  if (id.startsWith('HD')) return 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400';
  if (id.startsWith('DT')) return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
  if (id.startsWith('HS')) return 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400';
  return 'bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-400';
}

/**
 * Returns the dot/indicator color for a given vehicle ID prefix.
 */
export function equipmentDotClass(vehicleId: string): string {
  const id = vehicleId?.toUpperCase() ?? '';
  if (id.startsWith('RF')) return 'bg-amber-500';
  if (id.startsWith('HD')) return 'bg-red-600';
  if (id.startsWith('DT')) return 'bg-emerald-600';
  if (id.startsWith('HS')) return 'bg-violet-600';
  return 'bg-slate-500';
}
