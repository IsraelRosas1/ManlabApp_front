import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  deleteAdminNotification,
  getAdminEntitlements,
  getAdminNotificationDetail,
  getAdminNotifications,
  getAdminUsers,
  getUserSubscriptions,
  grantManualEntitlement,
  loginAdmin,
  sendAdminNotification,
  updateAdminNotification,
  updateUserSubscription,
  type AdminEntitlement,
  type AdminEntitlementFilters,
  type AdminNotification,
  type AdminNotificationDetail,
  type AdminNotificationType,
  type AdminSubscription,
  type AdminUser,
  type AdminUserFilters,
  type GrantEntitlementRequest,
  type SendAdminNotificationRequest,
  type UpdateAdminNotificationRequest,
  type UpdateSubscriptionRequest,
} from './api';
import './styles.css';

const ADMIN_TOKEN_KEY = 'manlab.admin.token';
const ADMIN_EMAIL_KEY = 'manlab.admin.email';
type AdminSection = 'users' | 'entitlements' | 'notifications';

const emptyFilters: AdminUserFilters = {
  search: '',
  role: '',
  country: '',
  subscriptionStatus: '',
};

const emptyEntitlementFilters: AdminEntitlementFilters = {
  email: '',
  resolved: 'false',
};

const defaultGrantForm: GrantEntitlementRequest = {
  email: '',
  planCode: 'mensual',
  currentPeriodEnd: '',
};

const notificationPresets: Record<
  AdminNotificationType,
  SendAdminNotificationRequest
> = {
  reto_reminder: {
    type: 'reto_reminder',
    title: 'Recuerda tu Reto',
    message: 'Completa tus cinco frentes de hoy antes de cerrar el día.',
    url: null,
    imageUrl: null,
    icon: 'bell',
    userIds: null,
  },
  live: {
    type: 'live',
    title: 'Estamos en vivo',
    message: 'Entra al LIVE de Manlab ahora.',
    url: null,
    imageUrl: null,
    icon: 'live',
    userIds: null,
  },
  content: {
    type: 'content',
    title: 'Nuevo contenido disponible',
    message: 'Ya hay nuevo contenido disponible dentro de Manlab.',
    url: null,
    imageUrl: null,
    icon: 'book',
    userIds: null,
  },
  daily_reto_reminder: {
    type: 'daily_reto_reminder',
    title: 'Tu Reto de hoy',
    message: 'Registra tus disciplinas y escribe tu bitácora del día.',
    url: null,
    imageUrl: null,
    icon: 'bell',
    userIds: null,
  },
  youtube_new_video: {
    type: 'youtube_new_video',
    title: 'Nuevo video en YouTube',
    message: 'Ya está disponible el nuevo video.',
    url: 'https://www.youtube.com/watch?v=',
    imageUrl: 'https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg',
    icon: 'video',
    userIds: null,
  },
  weak_link_warning: {
    type: 'weak_link_warning',
    title: 'Eslabón débil detectado',
    message: 'Revisa el frente que más se te está cayendo esta semana.',
    url: null,
    imageUrl: null,
    icon: 'bell',
    userIds: null,
  },
  streak_broken: {
    type: 'streak_broken',
    title: 'Racha rota',
    message: 'Retoma el Reto hoy y vuelve a construir tu racha.',
    url: null,
    imageUrl: null,
    icon: 'bell',
    userIds: null,
  },
  live_alert: {
    type: 'live_alert',
    title: 'Estamos en vivo',
    message: 'Entra al LIVE de Manlab ahora.',
    url: 'https://your-live-url.com',
    imageUrl: null,
    icon: 'video',
    userIds: null,
  },
  tiktok_new_video: {
    type: 'tiktok_new_video',
    title: 'Nuevo video en TikTok',
    message: 'Ya está disponible el nuevo video de Manlab.',
    url: 'https://www.tiktok.com/@youraccount/video/',
    imageUrl: null,
    icon: 'video',
    userIds: null,
  },
  instagram_new_video: {
    type: 'instagram_new_video',
    title: 'Nuevo video en Instagram',
    message: 'Mira el nuevo contenido de Manlab.',
    url: 'https://www.instagram.com/reel/',
    imageUrl: null,
    icon: 'video',
    userIds: null,
  },
};

const defaultNotificationForm: SendAdminNotificationRequest = notificationPresets.live_alert;
const subscriptionStatuses = ['active', 'past_due', 'canceled', 'none'];
const planCodes = ['mensual', 'anual', 'fundador'];
const notificationIcons = ['video', 'book', 'bulb', 'bell', 'live'];
const notificationStatuses = ['draft', 'scheduled', 'sent', 'failed', 'canceled'];
const notificationTypeOptions: Array<{ value: AdminNotificationType; label: string }> = [
  { value: 'live', label: 'LIVE' },
  { value: 'content', label: 'Contenido' },
  { value: 'youtube_new_video', label: 'YouTube' },
  { value: 'tiktok_new_video', label: 'TikTok' },
  { value: 'instagram_new_video', label: 'Instagram' },
  { value: 'live_alert', label: 'LIVE alert' },
];
const ANNOUNCEMENT_TIMEOUT_MS = 4000;
type NotificationSendMode = 'now' | 'scheduled';

function formatDate(value: string) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function normalizeStatus(status: string) {
  return status?.toLowerCase() || 'unknown';
}

function toUtcPeriodEnd(value: string) {
  if (!value) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }

  return value;
}

function toDateInputValue(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  return date.toISOString().slice(0, 16);
}

function toUtcDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${value}:00Z`;
  }

  return date.toISOString();
}

function getLoginFieldErrors(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('email')) {
    return {
      emailError: message,
      passwordError: '',
      generalError: '',
    };
  }

  if (normalized.includes('password') || normalized.includes('contraseña')) {
    return {
      emailError: '',
      passwordError: message,
      generalError: '',
    };
  }

  return {
    emailError: 'Verifica tu correo.',
    passwordError: 'Verifica tu contraseña.',
    generalError: message || 'Credenciales inválidas.',
  };
}

function App() {
  const [section, setSection] = React.useState<AdminSection>('users');
  const [token, setToken] = React.useState(() => window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? '');
  const [email, setEmail] = React.useState(() => window.localStorage.getItem(ADMIN_EMAIL_KEY) ?? '');
  const [password, setPassword] = React.useState('');
  const [filters, setFilters] = React.useState<AdminUserFilters>(emptyFilters);
  const [entitlementFilters, setEntitlementFilters] =
    React.useState<AdminEntitlementFilters>(emptyEntitlementFilters);
  const [grantForm, setGrantForm] = React.useState<GrantEntitlementRequest>(defaultGrantForm);
  const [notificationForm, setNotificationForm] =
    React.useState<SendAdminNotificationRequest>(defaultNotificationForm);
  const [notificationSendMode, setNotificationSendMode] = React.useState<NotificationSendMode>('now');
  const [notificationScheduledAt, setNotificationScheduledAt] = React.useState('');
  const [notificationHistorySearch, setNotificationHistorySearch] = React.useState('');
  const [notificationHistoryType, setNotificationHistoryType] = React.useState('');
  const [notificationHistoryStatus, setNotificationHistoryStatus] = React.useState('');
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [entitlements, setEntitlements] = React.useState<AdminEntitlement[]>([]);
  const [notifications, setNotifications] = React.useState<AdminNotification[]>([]);
  const [notificationDetail, setNotificationDetail] = React.useState<AdminNotificationDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingEntitlements, setIsLoadingEntitlements] = React.useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = React.useState(false);
  const [isLoadingNotificationDetail, setIsLoadingNotificationDetail] = React.useState(false);
  const [isGranting, setIsGranting] = React.useState(false);
  const [isSendingNotification, setIsSendingNotification] = React.useState(false);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [loginGeneralError, setLoginGeneralError] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');

  const isConnected = Boolean(token);

  React.useEffect(() => {
    if (!errorMessage && !successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, ANNOUNCEMENT_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage, successMessage]);

  React.useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [section]);

  const loadUsers = React.useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextUsers = await getAdminUsers(token, filters);
      setUsers(nextUsers);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, token]);

  React.useEffect(() => {
    if (section === 'users') {
      void loadUsers();
    }
  }, [loadUsers, section]);

  const loadEntitlements = React.useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoadingEntitlements(true);
    setErrorMessage('');

    try {
      const nextEntitlements = await getAdminEntitlements(token, entitlementFilters);
      setEntitlements(nextEntitlements);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los entitlements.');
    } finally {
      setIsLoadingEntitlements(false);
    }
  }, [entitlementFilters, token]);

  React.useEffect(() => {
    if (section === 'entitlements') {
      void loadEntitlements();
    }
  }, [loadEntitlements, section]);

  const loadNotifications = React.useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoadingNotifications(true);
    setErrorMessage('');

    try {
      const nextNotifications = await getAdminNotifications(token);
      setNotifications(
        nextNotifications.filter((notification) => notification.source?.toLowerCase() === 'admin'),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar las notificaciones.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (section === 'notifications') {
      void loadNotifications();
    }
  }, [loadNotifications, section]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    setEmailError('');
    setPasswordError('');
    setLoginGeneralError('');

    if (!normalizedEmail) {
      setEmailError('Escribe un correo válido.');
      return;
    }

    if (!password) {
      setPasswordError('Escribe tu contraseña.');
      return;
    }

    setIsSigningIn(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const loginResponse = await loginAdmin(normalizedEmail, password);
      setToken(loginResponse.accessToken);
      setPassword('');
      setEmailError('');
      setPasswordError('');
      setLoginGeneralError('');
      window.localStorage.setItem(ADMIN_TOKEN_KEY, loginResponse.accessToken);
      window.localStorage.setItem(ADMIN_EMAIL_KEY, normalizedEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      const nextErrors = getLoginFieldErrors(message);
      setEmailError(nextErrors.emailError);
      setPasswordError(nextErrors.passwordError);
      setLoginGeneralError(nextErrors.generalError);
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = () => {
    setToken('');
    setPassword('');
    setUsers([]);
    setEntitlements([]);
    setNotifications([]);
    setNotificationDetail(null);
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  };

  if (!isConnected) {
    return (
      <AdminLoginScreen
        email={email}
        password={password}
        isSigningIn={isSigningIn}
        emailError={emailError}
        passwordError={passwordError}
        generalError={loginGeneralError}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  const updateFilter = (key: keyof AdminUserFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateEntitlementFilter = (key: keyof AdminEntitlementFilters, value: string) => {
    setEntitlementFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateGrantForm = (key: keyof GrantEntitlementRequest, value: string) => {
    setGrantForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const selectNotificationPreset = (type: AdminNotificationType) => {
    setNotificationForm(notificationPresets[type]);
  };

  const updateNotificationForm = (key: keyof SendAdminNotificationRequest, value: string | null) => {
    setNotificationForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSendNotification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setErrorMessage('Inicia sesión como admin para enviar avisos.');
      return;
    }

    if (notificationSendMode === 'scheduled' && !notificationScheduledAt) {
      setErrorMessage('Selecciona fecha y hora para programar el aviso.');
      return;
    }

    setIsSendingNotification(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await sendAdminNotification(token, {
        ...notificationForm,
        imageUrl: notificationForm.imageUrl?.trim() || null,
        icon: notificationForm.icon?.trim() || null,
        url: notificationForm.url?.trim() || null,
        title: notificationForm.title.trim(),
        message: notificationForm.message.trim(),
        status: notificationSendMode === 'scheduled' ? 'scheduled' : undefined,
        scheduledAt: notificationSendMode === 'scheduled' ? toUtcDateTime(notificationScheduledAt) : null,
        userIds: null,
      });
      setSuccessMessage(notificationSendMode === 'scheduled' ? 'Aviso programado.' : 'Aviso enviado.');
      setNotificationScheduledAt('');
      setNotificationSendMode('now');
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo enviar el aviso.');
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleDeleteNotification = async (
    notificationId: string,
    setIsDeleting: (isDeleting: boolean) => void,
  ) => {
    if (!token) {
      setErrorMessage('Inicia sesión como admin para eliminar avisos.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await deleteAdminNotification(token, notificationId);
      setSuccessMessage('Aviso eliminado.');
      setNotificationDetail((current) => (current?.id === notificationId ? null : current));
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo eliminar el aviso.');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadNotificationDetail = async (notificationId: string) => {
    if (!token) {
      setErrorMessage('Inicia sesión como admin para ver entregas.');
      return;
    }

    setIsLoadingNotificationDetail(true);
    setErrorMessage('');

    try {
      const detail = await getAdminNotificationDetail(token, notificationId);
      setNotificationDetail(detail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el detalle del aviso.');
    } finally {
      setIsLoadingNotificationDetail(false);
    }
  };

  const handleUpdateNotification = async (
    notificationId: string,
    data: UpdateAdminNotificationRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => {
    if (!token) {
      setErrorMessage('Inicia sesión como admin para editar avisos.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await updateAdminNotification(token, notificationId, data);
      setSuccessMessage('Aviso actualizado.');
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar el aviso.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSubscription = async (
    user: AdminUser,
    subscriptionId: string,
    data: UpdateSubscriptionRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => {
    if (!token) {
      setErrorMessage('Inicia sesión como admin para actualizar suscripciones.');
      return;
    }

    if (!subscriptionId) {
      setErrorMessage('Selecciona una suscripción para actualizar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await updateUserSubscription(token, user.userId, subscriptionId, data);
      setSuccessMessage('Suscripción actualizada.');
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar la suscripción.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantEntitlement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setErrorMessage('Inicia sesión como admin para otorgar acceso.');
      return;
    }

    setIsGranting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await grantManualEntitlement(token, {
        email: grantForm.email.trim(),
        planCode: grantForm.planCode.trim(),
        currentPeriodEnd: toUtcPeriodEnd(grantForm.currentPeriodEnd),
      });
      setSuccessMessage(
        result.target === 'subscription'
          ? 'Suscripción manual creada o actualizada.'
          : 'Pending entitlement creado para ese email.',
      );
      setGrantForm(defaultGrantForm);
      setEntitlementFilters((current) => ({
        ...current,
        email: '',
        resolved: 'false',
      }));
      await loadEntitlements();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo otorgar el entitlement.');
    } finally {
      setIsGranting(false);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => normalizeStatus(user.subscriptionStatus) === 'active').length;
  const expiredUsers = users.filter((user) => normalizeStatus(user.subscriptionStatus) === 'expired').length;
  const pendingEntitlements = entitlements.filter((entitlement) => entitlement.resolved !== true).length;
  const sentNotifications = notifications.filter((notification) => normalizeStatus(notification.status) === 'sent').length;
  const failedNotificationDeliveries = notifications.reduce(
    (total, notification) => total + notification.failedDeliveries,
    0,
  );
  const openedNotificationDeliveries = notifications.reduce(
    (total, notification) => total + notification.openedDeliveries,
    0,
  );
  const filteredNotifications = notifications.filter((notification) => {
    const normalizedSearch = notificationHistorySearch.trim().toLowerCase();
    const normalizedType = notificationHistoryType.trim().toLowerCase();
    const normalizedStatus = notificationHistoryStatus.trim().toLowerCase();

    const matchesSearch =
      !normalizedSearch ||
      notification.title.toLowerCase().includes(normalizedSearch) ||
      notification.message.toLowerCase().includes(normalizedSearch) ||
      notification.type.toLowerCase().includes(normalizedSearch);
    const matchesType = !normalizedType || notification.type.toLowerCase() === normalizedType;
    const matchesStatus = !normalizedStatus || normalizeStatus(notification.status) === normalizedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <h1>ManLab Admin</h1>
            <p>Operación y usuarios</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          <button
            className={`sidebar-link ${section === 'users' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setSection('users')}
          >
            <span aria-hidden="true">▦</span>
            Usuarios
          </button>
          <button
            className={`sidebar-link ${section === 'entitlements' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setSection('entitlements')}
          >
            <span aria-hidden="true">◷</span>
            Entitlements
          </button>
          <button
            className={`sidebar-link ${section === 'notifications' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setSection('notifications')}
          >
            <span aria-hidden="true">✉</span>
            Avisos
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin API</p>
            <h2>
              {section === 'users' ? 'Usuarios' : section === 'entitlements' ? 'Entitlements' : 'Avisos'}
            </h2>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={
              section === 'users'
                ? loadUsers
                : section === 'entitlements'
                  ? loadEntitlements
                  : loadNotifications
            }
            disabled={!isConnected || isLoading || isLoadingEntitlements || isLoadingNotifications}
          >
            {isLoading || isLoadingEntitlements || isLoadingNotifications ? 'Cargando' : 'Actualizar'}
          </button>
        </header>

        <form className="auth-card" onSubmit={handleLogin}>
          <label htmlFor="admin-email">Acceso admin</label>
          <div className="auth-row">
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@manlabproject.com"
              autoComplete="email"
              disabled={isConnected}
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              disabled={isConnected}
            />
            {isConnected ? (
              <button type="button" className="ghost-button" onClick={logout}>
                Salir
              </button>
            ) : (
              <button type="submit" disabled={isSigningIn}>
                {isSigningIn ? 'Entrando' : 'Entrar'}
              </button>
            )}
          </div>
        </form>

        {section === 'users' ? (
          <>
            <section className="stats-grid" aria-label="Resumen">
              <SummaryCard label="Usuarios" value={totalUsers.toString()} />
              <SummaryCard label="Activos" value={activeUsers.toString()} tone="active" />
              <SummaryCard label="Expirados" value={expiredUsers.toString()} tone="expired" />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Lista de usuarios</h3>
                  <p>Filtra contra GET /api/admin/users.</p>
                </div>
              </div>

              <div className="filters">
                <label>
                  Buscar
                  <input
                    value={filters.search}
                    onChange={(event) => updateFilter('search', event.target.value)}
                    placeholder="email, nombre..."
                  />
                </label>
                <label>
                  Rol
                  <input
                    value={filters.role}
                    onChange={(event) => updateFilter('role', event.target.value)}
                    placeholder="Admin"
                  />
                </label>
                <label>
                  País
                  <input
                    value={filters.country}
                    onChange={(event) => updateFilter('country', event.target.value)}
                    placeholder="Mexico"
                  />
                </label>
                <label>
                  Suscripción
                  <select
                    value={filters.subscriptionStatus}
                    onChange={(event) => updateFilter('subscriptionStatus', event.target.value)}
                  >
                    <option value="">Todas</option>
                    <option value="active">Activa</option>
                    <option value="expired">Expirada</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </label>
              </div>

              {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

              {successMessage ? <div className="success-banner">{successMessage}</div> : null}
              <UsersTable
                isConnected={isConnected}
                isLoading={isLoading}
                token={token}
                users={users}
                onUpdateSubscription={handleUpdateSubscription}
              />
            </section>
          </>
        ) : section === 'entitlements' ? (
          <>
            <section className="stats-grid" aria-label="Resumen">
              <SummaryCard label="Entitlements" value={entitlements.length.toString()} />
              <SummaryCard label="Pendientes" value={pendingEntitlements.toString()} tone="expired" />
              <SummaryCard label="Resueltos" value={(entitlements.length - pendingEntitlements).toString()} tone="active" />
            </section>

            <section className="panel">
              <div className="panel-header panel-header--split">
                <div>
                  <h3>Otorgar acceso manual</h3>
                  <p>POST /api/admin/entitlements/grant para Wise, USDT o pagos manuales.</p>
                </div>
              </div>

              <form className="grant-form" onSubmit={handleGrantEntitlement}>
                <label>
                  Email
                  <input
                    type="email"
                    value={grantForm.email}
                    onChange={(event) => updateGrantForm('email', event.target.value)}
                    placeholder="cliente@email.com"
                    required
                  />
                </label>
                <label>
                  Plan
                  <input
                    value={grantForm.planCode}
                    onChange={(event) => updateGrantForm('planCode', event.target.value)}
                    placeholder="mensual"
                    required
                  />
                </label>
                <label>
                  Termina
                  <input
                    type="date"
                    value={grantForm.currentPeriodEnd}
                    onChange={(event) => updateGrantForm('currentPeriodEnd', event.target.value)}
                    required
                  />
                </label>
                <button type="submit" disabled={!isConnected || isGranting}>
                  {isGranting ? 'Otorgando' : 'Otorgar'}
                </button>
              </form>

              {successMessage ? <div className="success-banner">{successMessage}</div> : null}
              {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Buscar entitlements</h3>
                  <p>Filtra contra GET /api/admin/entitlements.</p>
                </div>
              </div>

              <div className="filters filters--entitlements">
                <label>
                  Email
                  <input
                    type="email"
                    value={entitlementFilters.email}
                    onChange={(event) => updateEntitlementFilter('email', event.target.value)}
                    placeholder="cliente@email.com"
                  />
                </label>
                <label>
                  Resuelto
                  <select
                    value={entitlementFilters.resolved}
                    onChange={(event) => updateEntitlementFilter('resolved', event.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="false">Pendientes</option>
                    <option value="true">Resueltos</option>
                  </select>
                </label>
              </div>

              <EntitlementsTable
                entitlements={entitlements}
                isConnected={isConnected}
                isLoading={isLoadingEntitlements}
              />
            </section>
          </>
        ) : (
          <>
            <section className="stats-grid" aria-label="Resumen">
              <SummaryCard label="Avisos" value={notifications.length.toString()} />
              <SummaryCard label="Enviados" value={sentNotifications.toString()} tone="active" />
              <SummaryCard label="Fallos" value={failedNotificationDeliveries.toString()} tone="expired" />
              <SummaryCard label="Abiertos" value={openedNotificationDeliveries.toString()} />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Enviar aviso</h3>
                  <p>POST /api/admin/notifications para todos los usuarios con OneSignal.</p>
                </div>
              </div>

              <form className="notification-form" onSubmit={handleSendNotification}>
                <label>
                  Tipo
                  <select
                    value={notificationForm.type}
                    onChange={(event) => selectNotificationPreset(event.target.value as AdminNotificationType)}
                  >
                    {notificationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Título
                  <input
                    value={notificationForm.title}
                    onChange={(event) => updateNotificationForm('title', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Icono app
                  <select
                    value={notificationForm.icon || 'bell'}
                    onChange={(event) => updateNotificationForm('icon', event.target.value)}
                  >
                    {notificationIcons.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Envío
                  <select
                    value={notificationSendMode}
                    onChange={(event) => setNotificationSendMode(event.target.value as NotificationSendMode)}
                  >
                    <option value="now">Enviar ahora</option>
                    <option value="scheduled">Programar</option>
                  </select>
                </label>
                <label>
                  Programar
                  <input
                    type="datetime-local"
                    value={notificationScheduledAt}
                    onChange={(event) => setNotificationScheduledAt(event.target.value)}
                    disabled={notificationSendMode !== 'scheduled'}
                    required={notificationSendMode === 'scheduled'}
                  />
                </label>
                <label className="notification-form__wide">
                  Mensaje
                  <textarea
                    value={notificationForm.message}
                    onChange={(event) => updateNotificationForm('message', event.target.value)}
                    required
                  />
                </label>
                <label className="notification-form__wide">
                  URL
                  <input
                    type="url"
                    value={notificationForm.url || ''}
                    onChange={(event) => updateNotificationForm('url', event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label className="notification-form__wide">
                  Imagen
                  <input
                    type="url"
                    value={notificationForm.imageUrl || ''}
                    onChange={(event) => updateNotificationForm('imageUrl', event.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <button type="submit" disabled={!isConnected || isSendingNotification}>
                  {isSendingNotification ? 'Enviando' : 'Enviar aviso'}
                </button>
              </form>

              {successMessage ? <div className="success-banner">{successMessage}</div> : null}
              {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Historial</h3>
                  <p>GET /api/admin/notifications.</p>
                </div>
              </div>

              <div className="filters filters--notification-history">
                <label>
                  Buscar
                  <input
                    value={notificationHistorySearch}
                    onChange={(event) => setNotificationHistorySearch(event.target.value)}
                    placeholder="Título, mensaje o tipo"
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={notificationHistoryType}
                    onChange={(event) => setNotificationHistoryType(event.target.value)}
                  >
                    <option value="">Todos</option>
                    {notificationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    value={notificationHistoryStatus}
                    onChange={(event) => setNotificationHistoryStatus(event.target.value)}
                  >
                    <option value="">Todos</option>
                    {notificationStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <NotificationsTable
                isConnected={isConnected}
                isLoading={isLoadingNotifications}
                notifications={filteredNotifications}
                onSelectNotification={(notificationId) => void loadNotificationDetail(notificationId)}
                onUpdateNotification={handleUpdateNotification}
                onDeleteNotification={handleDeleteNotification}
              />
            </section>

            {notificationDetail ? (
              <section className="panel">
                <div className="panel-header panel-header--split">
                  <div>
                    <h3>Fallos de entrega</h3>
                    <p>{notificationDetail.title}</p>
                  </div>
                  <button className="table-action" type="button" onClick={() => setNotificationDetail(null)}>
                    Cerrar
                  </button>
                </div>

                <FailedDeliveriesTable
                  deliveries={notificationDetail.deliveries.filter(
                    (delivery) => normalizeStatus(delivery.status) === 'failed',
                  )}
                  isLoading={isLoadingNotificationDetail}
                />
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function AdminLoginScreen({
  email,
  password,
  isSigningIn,
  emailError,
  passwordError,
  generalError,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  email: string;
  password: string;
  isSigningIn: boolean;
  emailError: string;
  passwordError: string;
  generalError: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="admin-login-screen">
      <section className="admin-login-card" aria-label="Acceso Admin ManLab">
        <img
          src="/brand/manlab_logo_dorado.svg"
          alt="ManLab"
          className="admin-login-logo"
        />
        <h1>MANLAB ADMIN</h1>
        <p>Ingresa con tu cuenta admin para gestionar usuarios, entitlements y avisos.</p>

        <form className="admin-login-form" onSubmit={onSubmit}>
          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="admin@manlabproject.com"
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
            />
            {emailError ? <span className="admin-login-field-error">{emailError}</span> : null}
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError ? <span className="admin-login-field-error">{passwordError}</span> : null}
          </label>

          {generalError ? <div className="admin-login-general-error">{generalError}</div> : null}

          <button type="submit" disabled={isSigningIn}>
            {isSigningIn ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function UsersTable({
  users,
  isConnected,
  isLoading,
  token,
  onUpdateSubscription,
}: {
  users: AdminUser[];
  isConnected: boolean;
  isLoading: boolean;
  token: string;
  onUpdateSubscription: (
    user: AdminUser,
    subscriptionId: string,
    data: UpdateSubscriptionRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => Promise<void>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>País</th>
            <th>Suscripción</th>
            <th>Plan</th>
            <th>Termina</th>
            <th>Editar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.userId} token={token} user={user} onUpdateSubscription={onUpdateSubscription} />
          ))}
          {!isLoading && users.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={7}>
                {isConnected ? 'No hay usuarios con esos filtros.' : 'Inicia sesión como admin para cargar usuarios.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  token,
  user,
  onUpdateSubscription,
}: {
  token: string;
  user: AdminUser;
  onUpdateSubscription: (
    user: AdminUser,
    subscriptionId: string,
    data: UpdateSubscriptionRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [subscriptions, setSubscriptions] = React.useState<AdminSubscription[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = React.useState(user.subscriptionId || '');
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = React.useState(false);
  const [rowError, setRowError] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState<UpdateSubscriptionRequest>({
    status: user.subscriptionStatus || 'none',
    planCode: user.planCode || 'mensual',
    currentPeriodEnd: toDateInputValue(user.currentPeriodEnd),
    priceLocked: user.priceLocked ?? true,
  });

  React.useEffect(() => {
    setForm({
      status: user.subscriptionStatus || 'none',
      planCode: user.planCode || 'mensual',
      currentPeriodEnd: toDateInputValue(user.currentPeriodEnd),
      priceLocked: user.priceLocked ?? true,
    });
    setSelectedSubscriptionId(user.subscriptionId || '');
  }, [user]);

  React.useEffect(() => {
    if (!isEditing || !token) {
      return;
    }

    let isMounted = true;
    setIsLoadingSubscriptions(true);
    setRowError('');

    getUserSubscriptions(token, user.userId)
      .then((nextSubscriptions) => {
        if (!isMounted) {
          return;
        }

        setSubscriptions(nextSubscriptions);

        const preferredSubscription =
          nextSubscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ||
          nextSubscriptions.find((subscription) => subscription.status === 'active') ||
          nextSubscriptions[0];

        if (preferredSubscription) {
          setSelectedSubscriptionId(preferredSubscription.id);
          setForm({
            status: preferredSubscription.status || 'none',
            planCode: preferredSubscription.planCode || 'mensual',
            currentPeriodEnd: toDateInputValue(preferredSubscription.currentPeriodEnd),
            priceLocked: preferredSubscription.priceLocked ?? user.priceLocked ?? true,
          });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setRowError(error instanceof Error ? error.message : 'No se pudieron cargar las suscripciones.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSubscriptions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEditing, token, user.priceLocked, user.subscriptionId, user.userId]);

  const updateForm = (key: keyof UpdateSubscriptionRequest, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const selectSubscription = (subscriptionId: string) => {
    setSelectedSubscriptionId(subscriptionId);
    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) {
      return;
    }

    setForm({
      status: subscription.status || 'none',
      planCode: subscription.planCode || 'mensual',
      currentPeriodEnd: toDateInputValue(subscription.currentPeriodEnd),
      priceLocked: subscription.priceLocked ?? user.priceLocked ?? true,
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onUpdateSubscription(
      user,
      selectedSubscriptionId,
      {
        ...form,
        currentPeriodEnd: toUtcPeriodEnd(form.currentPeriodEnd),
      },
      setIsSaving,
    );
  };

  return (
    <>
      <tr>
        <td>
          <strong>{user.name || 'Sin nombre'}</strong>
          <span>{user.email}</span>
        </td>
        <td>{user.role || 'User'}</td>
        <td>{user.country || 'Sin país'}</td>
        <td>
          <StatusBadge status={user.subscriptionStatus} />
        </td>
        <td>{user.planCode || 'Sin plan'}</td>
        <td>{formatDate(user.currentPeriodEnd)}</td>
        <td>
          <button className="table-action" type="button" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? 'Cerrar' : 'Editar'}
          </button>
        </td>
      </tr>
      {isEditing ? (
        <tr>
          <td colSpan={7} className="inline-editor-cell">
            {rowError ? <div className="row-error">{rowError}</div> : null}
            {isLoadingSubscriptions ? <div className="row-loading">Cargando suscripciones...</div> : null}
            {subscriptions.length > 0 ? (
              <form className="subscription-editor" onSubmit={handleSubmit}>
                <label>
                  Suscripción
                  <select
                    value={selectedSubscriptionId}
                    onChange={(event) => selectSubscription(event.target.value)}
                  >
                    {subscriptions.map((subscription) => (
                      <option key={subscription.id} value={subscription.id}>
                        {subscription.source || 'manual'} · {subscription.status} · {formatDate(subscription.currentPeriodEnd)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                    {subscriptionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Plan
                  <select value={form.planCode} onChange={(event) => updateForm('planCode', event.target.value)}>
                    {planCodes.map((planCode) => (
                      <option key={planCode} value={planCode}>
                        {planCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Termina
                  <input
                    type="date"
                    value={form.currentPeriodEnd}
                    onChange={(event) => updateForm('currentPeriodEnd', event.target.value)}
                    required
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.priceLocked}
                    onChange={(event) => updateForm('priceLocked', event.target.checked)}
                  />
                  Precio bloqueado
                </label>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando' : 'Guardar'}
                </button>
              </form>
            ) : (
              !isLoadingSubscriptions && <div className="missing-id">Este usuario no tiene suscripciones para editar.</div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EntitlementsTable({
  entitlements,
  isConnected,
  isLoading,
}: {
  entitlements: AdminEntitlement[];
  isConnected: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Plan</th>
            <th>Termina</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {entitlements.map((entitlement) => (
            <tr key={entitlement.id}>
              <td>
                <strong>{entitlement.email || 'Sin email'}</strong>
                <span>{entitlement.target || 'pending_entitlement'}</span>
              </td>
              <td>{entitlement.planCode || 'Sin plan'}</td>
              <td>{formatDate(entitlement.currentPeriodEnd || '')}</td>
              <td>
                <StatusBadge status={entitlement.resolved ? 'resolved' : 'pending'} />
              </td>
              <td>{formatDate(entitlement.createdAt || '')}</td>
              <td>
                <span className="mono-cell">{entitlement.id}</span>
              </td>
            </tr>
          ))}
          {!isLoading && entitlements.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={6}>
                {isConnected ? 'No hay entitlements con esos filtros.' : 'Inicia sesión como admin para cargar entitlements.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function NotificationsTable({
  notifications,
  isConnected,
  isLoading,
  onSelectNotification,
  onUpdateNotification,
  onDeleteNotification,
}: {
  notifications: AdminNotification[];
  isConnected: boolean;
  isLoading: boolean;
  onSelectNotification: (notificationId: string) => void;
  onUpdateNotification: (
    notificationId: string,
    data: UpdateAdminNotificationRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => Promise<void>;
  onDeleteNotification: (
    notificationId: string,
    setIsDeleting: (isDeleting: boolean) => void,
  ) => Promise<void>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Aviso</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Enviado</th>
            <th>Entregas</th>
            <th>Fallos</th>
            <th>Abiertos</th>
            <th>Detalle</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification) => (
            <NotificationHistoryRow
              key={notification.id}
              notification={notification}
              onSelectNotification={onSelectNotification}
              onUpdateNotification={onUpdateNotification}
              onDeleteNotification={onDeleteNotification}
            />
          ))}
          {!isLoading && notifications.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={10}>
                {isConnected ? 'No hay avisos enviados.' : 'Inicia sesión como admin para cargar avisos.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function NotificationHistoryRow({
  notification,
  onSelectNotification,
  onUpdateNotification,
  onDeleteNotification,
}: {
  notification: AdminNotification;
  onSelectNotification: (notificationId: string) => void;
  onUpdateNotification: (
    notificationId: string,
    data: UpdateAdminNotificationRequest,
    setIsSaving: (isSaving: boolean) => void,
  ) => Promise<void>;
  onDeleteNotification: (
    notificationId: string,
    setIsDeleting: (isDeleting: boolean) => void,
  ) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [form, setForm] = React.useState<UpdateAdminNotificationRequest>({
    type: notification.type,
    title: notification.title,
    message: notification.message,
    url: notification.url,
    imageUrl: notification.imageUrl,
    status: notification.status,
    scheduledAt: toDateTimeInputValue(notification.scheduledAt),
  });

  React.useEffect(() => {
    setForm({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      url: notification.url,
      imageUrl: notification.imageUrl,
      status: notification.status,
      scheduledAt: toDateTimeInputValue(notification.scheduledAt),
    });
  }, [notification]);

  const updateForm = (key: keyof UpdateAdminNotificationRequest, value: string | null) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onUpdateNotification(
      notification.id,
      {
        ...form,
        title: form.title.trim(),
        message: form.message.trim(),
        url: form.url?.trim() || null,
        imageUrl: form.imageUrl?.trim() || null,
        scheduledAt: toUtcDateTime(form.scheduledAt || ''),
      },
      setIsSaving,
    );
  };

  const handleDelete = async () => {
    const shouldDelete = window.confirm(`Eliminar aviso "${notification.title}"?`);
    if (!shouldDelete) {
      return;
    }

    await onDeleteNotification(notification.id, setIsDeleting);
  };

  return (
    <>
      <tr>
        <td>
          <strong>{notification.title}</strong>
          <span>{notification.message}</span>
        </td>
        <td>{notification.type}</td>
        <td>
          <StatusBadge status={notification.status} />
        </td>
        <td>{formatDate(notification.sentAt || notification.createdAt)}</td>
        <td>{notification.sentDeliveries} / {notification.totalDeliveries}</td>
        <td>{notification.failedDeliveries}</td>
        <td>{notification.openedDeliveries}</td>
        <td>
          <button className="table-action" type="button" onClick={() => onSelectNotification(notification.id)}>
            Fallos
          </button>
        </td>
        <td>
          <button className="table-action" type="button" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? 'Cerrar' : 'Editar'}
          </button>
        </td>
        <td>
          <button
            className="table-action table-action--danger"
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? 'Eliminando' : 'Eliminar'}
          </button>
        </td>
      </tr>
      {isEditing ? (
        <tr>
          <td colSpan={10} className="inline-editor-cell">
            <form className="notification-editor" onSubmit={handleSubmit}>
              <label>
                Tipo
                <select
                  value={form.type}
                  onChange={(event) => updateForm('type', event.target.value as AdminNotificationType)}
                >
                  {notificationTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  {notificationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Programado
                <input
                  type="datetime-local"
                  value={form.scheduledAt || ''}
                  onChange={(event) => updateForm('scheduledAt', event.target.value)}
                />
              </label>
              <label className="notification-editor__wide">
                Título
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} required />
              </label>
              <label className="notification-editor__wide">
                Descripción
                <textarea value={form.message} onChange={(event) => updateForm('message', event.target.value)} required />
              </label>
              <label className="notification-editor__wide">
                URL
                <input
                  type="url"
                  value={form.url || ''}
                  onChange={(event) => updateForm('url', event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label className="notification-editor__wide">
                Imagen
                <input
                  type="url"
                  value={form.imageUrl || ''}
                  onChange={(event) => updateForm('imageUrl', event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando' : 'Guardar'}
              </button>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function FailedDeliveriesTable({
  deliveries,
  isLoading,
}: {
  deliveries: AdminNotificationDetail['deliveries'];
  isLoading: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Estado</th>
            <th>Error</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td>
                <strong>{delivery.userEmail || 'Sin email'}</strong>
                <span className="mono-cell">{delivery.userId}</span>
              </td>
              <td>
                <StatusBadge status={delivery.status} />
              </td>
              <td>{delivery.errorMessage || 'Sin detalle'}</td>
              <td>{formatDate(delivery.createdAt)}</td>
            </tr>
          ))}
          {!isLoading && deliveries.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={4}>
                No hay entregas fallidas para este aviso.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'active' | 'expired' }) {
  return (
    <article className={`summary-card ${tone ? `summary-card--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = normalizeStatus(status);

  return <span className={`status-badge status-badge--${normalizedStatus}`}>{status || 'unknown'}</span>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
