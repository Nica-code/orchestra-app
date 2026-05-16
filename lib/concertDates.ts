import { format, parseISO } from 'date-fns';

/** Parses a YYYY-MM-DD string as a local date (avoids UTC off-by-one). */
function toDate(d: string): Date {
  return parseISO(d.length === 10 ? `${d}T00:00:00` : d);
}

/** "Friday, November 7, 2025" for one date, compact list for several. */
export function formatConcertDates(dates: string[] | null | undefined): string {
  if (!dates || dates.length === 0) return 'No dates set';
  const sorted = [...dates].sort();
  if (sorted.length === 1) return format(toDate(sorted[0]), 'EEEE, MMMM d, yyyy');
  // group by year for compactness
  const year = format(toDate(sorted[sorted.length - 1]), 'yyyy');
  const parts = sorted.map((d) => format(toDate(d), 'MMM d'));
  return `${parts.join(', ')}, ${year}`;
}

/** Short label, e.g. "Nov 7, 2025" (first date). */
export function formatConcertDateShort(dates: string[] | null | undefined): string {
  if (!dates || dates.length === 0) return '—';
  const first = [...dates].sort()[0];
  return format(toDate(first), 'MMM d, yyyy');
}

/** Combined rehearsal + performance summary line. */
export function formatFullSchedule(performance: string[], rehearsal: string[] | null): string {
  const perf = formatConcertDates(performance);
  if (rehearsal && rehearsal.length > 0) {
    const reh = [...rehearsal].sort().map((d) => format(toDate(d), 'MMM d')).join(', ');
    return `${reh} (Rehearsals) • ${perf} (Performances)`;
  }
  return perf;
}
