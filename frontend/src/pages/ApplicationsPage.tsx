import { useEffect, useState } from 'react';
import { ApplicationCalendar, calendarDaysFromStats } from '../components/ApplicationCalendar';
import { ApplicationRow } from '../components/ApplicationRow';
import { ApplicationSearchField } from '../components/ApplicationSearchField';
import { ApplicationTrendChart } from '../components/ApplicationTrendChart';
import { GoalProgressRing } from '../components/GoalProgressRing';
import { Spinner } from '../components/Spinner';
import { useApplicationsQuery, useMyApplicationStatsQuery } from '../hooks/useApplications';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { APPLICATION_GOAL, APPLICATION_STATUSES, type ApplicationStatus } from '../types';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 10;

export function ApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [trackedOn, setTrackedOn] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [status, search, trackedOn]);

  const statsQuery = useMyApplicationStatsQuery();
  const query = useApplicationsQuery({
    status,
    q: search,
    trackedOn: trackedOn ?? undefined,
    page,
    size: PAGE_SIZE,
  });
  const data = query.data;

  // Deliberately unfiltered (and cached separately from `query` above under a different query
  // key) so the goal ring always reflects every tracked application, not just whichever status
  // the list below happens to be filtered to right now.
  const totalQuery = useApplicationsQuery({ status: '', page: 0, size: 1 });
  const totalApplied = totalQuery.data?.totalElements ?? 0;
  const remaining = Math.max(APPLICATION_GOAL - totalApplied, 0);

  const selectDay = (date: string | null) => {
    setTrackedOn(date);
    document.getElementById('application-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application history</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Applications tracked automatically from the Chrome extension appear here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ApplicationSearchField value={searchInput} onChange={setSearchInput} />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
              className="select"
            >
              <option value="">All</option>
              {APPLICATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {totalQuery.data && (
        <div className="card mb-6 flex flex-wrap items-center gap-6 p-5">
          <GoalProgressRing current={totalApplied} goal={APPLICATION_GOAL} />
          <div>
            <p className="text-sm font-medium text-slate-500">Your application goal</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {totalApplied}
              <span className="text-lg font-medium text-slate-400"> / {APPLICATION_GOAL}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {remaining > 0
                ? `${remaining} more application${remaining === 1 ? '' : 's'} to reach your goal of ${APPLICATION_GOAL}.`
                : `Goal reached — you've applied to ${totalApplied} jobs.`}
            </p>
          </div>
        </div>
      )}

      {statsQuery.data && (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Applications — last 14 days</h2>
            <ApplicationTrendChart
              data={statsQuery.data.dailyTrend}
              selectedDate={trackedOn}
              onSelectDate={selectDay}
            />
          </section>
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Calendar</h2>
            <ApplicationCalendar
              days={calendarDaysFromStats(statsQuery.data)}
              selectedDate={trackedOn}
              onSelectDate={selectDay}
            />
          </section>
        </div>
      )}

      <div id="application-list" className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {trackedOn ? `Applications on ${formatDate(trackedOn)}` : 'All applications'}
        </h2>
        {trackedOn && (
          <button type="button" onClick={() => setTrackedOn(null)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear day filter
          </button>
        )}
      </div>

      <div className="card px-5">
        {query.isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {query.isError && (
          <p className="py-10 text-center text-sm text-red-600">Failed to load applications.</p>
        )}

        {data && data.items.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            {trackedOn
              ? `No applications tracked on ${formatDate(trackedOn)}.`
              : search
                ? `No applications match “${search}”.`
                : status
                  ? `No applications with status ${status}.`
                  : 'No applications yet. Install the Chrome extension and apply to a job to see it show up here.'}
          </p>
        )}

        {data && data.items.length > 0 && (
          <div>
            {data.items.map((application) => (
              <ApplicationRow key={application.id} application={application} />
            ))}
          </div>
        )}
      </div>

      {data && data.totalElements > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {data.page + 1} of {data.totalPages} ({data.totalElements} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page === 0}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              className="btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.last}
              onClick={() => setPage((current) => current + 1)}
              className="btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
