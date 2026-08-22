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

async function getResponseErrorMessage(response: Response) {
  const text = await response.text();
  let message = text;

  try {
    const json = JSON.parse(text) as { error?: string };
    message = json.error || text;
  } catch {
    message = text;
  }

  return message;
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

export async function registerUser(email: string, password: string) {
  const response = await fetch(apiUrl('/api/identity/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    throw new Error(error || 'Could not create account');
  }

  return true;
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

export type WeakLink = {
  discipline: string;
  failedDays: number;
};

export type RetoStreak = {
  currentStreak: number;
  longestStreak: number;
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

export function getLocalDateOffset(daysOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
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

function weakLinksUrl() {
  return `${dailyLogsUrl()}/stats/weak-links`;
}

function streakUrl() {
  return `${dailyLogsUrl()}/stats/streak`;
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

export async function getRetoLogsFromTo(from: string, to: string) {
  const response = await fetch(`${dailyLogsUrl()}/from/${from}/to/${to}`, {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Could not load reto logs');
  }

  return (await response.json()) as RetoDailyLog[];
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

export async function getWeakLinks() {
  const response = await fetch(weakLinksUrl(), {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Could not load weak links');
  }

  return (await response.json()) as WeakLink[];
}

export async function getRetoStreak() {
  const response = await fetch(streakUrl(), {
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Could not load streak');
  }

  return (await response.json()) as RetoStreak;
}

export async function sendBrevoTestEmail() {
  const response = await fetch(apiUrl('/api/email/test'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      toEmail: 'israelrosassalinas@hotmail.com',
      toName: 'Israel',
      subject: 'Brevo test from Manlab',
      htmlContent: '<h1>It works</h1><p>This email was sent from the ASP.NET backend.</p>',
    }),
  });

  if (!response.ok) {
    const message = await getResponseErrorMessage(response);
    throw new Error(message || `Could not send Brevo test email (${response.status})`);
  }
}
