import { useEffect, useMemo, useState } from 'react';
import type { DailyApplicationCount } from '../types';
import { calendarDateKey, formatDate } from '../utils/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function todayKey(): string {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface CalendarCell {
  key: string;
  day: number;
  inMonth: boolean;
}

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const prev = new Date(year, month, 0);
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = prev.getDate() - i;
    cells.push({
      key: dateKey(prev.getFullYear(), prev.getMonth(), day),
      day,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKey(year, month, day), day, inMonth: true });
  }

  const next = new Date(year, month + 1, 1);
  let day = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      key: dateKey(next.getFullYear(), next.getMonth(), day),
      day,
      inMonth: false,
    });
    day += 1;
  }

  return cells;
}

export function calendarDaysFromStats(stats: {
  dailyTrend: DailyApplicationCount[];
  calendarDays?: DailyApplicationCount[];
}): DailyApplicationCount[] {
  return stats.calendarDays ?? stats.dailyTrend.filter((point) => point.count > 0);
}

/** Month calendar that highlights days with tracked applications and filters the list below
 * when a day is clicked — same `trackedOn` date key as the 14-day chart. Days with no
 * applications keep the default cell style. */
export function ApplicationCalendar({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: DailyApplicationCount[];
  selectedDate?: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const point of days) {
      if (point.count > 0) map.set(calendarDateKey(point.date), point.count);
    }
    return map;
  }, [days]);

  const selectedKey = selectedDate ? calendarDateKey(selectedDate) : null;
  const [view, setView] = useState(() => {
    const parsed = selectedKey ? parseDateKey(selectedKey) : null;
    const now = new Date();
    return { year: parsed?.year ?? now.getFullYear(), month: parsed?.month ?? now.getMonth() };
  });

  useEffect(() => {
    if (!selectedKey) return;
    const parsed = parseDateKey(selectedKey);
    if (!parsed) return;
    setView((current) =>
      current.year === parsed.year && current.month === parsed.month
        ? current
        : { year: parsed.year, month: parsed.month },
    );
  }, [selectedKey]);

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view.year, view.month]);
  const today = todayKey();

  const goMonth = (delta: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => goMonth(-1)} className="btn-secondary btn-sm px-2" aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-900">{monthLabel(view.year, view.month)}</p>
        <button type="button" onClick={() => goMonth(1)} className="btn-secondary btn-sm px-2" aria-label="Next month">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = counts.get(cell.key) ?? 0;
          const hasApps = count > 0;
          const isSelected = selectedKey === cell.key;
          const isToday = cell.key === today;

          let className =
            'relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors ';
          if (!cell.inMonth) {
            className += isSelected
              ? hasApps
                ? 'bg-green-600 font-semibold text-white'
                : 'bg-slate-600 font-semibold text-white'
              : hasApps
                ? 'bg-green-50 font-medium text-green-600'
                : 'text-slate-300 hover:bg-slate-50';
          } else if (hasApps && isSelected) {
            className += 'bg-green-600 font-semibold text-white shadow-sm';
          } else if (hasApps) {
            className += 'bg-green-100 font-semibold text-green-800 hover:bg-green-200';
          } else if (isSelected) {
            className += 'bg-slate-700 font-semibold text-white shadow-sm';
          } else {
            className += 'text-slate-700 hover:bg-slate-50';
          }
          if (isToday && !isSelected) {
            className += ' ring-1 ring-inset ring-slate-300';
          }

          return (
            <button
              key={cell.key}
              type="button"
              className={className}
              aria-pressed={isSelected}
              aria-label={`${formatDate(cell.key)}${hasApps ? `, ${count} application${count === 1 ? '' : 's'}` : ''}`}
              title={hasApps ? `${count} application${count === 1 ? '' : 's'}` : undefined}
              onClick={() => onSelectDate(isSelected ? null : cell.key)}
            >
              {cell.day}
              {hasApps && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-green-600" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">Green days have tracked applications. Click a day to list them.</p>
    </div>
  );
}
