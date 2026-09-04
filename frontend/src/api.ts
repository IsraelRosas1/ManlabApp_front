import { getAuthHeader, getIdentity, type IdentityMe, type LoginResponse } from './auth';

declare global {
  interface Window {
    OneSignal?: OneSignalWebSDK;
    OneSignalDeferred?: Array<(OneSignal: OneSignalWebSDK) => Promise<void> | void>;
  }
}

type OneSignalWebSDK = {
  Notifications: {
    isPushSupported?: () => boolean;
    requestPermission: () => Promise<boolean>;
  };
  User: {
    PushSubscription: {
      id?: string | null;
      optedIn?: boolean;
      optIn: () => Promise<void>;
      optOut?: () => Promise<void>;
    };
  };
};

const ONESIGNAL_READY_TIMEOUT_MS = 8000;
const ONESIGNAL_SUBSCRIPTION_TIMEOUT_MS = 8000;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export type ApiStatus = 'checking' | 'connected' | 'unreachable' | 'not-configured';

export type MyEntitlementResponse = {
  estado: 'active' | 'past_due' | 'canceled' | 'none';
  en_prueba: boolean;
  prueba_termina: string | null;
  features: string[];
};

export type ContentProduct = {
  id: string;
  title: string;
  featureKey: string;
  priceDisplay: string;
  stripePriceId: string;
  imageUrl?: string;
};

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
    const json = JSON.parse(text) as {
      error?: string;
      message?: string;
      errors?: Record<string, string[] | string> | null;
    };

    const normalizedErrors = json.errors
      ? Object.values(json.errors)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
      : [];

    const details = normalizedErrors.length ? ` ${normalizedErrors.join(' ')}` : '';
    message = json.error || json.message || text;
    message = `${message}${details}`.trim();
  } catch {
    message = text;
  }

  return message;
}

export async function getIdentityMe(loginResponse?: Partial<LoginResponse> | null) {
  const headers: Record<string, string> = {};

  if (loginResponse?.tokenType && loginResponse?.accessToken) {
    headers.Authorization = `${loginResponse.tokenType} ${loginResponse.accessToken}`;
  }

  const response = await fetch(apiUrl('/api/identity/me'), {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar la identidad del usuario.');
  }

  return (await response.json()) as IdentityMe;
}

export async function getCurrentIdentityMe() {
  const response = await fetch(apiUrl('/api/identity/me'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar la identidad del usuario.');
  }

  return (await response.json()) as IdentityMe;
}

export async function getMyEntitlement(loginResponse?: Partial<LoginResponse> | null) {
  const headers: Record<string, string> = {};

  if (loginResponse?.tokenType && loginResponse?.accessToken) {
    headers.Authorization = `${loginResponse.tokenType} ${loginResponse.accessToken}`;
  }

  const response = await fetch(apiUrl('/api/me/entitlement'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el entitlement del usuario.');
  }

  return (await response.json()) as MyEntitlementResponse;
}

export async function getContentProducts() {
  const response = await fetch(apiUrl('/api/content-products'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as ContentProduct[];
}

export async function registerUser(email: string, password: string) {
  void email;
  void password;
  throw new Error('El endpoint legacy /api/identity/register está bloqueado. Usa /api/identity/claim-register.');
}

export type ClaimRegisterResponse = {
  userId: string;
  message: string;
};

export type ResendClaimLinkResponse = {
  message: string;
};

export type BillingPortalResponse = {
  url: string;
};

export type CheckoutSessionResponse = {
  url?: string;
  checkoutUrl?: string;
  sessionId?: string;
};

export async function claimRegisterUser(token: string, name: string, password: string) {
  const response = await fetch(apiUrl('/api/identity/claim-register'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      name,
      password,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    throw new Error(error || 'No se pudo crear la cuenta.');
  }

  return (await response.json()) as ClaimRegisterResponse;
}

export async function resendClaimLink(email: string) {
  const response = await fetch(apiUrl('/api/identity/resend-claim-link'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    throw new Error(error || 'No se pudo reenviar el enlace.');
  }

  return (await response.json()) as ResendClaimLinkResponse;
}

export async function createBillingPortalSession(returnUrl: string) {
  const response = await fetch(apiUrl('/api/me/billing-portal'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      returnUrl,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    const apiError = new Error(error || 'No se pudo abrir el portal de facturación.') as Error & { status?: number };
    apiError.status = response.status;
    throw apiError;
  }

  return (await response.json()) as BillingPortalResponse;
}

export async function createSubscriptionCheckoutSession(planCode: string, email: string) {
  const response = await fetch(apiUrl('/api/checkout/suscripcion'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planCode,
      email,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    const apiError = new Error(error || 'No se pudo crear la sesión de pago.') as Error & { status?: number };
    apiError.status = response.status;
    throw apiError;
  }

  return (await response.json()) as CheckoutSessionResponse;
}

export async function upgradeSubscription(planCode: string) {
  const response = await fetch(apiUrl('/api/me/upgrade'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planCode,
    }),
  });

  if (!response.ok) {
    const error = await getResponseErrorMessage(response);
    const apiError = new Error(error || 'No se pudo mejorar la suscripción.') as Error & { status?: number };
    apiError.status = response.status;
    throw apiError;
  }

  return (await response.json()) as Record<string, unknown>;
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

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  url?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  source?: string | null;
  status?: string;
  sentAt?: string | null;
  createdAt: string;
};

export type UserNotification = {
  deliveryId: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  url?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  isSeen: boolean;
  seenAt?: string | null;
  createdAt: string;
};

export type UserAudio = {
  id: string;
  title: string;
  category?: string | null;
  durationS?: number | null;
  sortOrder?: number;
  url?: string | null;
  audioUrl?: string | null;
  streamUrl?: string | null;
  fileUrl?: string | null;
  playbackUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type NotificationPreference = {
  id: string;
  type: string;
  discipline?: string | null;
  enabled: boolean;
  timeOfDay: string;
  timezone: string;
  reminderText?: string | null;
};

export type NotificationPreferenceCreate = {
  type: string;
  discipline?: string | null;
  enabled: boolean;
  timeOfDay: string;
  timezone: string;
  reminderText?: string | null;
};

export type NotificationPreferencePatch = Partial<
  Pick<NotificationPreferenceCreate, 'type' | 'discipline' | 'enabled' | 'timeOfDay' | 'timezone' | 'reminderText'>
>;

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
    credentials: 'include',
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
    credentials: 'include',
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
    credentials: 'include',
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
    credentials: 'include',
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
    credentials: 'include',
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
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('Could not load streak');
  }

  return (await response.json()) as RetoStreak;
}

export async function getLatestAppNotifications(limit = 5) {
  const response = await fetch(apiUrl('/api/admin/notifications'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las notificaciones.');
  }

  const userReminderTypes = new Set(['reto_reminder', 'daily_reto_reminder', 'weak_link_warning']);

  return ((await response.json()) as AppNotification[])
    .filter((notification) => notification.status === undefined || notification.status === 'sent')
    .filter((notification) => notification.source === undefined || notification.source === null || notification.source === 'admin')
    .filter((notification) => !userReminderTypes.has(notification.type))
    .slice(0, limit);
}

export async function getMyNotifications(isSeen?: boolean) {
  const query = isSeen === undefined ? '' : `?isSeen=${isSeen}`;
  const response = await fetch(apiUrl(`/api/notifications${query}`), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as UserNotification[];
}

export async function getUnseenNotificationCount() {
  const response = await fetch(apiUrl('/api/notifications/unseen-count'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as { count: number };
}

export async function markNotificationSeen(deliveryId: string) {
  const response = await fetch(apiUrl(`/api/notifications/${deliveryId}/seen`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function deleteUserNotification(deliveryId: string) {
  const response = await fetch(apiUrl(`/api/notifications/${deliveryId}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error((await response.text()) || 'No se pudo eliminar la notificación');
  }
}

export async function markAllNotificationsSeen() {
  const response = await fetch(apiUrl('/api/notifications/seen'), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as { updatedCount: number };
}

export async function getNotificationPreferences() {
  const response = await fetch(apiUrl('/api/notification-preferences'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as NotificationPreference[];
}

export async function createNotificationPreference(data: NotificationPreferenceCreate) {
  const response = await fetch(apiUrl('/api/notification-preferences'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as NotificationPreference;
}

export async function updateNotificationPreference(id: string, data: NotificationPreferencePatch) {
  const response = await fetch(apiUrl(`/api/notification-preferences/${id}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function deleteNotificationPreference(id: string) {
  const response = await fetch(apiUrl(`/api/notification-preferences/${id}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function getAudios() {
  const response = await fetch(apiUrl('/api/audios'), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as UserAudio[];
}

export async function getAudio(audioId: string) {
  const response = await fetch(apiUrl(`/api/audios/${audioId}`), {
    credentials: 'include',
    headers: {
      ...getAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as UserAudio;
}

export async function sendBrevoTestEmail() {
  const response = await fetch(apiUrl('/api/email/test'), {
    method: 'POST',
    credentials: 'include',
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

function withOneSignal<T>(callback: (OneSignal: OneSignalWebSDK) => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    let isSettled = false;
    const timeout = window.setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error('OneSignal no terminó de cargar. Revisa el dominio permitido en OneSignal.'));
      }
    }, ONESIGNAL_READY_TIMEOUT_MS);

    const runCallback = async (OneSignal: OneSignalWebSDK) => {
      if (isSettled) {
        return;
      }

      try {
        const result = await callback(OneSignal);
        isSettled = true;
        window.clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        isSettled = true;
        window.clearTimeout(timeout);
        reject(error);
      }
    };

    if (window.OneSignal) {
      void runCallback(window.OneSignal);
      return;
    }

    if (!window.OneSignalDeferred) {
      window.clearTimeout(timeout);
      reject(new Error('OneSignal SDK no está cargado.'));
      return;
    }

    window.OneSignalDeferred.push(runCallback);
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForOneSignalSubscriptionId(OneSignal: OneSignalWebSDK) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < ONESIGNAL_SUBSCRIPTION_TIMEOUT_MS) {
    const id = OneSignal.User.PushSubscription.id;
    if (id) {
      return id;
    }

    await wait(500);
  }

  throw new Error('No se pudo obtener la suscripción de OneSignal.');
}

async function saveOneSignalPushSettings({
  oneSignalPlayerId,
  pushEnabled,
}: {
  oneSignalPlayerId?: string;
  pushEnabled: boolean;
}) {
  const response = await fetch(apiUrl('/api/identity/onesignal'), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      ...(oneSignalPlayerId ? { oneSignalPlayerId } : {}),
      pushEnabled,
    }),
  });

  if (!response.ok) {
    const message = await getResponseErrorMessage(response);
    throw new Error(message || `Could not update push settings (${response.status})`);
  }
}

export async function updateOneSignalSubscriptionId(subscriptionId: string) {
  await saveOneSignalPushSettings({
    oneSignalPlayerId: subscriptionId,
    pushEnabled: true,
  });
}

export async function disableOneSignalPushOnBackend() {
  await saveOneSignalPushSettings({
    pushEnabled: false,
  });
}

export async function enableOneSignalNotifications() {
  const subscriptionId = await withOneSignal(async (OneSignal) => {
    if (OneSignal.Notifications.isPushSupported && !OneSignal.Notifications.isPushSupported()) {
      throw new Error('Este navegador no soporta notificaciones web.');
    }

    const hasPermission = await OneSignal.Notifications.requestPermission();
    if (!hasPermission) {
      throw new Error('Permiso de notificaciones rechazado.');
    }

    if (!OneSignal.User.PushSubscription.optedIn) {
      await OneSignal.User.PushSubscription.optIn();
    }

    return waitForOneSignalSubscriptionId(OneSignal);
  });

  await updateOneSignalSubscriptionId(subscriptionId);
  return subscriptionId;
}

export async function disableOneSignalNotifications() {
  await withOneSignal(async (OneSignal) => {
    if (OneSignal.User.PushSubscription.optOut) {
      await OneSignal.User.PushSubscription.optOut();
    }
  });
  await disableOneSignalPushOnBackend();
}
