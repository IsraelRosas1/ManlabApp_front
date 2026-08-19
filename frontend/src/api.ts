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
