/**
 * dateParser.ts — Natural Language Date/Time Parser for AI Assistant
 * 
 * Extracts structured date ranges from natural language queries.
 * All dates are computed relative to the current time in Maldives timezone (UTC+5).
 * 
 * Supports:
 *  - Relative terms: today, yesterday, last week, this week, last month, this month, this year, last year
 *  - Numeric ranges: last 7 days, past 30 days, last 3 months
 *  - Explicit ranges: from July 1 to July 15, between 2026-01-01 and 2026-03-31
 *  - Specific dates: on July 25, on 25th July, 2026-07-25
 *  - Month names: January 2026, Jan 2026, January
 *  - Quarters: Q1 2026, Q2, Q3 2025
 *  - Shift awareness: morning shift, evening shift, night shift
 */

export interface ParsedDateRange {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  label: string;      // Human-readable label e.g. "Last 7 Days", "July 2026"
  shiftFilter?: 'morning' | 'evening' | 'night';
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Get the current date/time in Maldives timezone (UTC+5).
 * Returns a Date object adjusted to MVT.
 */
function getMaldivesNow(): Date {
  const now = new Date();
  // Convert to Maldives timezone by computing UTC offset
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (5 * 3600000)); // UTC+5
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getEndOfWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Parse a natural language query and extract a date range.
 * Returns null if no date/time expression is found.
 */
export function parseDateRange(query: string): ParsedDateRange | null {
  const q = query.toLowerCase().trim();
  const now = getMaldivesNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Detect shift filter (can co-exist with date range) ────────────────
  let shiftFilter: 'morning' | 'evening' | 'night' | undefined;
  if (/morning\s*shift|am\s*shift/i.test(q)) shiftFilter = 'morning';
  else if (/evening\s*shift|afternoon\s*shift|pm\s*shift/i.test(q)) shiftFilter = 'evening';
  else if (/night\s*shift|graveyard/i.test(q)) shiftFilter = 'night';

  // ── 1. ISO date range: "between YYYY-MM-DD and YYYY-MM-DD" or "from YYYY-MM-DD to YYYY-MM-DD"
  const isoRangeMatch = q.match(/(?:between|from)\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})/);
  if (isoRangeMatch) {
    return {
      startDate: isoRangeMatch[1],
      endDate: isoRangeMatch[2],
      label: `${isoRangeMatch[1]} to ${isoRangeMatch[2]}`,
      shiftFilter,
    };
  }

  // ── 2. Named month range: "from July 1 to July 15" or "from 1 July to 15 July"
  const monthNames = Object.keys(MONTH_NAMES).filter(k => k.length > 2).join('|');
  // Pattern: "from <month> <day> to <month> <day>" or "from <day> <month> to <day> <month>"
  const namedRangeRegex = new RegExp(
    `(?:between|from)\\s+(?:(${monthNames})\\s+(\\d{1,2})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames}))\\s+(?:and|to)\\s+(?:(${monthNames})\\s+(\\d{1,2})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames}))`,
    'i'
  );
  const namedRangeMatch = q.match(namedRangeRegex);
  if (namedRangeMatch) {
    const startMonth = MONTH_NAMES[(namedRangeMatch[1] || namedRangeMatch[4]).toLowerCase()];
    const startDay = parseInt(namedRangeMatch[2] || namedRangeMatch[3]);
    const endMonth = MONTH_NAMES[(namedRangeMatch[5] || namedRangeMatch[8]).toLowerCase()];
    const endDay = parseInt(namedRangeMatch[6] || namedRangeMatch[7]);
    const year = now.getFullYear();
    const s = new Date(year, startMonth, startDay);
    const e = new Date(year, endMonth, endDay);
    return {
      startDate: formatDate(s),
      endDate: formatDate(e),
      label: `${formatDate(s)} to ${formatDate(e)}`,
      shiftFilter,
    };
  }

  // ── 3. Specific ISO date: "on 2026-07-25"
  const isoSpecific = q.match(/(?:on\s+)?(\d{4}-\d{2}-\d{2})/);
  if (isoSpecific && !isoRangeMatch) {
    return {
      startDate: isoSpecific[1],
      endDate: isoSpecific[1],
      label: isoSpecific[1],
      shiftFilter,
    };
  }

  // ── 4. Specific named date: "on July 25" / "on 25th July" / "July 25, 2026"
  const specificDateRegex = new RegExp(
    `(?:on\\s+)?(?:(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthNames}))(?:\\s*,?\\s*(\\d{4}))?`,
    'i'
  );
  const specificDateMatch = q.match(specificDateRegex);
  if (specificDateMatch) {
    const monthStr = (specificDateMatch[1] || specificDateMatch[4]).toLowerCase();
    const dayNum = parseInt(specificDateMatch[2] || specificDateMatch[3]);
    const yearNum = specificDateMatch[5] ? parseInt(specificDateMatch[5]) : now.getFullYear();
    const monthIdx = MONTH_NAMES[monthStr];
    if (monthIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
      const d = new Date(yearNum, monthIdx, dayNum);
      const monthLabel = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
      return {
        startDate: formatDate(d),
        endDate: formatDate(d),
        label: `${monthLabel} ${dayNum}, ${yearNum}`,
        shiftFilter,
      };
    }
  }

  // ── 5. Quarter: "Q1 2026", "Q3", "q2 2025"
  const quarterMatch = q.match(/q([1-4])(?:\s*(\d{4}))?/i);
  if (quarterMatch) {
    const qNum = parseInt(quarterMatch[1]);
    const year = quarterMatch[2] ? parseInt(quarterMatch[2]) : now.getFullYear();
    const startMonth = (qNum - 1) * 3;
    const endMonth = startMonth + 2;
    const s = new Date(year, startMonth, 1);
    const e = new Date(year, endMonth, getLastDayOfMonth(year, endMonth));
    return {
      startDate: formatDate(s),
      endDate: formatDate(e),
      label: `Q${qNum} ${year}`,
      shiftFilter,
    };
  }

  // ── 6. Named month (standalone): "January 2026", "Jan 2026", "January"
  const monthYearRegex = new RegExp(`(${monthNames})(?:\\s+(\\d{4}))?`, 'i');
  const monthYearMatch = q.match(monthYearRegex);
  // Only match if it's clearly a month query (not just part of a date like "on July 25")
  if (monthYearMatch && !specificDateMatch && !namedRangeMatch) {
    const monthStr = monthYearMatch[1].toLowerCase();
    const monthIdx = MONTH_NAMES[monthStr];
    if (monthIdx !== undefined) {
      const year = monthYearMatch[2] ? parseInt(monthYearMatch[2]) : now.getFullYear();
      const s = new Date(year, monthIdx, 1);
      const e = new Date(year, monthIdx, getLastDayOfMonth(year, monthIdx));
      const monthLabel = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
      return {
        startDate: formatDate(s),
        endDate: formatDate(e),
        label: `${monthLabel} ${year}`,
        shiftFilter,
      };
    }
  }

  // ── 7. "last N days/weeks/months/years" or "past N days" ───────────────
  const lastNMatch = q.match(/(?:last|past|previous)\s+(\d+)\s+(day|week|month|year)s?/i);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1]);
    const unit = lastNMatch[2].toLowerCase();
    let s: Date;
    if (unit === 'day') {
      s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
    } else if (unit === 'week') {
      s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n * 7));
    } else if (unit === 'month') {
      s = new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    } else {
      s = new Date(today.getFullYear() - n, today.getMonth(), today.getDate());
    }
    return {
      startDate: formatDate(s),
      endDate: formatDate(today),
      label: `Last ${n} ${unit}${n > 1 ? 's' : ''}`,
      shiftFilter,
    };
  }

  // ── 8. Relative terms ─────────────────────────────────────────────────
  if (q.includes('today') || q.includes('today\'s')) {
    return {
      startDate: formatDate(today),
      endDate: formatDate(today),
      label: 'Today',
      shiftFilter,
    };
  }

  if (q.includes('yesterday') || q.includes('yesterday\'s')) {
    const yday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return {
      startDate: formatDate(yday),
      endDate: formatDate(yday),
      label: 'Yesterday',
      shiftFilter,
    };
  }

  if (q.includes('this week')) {
    const weekStart = getStartOfWeek(today);
    return {
      startDate: formatDate(weekStart),
      endDate: formatDate(today),
      label: 'This Week',
      shiftFilter,
    };
  }

  if (q.includes('last week') || q.includes('previous week')) {
    const prevWeekEnd = new Date(getStartOfWeek(today).getTime() - 86400000);
    const prevWeekStart = getStartOfWeek(prevWeekEnd);
    return {
      startDate: formatDate(prevWeekStart),
      endDate: formatDate(getEndOfWeek(prevWeekEnd)),
      label: 'Last Week',
      shiftFilter,
    };
  }

  if (q.includes('this month')) {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: formatDate(monthStart),
      endDate: formatDate(today),
      label: 'This Month',
      shiftFilter,
    };
  }

  if (q.includes('last month') || q.includes('previous month')) {
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      startDate: formatDate(prevMonthStart),
      endDate: formatDate(prevMonthEnd),
      label: 'Last Month',
      shiftFilter,
    };
  }

  if (q.includes('this year')) {
    const yearStart = new Date(today.getFullYear(), 0, 1);
    return {
      startDate: formatDate(yearStart),
      endDate: formatDate(today),
      label: `This Year (${today.getFullYear()})`,
      shiftFilter,
    };
  }

  if (q.includes('last year') || q.includes('previous year')) {
    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
    return {
      startDate: formatDate(lastYearStart),
      endDate: formatDate(lastYearEnd),
      label: `Last Year (${today.getFullYear() - 1})`,
      shiftFilter,
    };
  }

  // ── 9. Shift-only (no date specified → assume today) ──────────────────
  if (shiftFilter && !q.includes('last') && !q.includes('previous')) {
    return {
      startDate: formatDate(today),
      endDate: formatDate(today),
      label: `Today — ${shiftFilter.charAt(0).toUpperCase() + shiftFilter.slice(1)} Shift`,
      shiftFilter,
    };
  }

  // ── No date expression found ──────────────────────────────────────────
  return null;
}

/**
 * Extract the date label from a parsed range for display purposes.
 */
export function formatDateLabel(range: ParsedDateRange): string {
  if (range.startDate === range.endDate) {
    return range.label;
  }
  return `${range.label} (${range.startDate} → ${range.endDate})`;
}
