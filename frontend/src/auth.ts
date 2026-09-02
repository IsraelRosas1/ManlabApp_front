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
  entitlements?: string[];
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

export function saveAuthSession(loginResponse?: Partial<LoginResponse> | null, identity?: IdentityMe) {
  const expiresInSeconds =
    typeof loginResponse?.expiresIn === 'number' && loginResponse.expiresIn > 0
      ? loginResponse.expiresIn
      : 30 * 24 * 60 * 60;

  const session: AuthSession = {
    tokenType: loginResponse?.tokenType ?? '',
    accessToken: loginResponse?.accessToken ?? '',
    expiresIn: expiresInSeconds,
    identity,
    expiresAt: Date.now() + expiresInSeconds * 1000,
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

  const allowedStatuses = ['active', 'trialing', 'past_due'];
  return allowedStatuses.includes(identity.subscriptionStatus?.toLowerCase() || '');
}

export function hasCanceledSubscription(identity?: IdentityMe | null) {
  if (!identity) {
    return false;
  }

  const canceledStatuses = ['canceled', 'cancelled'];
  return canceledStatuses.includes(identity.subscriptionStatus?.toLowerCase() || '');
}

export function getEntitlements(identity?: IdentityMe | null): string[] {
  if (!identity) {
    return [];
  }

  const rawEntitlements = Array.isArray(identity.entitlements) ? identity.entitlements : [];
  return rawEntitlements.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

export function hasEntitlement(identity: IdentityMe | null | undefined, entitlementCode: string) {
  const normalizedClaim = entitlementCode.trim().toLowerCase();

  if (getEntitlements(identity).some((value) => value.toLowerCase() === normalizedClaim)) {
    return true;
  }

  const planCode = identity?.planCode?.trim().toLowerCase();

  if (normalizedClaim === 'udh_audios') {
    return planCode === 'app_mensual' || planCode === 'mensual' || planCode === 'app_annual' || planCode == 'app_fundador' || planCode === 'anual';
  }

  return false;
}

export function isAuthenticated() {
  const session = readAuthSession();

  if (!session || !session.identity || session.expiresAt <= Date.now()) {
    clearAuthSession();
    return false;
  }

  const identity = session.identity;
  if (!hasActiveSubscription(identity) && !hasCanceledSubscription(identity)) {
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
