import type { ApplicationStatus, DailyApplicationCount } from '../types';
import { calendarDateKey } from './format';

const CATALOG_PAGE_SIZE = 100;
const CATALOG_PAGE_CAP = 40;

export function toCalendarDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type DatedApplication = {
  appliedDate: string;
  createdAt: string;
  status: ApplicationStatus;
  company: string;
  jobTitle: string;
  jobUrl: string;
};

/** Calendar days this application belongs on: Applied date, plus local and UTC days of createdAt
 * so a late-evening track still greens the day the applicant actually applied. */
export function applicationCalendarKeys(application: Pick<DatedApplication, 'appliedDate' | 'createdAt'>): string[] {
  const keys = new Set<string>();
  if (application.appliedDate) keys.add(calendarDateKey(application.appliedDate));
  if (application.createdAt) {
    keys.add(calendarDateKey(application.createdAt));
    const instant = new Date(application.createdAt);
    if (!Number.isNaN(instant.getTime())) {
      keys.add(toCalendarDateKey(instant.getFullYear(), instant.getMonth(), instant.getDate()));
    }
  }
  return [...keys];
}

export function applicationMatchesCalendarDay(
  application: Pick<DatedApplication, 'appliedDate' | 'createdAt'>,
  dayKey: string,
): boolean {
  const wanted = calendarDateKey(dayKey);
  return applicationCalendarKeys(application).includes(wanted);
}

export function calendarDaysFromApplications(
  applications: Array<Pick<DatedApplication, 'appliedDate' | 'createdAt'>>,
): DailyApplicationCount[] {
  const counts = new Map<string, number>();
  for (const application of applications) {
    for (const key of applicationCalendarKeys(application)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

export function matchesApplicationSearch(
  application: Pick<DatedApplication, 'company' | 'jobTitle' | 'jobUrl'>,
  search: string,
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return (
    application.company.toLowerCase().includes(term) ||
    application.jobTitle.toLowerCase().includes(term) ||
    application.jobUrl.toLowerCase().includes(term)
  );
}

export function filterApplicationsForView<T extends DatedApplication>(
  applications: T[],
  options: { status: ApplicationStatus | ''; search: string; trackedOn: string | null },
): T[] {
  return applications.filter((application) => {
    if (options.status && application.status !== options.status) return false;
    if (!matchesApplicationSearch(application, options.search)) return false;
    if (options.trackedOn && !applicationMatchesCalendarDay(application, options.trackedOn)) return false;
    return true;
  });
}

export function paginateLocalItems<T>(items: T[], page: number, pageSize: number) {
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  return {
    items: items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    page: safePage,
    totalElements,
    totalPages,
    last: safePage >= totalPages - 1,
  };
}

export async function collectAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<{ items: T[]; last: boolean }>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < CATALOG_PAGE_CAP; page += 1) {
    const result = await fetchPage(page, CATALOG_PAGE_SIZE);
    items.push(...result.items);
    if (result.last || result.items.length === 0) break;
  }
  return items;
}
