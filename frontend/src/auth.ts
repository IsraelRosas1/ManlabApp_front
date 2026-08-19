const AUTH_STORAGE_KEY = 'manlab.auth';

export type LoginResponse = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
};

type AuthSession = LoginResponse & {
  expiresAt: number;
};

function readAuthSession(): AuthSession | null {
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

export function saveAuthSession(loginResponse: LoginResponse) {
  const session: AuthSession = {
    ...loginResponse,
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

export function isAuthenticated() {
  const session = readAuthSession();

  if (!session?.accessToken || session.expiresAt <= Date.now()) {
    clearAuthSession();
    return false;
  }

  return true;
}

export function getAuthHeader() {
  const session = readAuthSession();

  if (!session?.accessToken || !session.tokenType) {
    return {};
  }

  return {
    Authorization: `${session.tokenType} ${session.accessToken}`,
  };
}
