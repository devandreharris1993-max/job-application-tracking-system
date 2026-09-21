/** `YYYY-MM-DD` from the API is a calendar date, not a UTC instant. `new Date("2026-09-20")`
 * parses as UTC midnight, which in US timezones becomes the previous local day — so chart labels
 * and "Applied" dates were shown one day early. Constructing the Date from local Y/M/D parts
 * keeps the printed day equal to the stored date. */
export function calendarDateKey(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return dateOnly ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` : value.slice(0, 10);
}

function dateFromApiValue(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly && !value.includes('T')) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

export function formatDate(value: string): string {
  return dateFromApiValue(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDate(value: string): string {
  return dateFromApiValue(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
