import { getAuthHeader, getIdentity, type IdentityMe, type LoginResponse } from './auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export type ApiStatus = 'checking' | 'connected' | 'unreachable' | 'not-configured';

export async function checkApiConnection(): Promise<ApiStatus> {
  if (!API_BASE_URL) {
    return 'not-configured';
  }

  try {
    await fetch(API_BASE_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    return 'connected';
  } catch {
    return 'unreachable';
  }
}

export function apiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function getIdentityMe(loginResponse: LoginResponse) {
  const response = await fetch(apiUrl('/api/identity/me'), {
    headers: {
      Authorization: `${loginResponse.tokenType} ${loginResponse.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar la identidad del usuario.');
  }

  return (await response.json()) as IdentityMe;
}

export type RetoDailyLog = {
  dayIndex: number;
  logDate: string;
  fIntelectual: boolean;
  fEspiritual: boolean;
  fFisico: boolean;
  fEconomico: boolean;
  fSocialAtraccion: boolean;
  bitacora?: string | null;
};

export type RetoDailyLogPatch = Pick<
  RetoDailyLog,
  'fIntelectual' | 'fEspiritual' | 'fFisico' | 'fEconomico' | 'fSocialAtraccion' | 'bitacora'
>;

export type RetoDailyLogCreate = RetoDailyLogPatch & {
  logDate: string;
};

export class DailyLogNotFoundError extends Error {
  constructor() {
    super('No existe la bitácora para esta fecha.');
  }
}

export function getTodayLogDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getDailyLogIdentity() {
  const identity = getIdentity();

  if (!identity?.userId || !identity.activeEnrollmentId) {
    throw new Error('La sesión no tiene userId o activeEnrollmentId.');
  }

  return identity;
}

function dailyLogUrl(logDate: string) {
  const identity = getDailyLogIdentity();

  return apiUrl(
    `/api/users/${identity.userId}/retoenrollments/${identity.activeEnrollmentId}/daily-logs/${logDate}`,
  );
}

function dailyLogsUrl() {
  const identity = getDailyLogIdentity();

  return apiUrl(`/api/users/${identity.userId}/retoenrollments/${identity.activeEnrollmentId}/daily-logs`);
}

async function readDailyLogResponse(response: Response, logDate: string) {
  if (response.status === 204) {
    return getRetoDailyLog(logDate);
  }

  const text = await response.text();
  if (!text) {
    return getRetoDailyLog(logDate);
  }

  return JSON.parse(text) as RetoDailyLog;
}

export async function getRetoDailyLog(logDate = getTodayLogDate()) {
  const response = await fetch(dailyLogUrl(logDate), {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (response.status === 404) {
    throw new DailyLogNotFoundError();
  }

  if (!response.ok) {
    throw new Error('No se pudo cargar la bitácora.');
  }

  return (await response.json()) as RetoDailyLog;
}

export async function createRetoDailyLog(data: RetoDailyLogCreate) {
  const response = await fetch(dailyLogsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('No se pudo crear la bitácora.');
  }

  return readDailyLogResponse(response, data.logDate);
}

export async function updateRetoDailyLog(data: RetoDailyLogPatch, logDate = getTodayLogDate()) {
  const response = await fetch(dailyLogUrl(logDate), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('No se pudo guardar la bitácora.');
  }

  return readDailyLogResponse(response, logDate);
}
