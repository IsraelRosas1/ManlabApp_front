function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5118`;
  }

  return '';
}

const API_BASE_URL = getApiBaseUrl();

export type AdminUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
  country: string;
  subscriptionId?: string;
  subscriptionStatus: string;
  currentPeriodEnd: string;
  planCode: string;
  priceLocked?: boolean;
};

export type AdminSubscription = {
  id: string;
  source: string;
  planCode: string;
  updatedAt: string;
  currentPeriodEnd: string;
  status: string;
  priceLocked?: boolean;
};

export type AdminUserFilters = {
  search: string;
  role: string;
  country: string;
  subscriptionStatus: string;
};

export type AdminEntitlement = {
  id: string;
  email: string;
  planCode?: string;
  currentPeriodEnd?: string;
  resolved?: boolean;
  createdAt?: string;
  resolvedAt?: string | null;
  target?: string;
};

export type AdminEntitlementFilters = {
  email: string;
  resolved: string;
};

export type GrantEntitlementRequest = {
  email: string;
  planCode: string;
  currentPeriodEnd: string;
};

export type GrantEntitlementResponse = {
  id: string;
  target: 'subscription' | 'pending_entitlement' | string;
};

export type UpdateSubscriptionRequest = {
  status: 'active' | 'past_due' | 'canceled' | 'none' | string;
  planCode: 'mensual' | 'anual' | 'fundador' | string;
  currentPeriodEnd: string;
  priceLocked: boolean;
};

export type AdminNotificationType =
  | 'live_alert'
  | 'tiktok_new_video'
  | 'instagram_new_video'
  | 'youtube_new_video'
  | string;

export type SendAdminNotificationRequest = {
  type: AdminNotificationType;
  title: string;
  message: string;
  url: string | null;
  imageUrl: string | null;
  icon: string | null;
  userIds: string[] | null;
};

export type AdminNotification = {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  url: string | null;
  imageUrl: string | null;
  icon?: string | null;
  source: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  totalDeliveries: number;
  sentDeliveries: number;
  failedDeliveries: number;
  openedDeliveries: number;
};

export type AdminNotificationDelivery = {
  id: string;
  userId: string;
  userEmail: string;
  oneSignalNotificationId: string | null;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AdminNotificationDetail = AdminNotification & {
  deliveries: AdminNotificationDelivery[];
};

export type UpdateAdminNotificationRequest = {
  type: AdminNotificationType;
  title: string;
  message: string;
  url: string | null;
  imageUrl: string | null;
  status: string;
  scheduledAt: string | null;
};

export type LoginResponse = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
};

function apiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('Configura VITE_API_BASE_URL para conectar con el backend.');
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function getResponseErrorMessage(response: Response) {
  const text = await response.text();

  if (!text) {
    return `Request failed (${response.status})`;
  }

  try {
    const json = JSON.parse(text) as { error?: string; message?: string };
    return json.error || json.message || text;
  } catch {
    return text;
  }
}

export async function getAdminUsers(token: string, filters: AdminUserFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      params.set(key, trimmedValue);
    }
  });

  const query = params.toString();
  const response = await fetch(apiUrl(`/api/admin/users${query ? `?${query}` : ''}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as AdminUser[];
}

export async function getAdminEntitlements(token: string, filters: AdminEntitlementFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      params.set(key, trimmedValue);
    }
  });

  const query = params.toString();
  const response = await fetch(apiUrl(`/api/admin/entitlements${query ? `?${query}` : ''}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as AdminEntitlement[];
}

export async function grantManualEntitlement(token: string, data: GrantEntitlementRequest) {
  const response = await fetch(apiUrl('/api/admin/entitlements/grant'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as GrantEntitlementResponse;
}

export async function getUserSubscriptions(token: string, userId: string) {
  const response = await fetch(apiUrl(`/api/users/${userId}/subscriptions`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as AdminSubscription[];
}

export async function updateUserSubscription(
  token: string,
  userId: string,
  subscriptionId: string,
  data: UpdateSubscriptionRequest,
) {
  const response = await fetch(apiUrl(`/api/users/${userId}/subscriptions/${subscriptionId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function sendAdminNotification(token: string, data: SendAdminNotificationRequest) {
  const response = await fetch(apiUrl('/api/admin/notifications'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function getAdminNotifications(token: string) {
  const response = await fetch(apiUrl('/api/admin/notifications'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as AdminNotification[];
}

export async function getAdminNotificationDetail(token: string, notificationId: string) {
  const response = await fetch(apiUrl(`/api/admin/notifications/${notificationId}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as AdminNotificationDetail;
}

export async function updateAdminNotification(
  token: string,
  notificationId: string,
  data: UpdateAdminNotificationRequest,
) {
  const response = await fetch(apiUrl(`/api/admin/notifications/${notificationId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(apiUrl('/api/identity/login'), {
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
    throw new Error(await getResponseErrorMessage(response));
  }

  return (await response.json()) as LoginResponse;
}
