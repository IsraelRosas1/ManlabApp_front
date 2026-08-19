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
};

type AuthSession = LoginResponse & {
  expiresAt: number;
  identity?: IdentityMe;
};

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

export function isAuthenticated() {
  const session = readAuthSession();

  if (!session?.accessToken || session.expiresAt <= Date.now()) {
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
