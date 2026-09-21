import { useQuery } from '@tanstack/react-query';
import {
  getApplicationHistory,
  getMyApplicationStats,
  listApplications,
  type ListApplicationsParams,
} from '../api/applications';

export function useApplicationsQuery(params: ListApplicationsParams) {
  return useQuery({
    queryKey: ['applications', params],
    queryFn: () => listApplications(params),
  });
}

export function useMyApplicationStatsQuery() {
  return useQuery({
    queryKey: ['applications', 'stats'],
    queryFn: getMyApplicationStats,
  });
}

export function useApplicationHistoryQuery(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['application-history', applicationId],
    queryFn: () => getApplicationHistory(applicationId),
    enabled,
  });
}
