import type {
  ApiEnvelope,
  ApplicationEventRequest,
  ApplicationEventResponse,
  AuthResponseData,
  JobApplication,
  LoginResponse,
  ManagedResume,
  PageResponse,
  ScreenshotUploadUrlResponse,
  StoredConfig,
  UserSummaryData,
} from '../types';

// Baked in at build time (see vite.config.ts `envDir`) — never user-editable. End users installing
// this extension from the Chrome Web Store should never need to know or care what backend it talks
// to; that's an implementation detail the vendor fixes per build (dev/staging/production), the same
// way the web frontend's VITE_API_BASE_URL is set at its own build time. To ship a production
// build pointed at a real deployment, run: `VITE_API_BASE_URL=https://api.example.com/api npm run build`.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

// A plain `fetch()` that fails at the network level (server down/unreachable, DNS failure, etc.,
// as opposed to an HTTP error response) rejects with a bare `TypeError: Failed to fetch` - no
// indication of *what* it was trying to reach, which is exactly the information needed to tell
// "backend isn't running" apart from "this build is pointed at the wrong host entirely" (the
// second one is a real, recurring failure mode: this URL is baked in at build time - see
// API_BASE_URL above - so an extension built on one machine and installed on another, e.g. via the
// frontend's downloadable zip, silently keeps pointing at the machine it was *built* on unless
// VITE_API_BASE_URL was overridden for that build). Wrapping every call site through this instead
// of a bare fetch() surfaces API_BASE_URL directly in the error shown to the user.
async function safeFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  try {
    return await fetch(url, init);
  } catch (error) {
    console.error('[JATS] network request to', url, 'failed:', error);
    throw new Error(
      `Could not reach the server at ${API_BASE_URL}. Make sure it's running and reachable from ` +
        'this device (if this extension was installed on a different computer than the one running ' +
        'the server, it needs to be rebuilt with that server\'s address).',
    );
  }
}

// Exported so other contexts (sidepanel.ts) can listen for chrome.storage.onChanged on exactly
// this key, rather than polling - see that file's storage-change listener for why that matters.
export const CONFIG_STORAGE_KEY = 'jats.config';

const DEFAULT_CONFIG: StoredConfig = {
  token: null,
  userEmail: null,
  accountStatus: null,
};

export async function getConfig(): Promise<StoredConfig> {
  const result = await chrome.storage.local.get(CONFIG_STORAGE_KEY);
  const stored = result[CONFIG_STORAGE_KEY] as Partial<StoredConfig> | undefined;
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function saveConfig(config: StoredConfig): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
}

// A 401 from any authenticated endpoint means the stored token is unusable no matter how many
// times it's retried (expired, malformed, or the account was deleted server-side - see the
// backend's get_current_user) - yet nothing was clearing it client-side, so the extension stayed
// stuck thinking it was logged in (config.token still set) while every authenticated call kept
// failing with the same generic "Authentication required", with no indication of what to do about
// it. Clearing the token here means the very next getConfig() anywhere in the extension correctly
// reports "logged out" - and, combined with sidepanel.ts's chrome.storage.onChanged listener, an
// already-open side panel updates to the clear "please log in" state immediately instead of
// silently continuing to show that same stale error until it happens to reload.
async function clearInvalidSession(): Promise<void> {
  const config = await getConfig();
  if (config.token) {
    await saveConfig({ ...DEFAULT_CONFIG });
  }
}

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again from the extension options page.';

/** Like safeFetch, but for endpoints that require the caller's token - attaches the Authorization
 * header and, on a 401, clears the now-known-bad stored session (see clearInvalidSession) before
 * the caller even has a chance to see the response, so there's no window where some call sites
 * remember to handle an expired session and others don't. */
async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const response = await safeFetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    await clearInvalidSession();
  }
  return response;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await safeFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<AuthResponseData> | null;

  if (!response.ok || !envelope?.data) {
    throw new Error(envelope?.message ?? `Login failed (${response.status})`);
  }

  return { token: envelope.data.token, email: envelope.data.email, status: envelope.data.status };
}

/** Best-effort refresh of the account status (e.g. after a manager approves the account). */
export async function fetchCurrentUser(token: string): Promise<UserSummaryData> {
  const response = await authFetch('/users/me', token);

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<UserSummaryData> | null;

  if (!response.ok || !envelope?.data) {
    throw new Error(response.status === 401 ? SESSION_EXPIRED_MESSAGE : envelope?.message ?? `Failed to load account status (${response.status})`);
  }

  return envelope.data;
}

export async function submitApplicationEvent(
  event: ApplicationEventRequest,
): Promise<ApplicationEventResponse> {
  const config = await getConfig();

  if (!config.token) {
    throw new Error('Not logged in. Open the extension options page to log in first.');
  }

  const response = await authFetch('/application-events', config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  const body = (await response.json().catch(() => null)) as ApplicationEventResponse | null;

  if (!response.ok || !body) {
    throw new Error(response.status === 401 ? SESSION_EXPIRED_MESSAGE : body?.message ?? `Request failed (${response.status})`);
  }

  return body;
}

/** The account's own most-recently-tracked applications, straight from the backend — this is what
 * powers the side panel's "Recent activity" list (see sidepanel.ts). Deliberately not cached
 * client-side: it's account data, not per-browser-install state, so it has to come from wherever
 * the user is actually logged in (this device or any other) rather than a local log of what *this*
 * browser install happened to submit. */
export async function fetchRecentApplications(size = 8): Promise<JobApplication[]> {
  const config = await getConfig();
  if (!config.token) {
    throw new Error('Not logged in.');
  }

  const response = await authFetch(`/applications?page=0&size=${size}`, config.token);

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<PageResponse<JobApplication>> | null;

  if (!response.ok || !envelope?.data) {
    throw new Error(response.status === 401 ? SESSION_EXPIRED_MESSAGE : envelope?.message ?? `Failed to load recent activity (${response.status})`);
  }

  return envelope.data.items;
}

/** Gets a presigned S3/MinIO PUT URL for a screenshot, scoped to the logged-in user - the caller
 * must PUT the raw image bytes there directly (never through the backend) and then pass the
 * returned `key` back as `screenshotKey` on submitApplicationEvent. */
export async function createScreenshotUploadUrl(contentType: string): Promise<ScreenshotUploadUrlResponse> {
  const config = await getConfig();

  if (!config.token) {
    throw new Error('Not logged in.');
  }

  const response = await authFetch('/application-events/screenshot-upload-url', config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType }),
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<ScreenshotUploadUrlResponse> | null;

  if (!response.ok || !envelope?.data) {
    throw new Error(response.status === 401 ? SESSION_EXPIRED_MESSAGE : envelope?.message ?? `Failed to get screenshot upload URL (${response.status})`);
  }

  return envelope.data;
}

/** The manager-uploaded resume(s) on file for the logged-in account (newest version first) — the
 * same GET /api/resumes an applicant would've used to manage their own resumes back when that was
 * self-service; now it's manager-only uploads (see the web dashboard's ManagerUserRow), and this
 * is just how the applicant reads what's there. */
export async function fetchMyResumes(): Promise<ManagedResume[]> {
  const config = await getConfig();
  if (!config.token) {
    throw new Error('Not logged in.');
  }

  const response = await authFetch('/resumes', config.token);

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<ManagedResume[]> | null;

  if (!response.ok || !envelope?.data) {
    throw new Error(response.status === 401 ? SESSION_EXPIRED_MESSAGE : envelope?.message ?? `Failed to load resume (${response.status})`);
  }

  return envelope.data;
}
