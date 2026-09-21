import { useState } from 'react';
import type { DailyApplicationCount } from '../types';
import { formatShortDate } from '../utils/format';

function dateKey(value: string): string {
  return value.slice(0, 10);
}

/** A lightweight CSS bar chart — deliberately not pulling in a charting library for one chart.
 * Purely a count-of-applications-per-day view (no per-status breakdown) so it stays meaningful
 * regardless of how many days are shown: bars fill the available width evenly (flex-1 per bar), so
 * this reads just as well with 7 days as with 90. Date labels thin themselves out automatically —
 * showing one for every bar would overlap once there are more than a handful — and an explicit
 * hover tooltip replaces the browser's native `title` tooltip (which is inconsistently styled and
 * often slow to appear) with something that always matches the rest of the UI.
 *
 * When `onSelectDate` is provided, a bar with a count is a filter control: click it to show that
 * day's applications in the table below, click it again (or a Clear control on the table) to
 * return to the unfiltered list. */
export function ApplicationTrendChart({
  data,
  selectedDate,
  onSelectDate,
}: {
  data: DailyApplicationCount[];
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((point) => point.count));
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const selectedKey = selectedDate ? dateKey(selectedDate) : null;

  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
        No applications tracked in this period yet.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{total}</span> application{total === 1 ? '' : 's'} tracked
        {onSelectDate && <span className="ml-1.5 text-slate-400">· click a day to see those applications</span>}
      </p>
      <div className="flex h-48 items-end gap-1 sm:gap-1.5">
        {data.map((point, index) => {
          const key = dateKey(point.date);
          const isSelected = selectedKey === key;
          const canSelect = Boolean(onSelectDate) && point.count > 0;
          return (
            <button
              key={point.date}
              type="button"
              disabled={!canSelect}
              className={`group relative flex h-full flex-1 flex-col items-center justify-end ${
                canSelect ? 'cursor-pointer' : 'cursor-default'
              }`}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => {
                if (!canSelect || !onSelectDate) return;
                onSelectDate(isSelected ? null : key);
              }}
              aria-pressed={isSelected}
              aria-label={`${point.count} on ${formatShortDate(point.date)}`}
            >
              {hoverIndex === index && (
                <div className="absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg">
                  {point.count} on {formatShortDate(point.date)}
                </div>
              )}
              {point.count > 0 && (
                <span className="mb-0.5 text-[10px] font-semibold leading-none text-slate-600">{point.count}</span>
              )}
              <div
                className={`w-full rounded-t-md transition-all ${
                  point.count > 0
                    ? isSelected
                      ? 'bg-gradient-to-t from-brand-800 to-brand-500 ring-2 ring-brand-600 ring-offset-1'
                      : 'bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-700 group-hover:to-brand-500'
                    : 'bg-slate-100'
                }`}
                style={{ height: `${Math.max((point.count / max) * 100, point.count > 0 ? 4 : 2)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {data.map((point, index) => (
          <div
            key={point.date}
            className={`flex-1 text-center text-[10px] ${
              selectedKey === dateKey(point.date) ? 'font-semibold text-brand-700' : 'text-slate-400'
            }`}
          >
            {index % labelStep === 0 || index === data.length - 1 ? formatShortDate(point.date) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
