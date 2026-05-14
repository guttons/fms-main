/**
 * Shared equipment badge color utilities — used across all components.
 * Color is determined by equipment ID and prefix.
 */

function getEquipmentColorGroup(vehicleId: string): 'yellow' | 'blue' | 'green' | 'monochrome' | 'red' | 'default' {
  const id = vehicleId?.toUpperCase() ?? '';
  if (id.startsWith('HD')) return 'red';
  
  if (id.startsWith('RF')) {
    if (['RF-04', 'RF-06', 'RF-07'].includes(id)) return 'yellow';
    if (['RF-10', 'RF-11', 'RF-12'].includes(id)) return 'blue';
    if (['RF-14', 'RF-15'].includes(id)) return 'green';
    if (['RF-16', 'RF-17'].includes(id)) return 'monochrome';
    return 'yellow'; // default RF color
  }
  
  if (id.startsWith('DT')) return 'green';
  if (id.startsWith('HS')) return 'monochrome';
  
  return 'default';
}

/**
 * Returns Tailwind classes for a solid equipment badge.
 */
export function equipmentBadgeClass(vehicleId: string): string {
  const group = getEquipmentColorGroup(vehicleId);
  switch (group) {
    case 'red': return 'bg-red-600 text-white border-red-700';
    case 'yellow': return 'bg-amber-500 text-white border-amber-600';
    case 'blue': return 'bg-sky-500 text-white border-sky-600';
    case 'green': return 'bg-emerald-600 text-white border-emerald-700';
    case 'monochrome': return 'bg-slate-700 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900';
    default: return 'bg-slate-500 text-white border-slate-600';
  }
}

/**
 * Returns a subtle (tinted background) badge variant.
 */
export function equipmentBadgeSoftClass(vehicleId: string): string {
  const group = getEquipmentColorGroup(vehicleId);
  switch (group) {
    case 'red': return 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400';
    case 'yellow': return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
    case 'blue': return 'bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400';
    case 'green': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400';
    case 'monochrome': return 'bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-400';
    default: return 'bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-400';
  }
}

/**
 * Returns the dot/indicator color for a given vehicle ID.
 */
export function equipmentDotClass(vehicleId: string): string {
  const group = getEquipmentColorGroup(vehicleId);
  switch (group) {
    case 'red': return 'bg-red-600';
    case 'yellow': return 'bg-amber-500';
    case 'blue': return 'bg-sky-500';
    case 'green': return 'bg-emerald-600';
    case 'monochrome': return 'bg-slate-600 dark:bg-slate-300';
    default: return 'bg-slate-500';
  }
}
/**
 * Returns the hex color code for a given vehicle ID.
 */
export function getEquipmentHexColor(vehicleId: string): string {
  const group = getEquipmentColorGroup(vehicleId);
  switch (group) {
    case 'red': return '#ef4444';
    case 'yellow': return '#f59e0b';
    case 'blue': return '#0ea5e9';
    case 'green': return '#10b981';
    case 'monochrome': return '#94a3b8'; // slate-400
    default: return '#94a3b8';
  }
}
