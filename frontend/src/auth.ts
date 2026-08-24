const AUTH_STORAGE_KEY = 'manlab.auth';

export type LoginResponse = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
};

export type IdentityMe = {
  userId: string;
  email: string;
  name: string;
  activeEnrollmentId: string;
  currentDayIndex: number;
  startDate: string;
  status: string;
  subscriptionStatus: string;
  currentPeriodEnd: string;
  planCode: string;
  pushEnabled?: boolean;
};

type AuthSession = LoginResponse & {
  expiresAt: number;
  identity?: IdentityMe;
};

export const SUBSCRIPTION_EXPIRED_MESSAGE = 'Tu suscripción expiró. Renueva para continuar.';

export function readAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveAuthSession(loginResponse: LoginResponse, identity?: IdentityMe) {
  const session: AuthSession = {
    ...loginResponse,
    identity,
    expiresAt: Date.now() + loginResponse.expiresIn * 1000,
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function updateAuthIdentity(identity: IdentityMe) {
  const session = readAuthSession();

  if (!session) {
    return;
  }

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...session,
      identity,
    }),
  );
}

export function clearAuthSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getAccessToken() {
  const session = readAuthSession();
  return session?.accessToken ?? null;
}

export function getIdentity() {
  const session = readAuthSession();
  return session?.identity ?? null;
}

export function hasActiveSubscription(identity?: IdentityMe | null) {
  if (!identity) {
    return false;
  }

  if (identity.subscriptionStatus?.toLowerCase() !== 'active') {
    return false;
  }

  if (!identity.currentPeriodEnd) {
    return true;
  }

  const currentPeriodEnd = new Date(identity.currentPeriodEnd).getTime();
  if (!Number.isNaN(currentPeriodEnd) && currentPeriodEnd <= Date.now()) {
    return false;
  }

  return true;
}

export function isAuthenticated() {
  const session = readAuthSession();

  if (!session?.accessToken || session.expiresAt <= Date.now() || !hasActiveSubscription(session.identity)) {
    clearAuthSession();
    return false;
  }

  return true;
}

export function getAuthHeader(): Record<string, string> {
  const session = readAuthSession();

  if (!session?.accessToken || !session.tokenType) {
    return {};
  }

  return {
    Authorization: `${session.tokenType} ${session.accessToken}`,
  };
}
