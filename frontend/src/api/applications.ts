import { apiClient } from './client';
import { collectAllPages } from '../utils/applicationCalendar';
import type {
  ApiEnvelope,
  ApplicationHistoryEntry,
  ApplicationStats,
  ApplicationStatus,
  JobApplication,
  PageResponse,
} from '../types';

export interface ListApplicationsParams {
  status?: ApplicationStatus | '';
  q?: string;
  trackedOn?: string;
  page: number;
  size: number;
}

export async function listApplications(params: ListApplicationsParams): Promise<PageResponse<JobApplication>> {
  const { data } = await apiClient.get<ApiEnvelope<PageResponse<JobApplication>>>('/applications', {
    params: {
      page: params.page,
      size: params.size,
      status: params.status || undefined,
      q: params.q?.trim() || undefined,
      trackedOn: params.trackedOn || undefined,
    },
  });
  return data.data;
}

export async function listApplicationCatalog(): Promise<JobApplication[]> {
  return collectAllPages((page, size) => listApplications({ page, size }));
}

export async function getMyApplicationStats(): Promise<ApplicationStats> {
  const { data } = await apiClient.get<ApiEnvelope<ApplicationStats>>('/applications/stats');
  return data.data;
}

export async function getApplicationHistory(id: string): Promise<ApplicationHistoryEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApplicationHistoryEntry[]>>(`/applications/${id}/history`);
  return data.data;
}
