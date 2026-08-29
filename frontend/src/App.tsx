import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  API_BASE_URL,
  DailyLogNotFoundError,
  type AppNotification,
  type NotificationPreference,
  type NotificationPreferenceCreate,
  type RetoDailyLog,
  type RetoDailyLogPatch,
  type RetoStreak,
  type UserNotification,
  type WeakLink,
  createBillingPortalSession,
  createNotificationPreference,
  createRetoDailyLog,
  createSubscriptionCheckoutSession,
  deleteNotificationPreference,
  deleteUserNotification,
  disableOneSignalNotifications,
  getCurrentIdentityMe,
  getIdentityMe,
  getLatestAppNotifications,
  getLocalDateOffset,
  getMyNotifications,
  getNotificationPreferences,
  getRetoDailyLog,
  getRetoLogsFromTo,
  getRetoStreak,
  getTodayLogDate,
  getUnseenNotificationCount,
  getWeakLinks,
  enableOneSignalNotifications,
  markAllNotificationsSeen,
  markNotificationSeen,
  resendClaimLink,
  claimRegisterUser,
  updateNotificationPreference,
  updateRetoDailyLog,
} from './api';
import {
  SUBSCRIPTION_EXPIRED_MESSAGE,
  clearAuthSession,
  getIdentity,
  hasActiveSubscription,
  hasCanceledSubscription,
  isAuthenticated,
  type LoginResponse,
  saveAuthSession,
  updateAuthIdentity,
} from './auth';

type ScreenKey = 'login' | 'home' | 'contenido' | 'reto' | 'notifications' | 'clon' | 'perfil' | 'veredicto';

type BottomNavKey = Exclude<ScreenKey, 'login' | 'veredicto'>;

const protectedScreens: ScreenKey[] = ['home', 'contenido', 'reto', 'notifications', 'clon', 'perfil', 'veredicto'];
const SUBSCRIPTION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const HOME_NOTIFICATION_PREVIEW_WORDS = 10;
const NOTIFICATIONS_UPDATED_EVENT = 'manlab:notifications-updated';
const NOTIFICATIONS_LIVE_REFRESH_MS = 5000;
const HOME_FEATURED_NOTIFICATIONS_COLLAPSED_COUNT = 5;
const PERSONAL_NOTIFICATIONS_COLLAPSED_COUNT = 10;
const BILLING_PORTAL_RETURN_REPAINT_KEY = 'manlab.billingPortalReturnRepaint';

const defaultNotificationPreferenceForm: NotificationPreferenceCreate = {
  type: 'reto_reminder',
  discipline: 'fisico',
  enabled: true,
  timeOfDay: '07:00',
  timezone: 'America/Mexico_City',
  reminderText: '',
};

const notificationPreferenceTypes = [
  { value: 'reto_reminder', label: 'Recordatorio Reto' },
  { value: 'daily_reto_reminder', label: 'Reto diario' },
  { value: 'weak_link_warning', label: 'Eslabón débil' },
];

const notificationPreferenceDisciplines = [
  { value: 'intelectual', label: 'Intelectual' },
  { value: 'espiritual', label: 'Espiritual' },
  { value: 'fisico', label: 'Físico' },
  { value: 'economico', label: 'Económico' },
  { value: 'social_atraccion', label: 'Social / Atracción' },
];

const notificationPreferenceTimezones = [
  'America/Mexico_City',
  'America/Monterrey',
  'America/Tijuana',
  'America/New_York',
  'America/Detroit',
  'America/Los_Angeles',
];

type TabButtonProps = {
  current: ScreenKey;
  target: BottomNavKey;
  label: string;
  icon: ReactNode;
  badgeCount?: number;
  onNavigate: (screen: ScreenKey) => void;
};

type ShellButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
};

type DisplayNotification = AppNotification | UserNotification;

const tabs: Array<{
  key: BottomNavKey;
  label: string;
  icon: ReactNode;
}> = [
  {
    key: 'home',
    label: 'Home',
    icon: <HomeIcon />,
  },
  {
    key: 'reto',
    label: 'Reto',
    icon: <ClipboardIcon />, 
  },
  {
    key: 'notifications',
    label: 'Avisos',
    icon: <BellIcon />,
  },
  {
    key: 'clon',
    label: 'Clon',
    icon: <ChatIcon />,
  },
  {
    key: 'perfil',
    label: 'Perfil',
    icon: <UserIcon />,
  },
];

const defaultRetoLog: RetoDailyLog = {
  dayIndex: 1,
  logDate: getTodayLogDate(),
  fIntelectual: false,
  fEspiritual: false,
  fFisico: false,
  fEconomico: false,
  fSocialAtraccion: false,
  bitacora: '',
};

const retoFrentes: Array<{
  key: keyof RetoDailyLogPatch;
  label: string;
  icon: ReactNode;
}> = [
  { key: 'fIntelectual', label: 'Intelectual', icon: <IdeaIcon /> },
  { key: 'fEspiritual', label: 'Espiritual', icon: <FeatherIcon /> },
  { key: 'fFisico', label: 'Físico', icon: <DumbbellIcon /> },
  { key: 'fEconomico', label: 'Económico', icon: <DollarIcon /> },
  { key: 'fSocialAtraccion', label: 'Social / Atracción', icon: <PeopleIcon /> },
];

const dailyTip = {
  dayLabel: '3 de agosto',
  cardNumber: '99',
  body:
    'La calle no perdona la teoría. Lo que sabes en la cabeza vale cero si no lo has probado en carne.',
  author: 'MASTER SANTANA',
};

type ContentItem = {
  label: string;
  title: string;
  description: string;
  status: string;
  ctaLabel: string;
  locked?: boolean;
};

type ContentSection = {
  eyebrow: string;
  title: string;
  summary: string;
  items: ContentItem[];
};

const contentSections: ContentSection[] = [
  {
    eyebrow: 'Universidad del Hombre',
    title: 'Videos',
    summary: 'Clases en video que se irán cargando más adelante con la suscripción activa.',
    items: [
      {
        label: 'UNIVERSIDAD DEL HOMBRE',
        title: 'Biblioteca audiovisual',
        description: 'Lecciones grabadas y material profundo para la membresía.',
        status: 'Disponible con suscripción',
        ctaLabel: 'PRÓXIMAMENTE',
        locked: true,
      },
    ],
  },
  {
    eyebrow: 'Cursos digitales',
    title: 'FORMACIÓN EN VIDEO',
    summary: 'Cursos que se desbloquean una vez que el usuario paga por cada producto.',
    items: [
      {
        label: 'CURSO DIGITAL',
        title: 'EL SEDUCTOR LEGENDARIO',
        description: 'Curso en video sobre presencia, atracción y seducción estratégica.',
        status: 'Se desbloquea al pagar',
        ctaLabel: 'ACCEDER →',
        locked: true,
      },
      {
        label: 'CURSO DIGITAL',
        title: 'MAESTRÍA EN CONVENCIMIENTO',
        description: 'Entrenamiento para persuadir, argumentar y comunicar con precisión.',
        status: 'Se desbloquea al pagar',
        ctaLabel: 'ACCEDER →',
        locked: true,
      },
      {
        label: 'NIVEL: CURSO DIGITAL',
        title: 'LOS PILARES DEL HOMBRE CHINGÓN',
        description: 'Bloque de formación base para la disciplina, criterio y ejecución.',
        status: 'Se desbloquea al pagar',
        ctaLabel: 'ACCEDER',
        locked: true,
      },
    ],
  },
  {
    eyebrow: 'Audiolibros',
    title: 'Narración completa',
    summary: 'Pistas de audio para escuchar el contenido sin abrir la pantalla de video.',
    items: [
      {
        label: 'AUDIOLIBROS',
        title: 'Narración completa',
        description: 'Catálogo de audio con reproducción continua dentro de la app.',
        status: 'Disponible en la biblioteca',
        ctaLabel: 'PRÓXIMAMENTE',
        locked: true,
      },
    ],
  },
  {
    eyebrow: 'Libros digitales',
    title: 'Ebooks técnicos',
    summary: 'Lecturas técnicas y manuales pensados para consulta dentro del móvil.',
    items: [
      {
        label: 'LIBROS DIGITALES',
        title: 'Ebooks técnicos',
        description: 'Archivos listos para lectura con enfoque táctico y práctico.',
        status: 'Disponible en la biblioteca',
        ctaLabel: 'PRÓXIMAMENTE',
        locked: true,
      },
    ],
  },
];

const verdictText =
  'Tres días sin pisar el gimnasio, y el resto del circuito ya lo siente. Tu economía se sostuvo, tu palabra con Dios se sostuvo — pero el cuerpo es la base, y una base que cede arrastra todo lo que construiste encima. No es cansancio. Es una decisión que estás tomando cada mañana que te quedas en la cama.';

const fallbackHomeNotifications: AppNotification[] = [
  {
    id: 'mock-video',
    type: 'youtube_new_video',
    title: 'Nuevo video subido',
    message: 'Contenido ManLab',
    icon: 'video',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-book',
    type: 'ebook',
    title: 'Nuevo ebook: Maestría en Convencimiento',
    message: 'Biblioteca ManLab',
    icon: 'book',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-tip',
    type: 'daily_tip',
    title: 'Nuevo consejo del día',
    message: 'Consejo del día',
    icon: 'bulb',
    createdAt: new Date().toISOString(),
  },
];

function isStandalonePwa() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function getNotificationId(notification: DisplayNotification) {
  return 'deliveryId' in notification ? notification.deliveryId : notification.id;
}

function getNotificationDate(notification: DisplayNotification) {
  if ('sentAt' in notification && notification.sentAt) {
    return notification.sentAt;
  }

  return notification.createdAt;
}

function truncateWords(text: string, limit: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= limit) {
    return text;
  }

  return `${words.slice(0, limit).join(' ')}...`;
}

function getHomeDailyTipPreview(notification: AppNotification | null) {
  return truncateWords(notification?.message || dailyTip.body, 12);
}

function isPaymentFailureStatus(identity = getIdentity()) {
  const status = identity?.subscriptionStatus?.toLowerCase() || '';
  return ['past_due', 'payment_failed', 'unpaid'].includes(status);
}

function notifyNotificationsChanged() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

function isNotificationSeen(notification: DisplayNotification) {
  if ('isSeen' in notification) {
    return notification.isSeen;
  }

  return false;
}

function getReverseRetoDay(fallbackDayIndex: number) {
  const identity = getIdentity();

  if (identity?.currentDayIndex) {
    return Math.max(0, Math.min(100, 101 - identity.currentDayIndex));
  }

  const startDate = identity?.startDate;

  if (!startDate) {
    return Math.max(0, Math.min(100, 101 - fallbackDayIndex));
  }

  const start = new Date(startDate);
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const elapsedDays = Math.max(0, Math.floor((todayDay - startDay) / 86400000));

  return Math.max(0, Math.min(100, 100 - elapsedDays));
}

function isRetoLogComplete(log?: RetoDailyLog | null) {
  return Boolean(
    log?.fIntelectual &&
      log.fEspiritual &&
      log.fFisico &&
      log.fEconomico &&
      log.fSocialAtraccion,
  );
}

function getAdjustedCurrentStreak(streak: RetoStreak, recentLogs: RetoDailyLog[], dailyLog?: RetoDailyLog | null) {
  const today = getTodayLogDate();
  const logsByDate = new Map(recentLogs.map((log) => [log.logDate.slice(0, 10), log]));
  if (dailyLog) {
    logsByDate.set(dailyLog.logDate.slice(0, 10), dailyLog);
  }

  let adjustedStreak = 0;
  let cursorOffset = isRetoLogComplete(logsByDate.get(today)) ? 0 : -1;

  for (let daysChecked = 0; daysChecked < recentLogs.length + 1; daysChecked += 1) {
    const date = getLocalDateOffset(cursorOffset);
    const log = logsByDate.get(date);

    if (!isRetoLogComplete(log)) {
      break;
    }

    adjustedStreak += 1;
    cursorOffset -= 1;
  }

  return Math.max(streak.currentStreak, adjustedStreak);
}

async function getAuthResponseMessage(response: Response) {
  const text = await response.text();

  if (!text) {
    return '';
  }

  try {
    const json = JSON.parse(text) as {
      error?: string;
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };
    const fieldErrors = json.errors ? Object.values(json.errors).flat().join(' ') : '';

    return json.error || json.message || fieldErrors || json.title || text;
  } catch {
    return text;
  }
}

function getLoginErrorMessage(response: Response, message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    response.status === 404 ||
    normalizedMessage.includes('email') ||
    normalizedMessage.includes('correo') ||
    normalizedMessage.includes('user') ||
    normalizedMessage.includes('usuario')
  ) {
    return 'El correo no existe o está mal escrito.';
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    normalizedMessage.includes('password') ||
    normalizedMessage.includes('contraseña') ||
    normalizedMessage.includes('clave')
  ) {
    return 'La contraseña es incorrecta.';
  }

  return message || 'Correo o contraseña inválidos.';
}

function findDailyTipNotification(notifications: AppNotification[]) {
  return notifications.find((notification) => {
    const icon = notification.icon?.toLowerCase() || '';
    const type = notification.type?.toLowerCase() || '';
    const title = notification.title?.toLowerCase() || '';

    return icon === 'bulb' || icon === 'light' || type.includes('consejo') || title.includes('consejo');
  });
}

function getInitialScreen(): ScreenKey {
  if (typeof window === 'undefined') {
    return 'login';
  }

  const hashValue = window.location.hash.replace('#', '');
  const hashRoute = hashValue.split('?')[0] as ScreenKey;

  if (['login', 'home', 'contenido', 'reto', 'notifications', 'clon', 'perfil', 'veredicto'].includes(hashRoute)) {
    const identity = getIdentity();

    if (hasCanceledSubscription(identity) && hashRoute !== 'perfil') {
      return 'perfil';
    }

    if (protectedScreens.includes(hashRoute) && !isAuthenticated()) {
      return 'login';
    }

    return hashRoute;
  }

  return 'login';
}

function useScreen() {
  const [screen, setScreen] = useState<ScreenKey>(getInitialScreen);

  useEffect(() => {
    const syncFromHash = () => {
      const nextScreen = getInitialScreen();
      const currentHashRoute = window.location.hash.replace('#', '').split('?')[0];

      if (nextScreen === 'login' && currentHashRoute !== 'login') {
        window.location.hash = '#login';
        return;
      }

      if (nextScreen !== 'login' && currentHashRoute !== nextScreen) {
        window.location.hash = `#${nextScreen}`;
        return;
      }

      setScreen(nextScreen);
    };

    if (!window.location.hash) {
      window.location.hash = '#login';
    }

    syncFromHash();

    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    const titles: Record<ScreenKey, string> = {
      login: 'ManLab · Acceso',
      home: 'ManLab · Home',
      contenido: 'ManLab · Contenido',
      reto: 'ManLab · Reto',
      notifications: 'ManLab · Avisos',
      clon: 'ManLab · Clon',
      perfil: 'ManLab · Perfil',
      veredicto: 'ManLab · Veredicto',
    };

    document.title = titles[screen];
  }, [screen]);

  const navigate = (next: ScreenKey) => {
    const identity = getIdentity();

    if (hasCanceledSubscription(identity) && next !== 'perfil') {
      window.location.hash = '#perfil';
      return;
    }

    if (protectedScreens.includes(next) && !isAuthenticated()) {
      window.location.hash = '#login';
      return;
    }

    window.location.hash = `#${next}`;
  };

  return { screen, navigate };
}

export default function App() {
  const { screen, navigate } = useScreen();
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);

  useEffect(() => {
    if (screen === 'login' || !isAuthenticated()) {
      return;
    }

    let isMounted = true;

    const checkSubscription = async () => {
      if (!isAuthenticated()) {
        return;
      }

      try {
        const identity = await getCurrentIdentityMe();

        if (!isMounted) {
          return;
        }

        if (hasCanceledSubscription(identity)) {
          updateAuthIdentity(identity);
          if (screen !== 'perfil') {
            window.location.hash = '#perfil';
          }
          return;
        }

        if (!hasActiveSubscription(identity)) {
          setIsSubscriptionExpired(true);
          clearAuthSession();
          window.location.hash = '#login';
          return;
        }

        updateAuthIdentity(identity);
      } catch {
        // Keep the user in the app on temporary network/API failures.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkSubscription();
      }
    };

    void checkSubscription();
    const intervalId = window.setInterval(checkSubscription, SUBSCRIPTION_CHECK_INTERVAL_MS);
    window.addEventListener('focus', checkSubscription);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkSubscription);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [screen]);

  return (
    <div className="app-shell">
      <div className={`phone-frame phone-frame--${screen}`}>
        {screen === 'login' ? (
          <LoginScreen onEnter={() => navigate('home')} onNavigate={navigate} />
        ) : screen === 'home' ? (
          <HomeScreen onNavigate={navigate} />
        ) : screen === 'contenido' ? (
          <ContenidoScreen onNavigate={navigate} />
        ) : screen === 'reto' ? (
          <RetoScreen onNavigate={navigate} />
        ) : screen === 'notifications' ? (
          <NotificationsScreen onNavigate={navigate} />
        ) : screen === 'clon' ? (
          <ClonScreen onNavigate={navigate} />
        ) : screen === 'perfil' ? (
          <PerfilScreen onNavigate={navigate} />
        ) : (
          <VeredictoScreen onBack={() => navigate('reto')} />
        )}
      </div>
      {isSubscriptionExpired ? <SubscriptionExpiredModal onReturnToLogin={() => setIsSubscriptionExpired(false)} /> : null}
    </div>
  );
}

function SubscriptionExpiredModal({ onReturnToLogin }: { onReturnToLogin: () => void }) {
  return (
    <div className="subscription-expired-backdrop" role="presentation">
      <div className="subscription-expired-modal" role="alertdialog" aria-modal="true" aria-labelledby="subscription-expired-title">
        <span className="subscription-expired-modal__icon" aria-hidden="true">
          !
        </span>
        <h2 id="subscription-expired-title">Suscripción expirada</h2>
        <p>{SUBSCRIPTION_EXPIRED_MESSAGE}</p>
        <p>Tu acceso queda bloqueado hasta que la suscripción sea renovada.</p>
        <button type="button" onClick={onReturnToLogin}>
          Ya renové, iniciar sesión
        </button>
      </div>
    </div>
  );
}

function LoginScreen({
  onEnter,
}: {
  onEnter: () => void;
  onNavigate: (screen: ScreenKey) => void;
}) {
  const claimToken = getClaimTokenFromUrl();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingClaimLink, setIsResendingClaimLink] = useState(false);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (!claimToken) {
          setErrorMessage('No se encontró token de registro en la URL.');
          return;
        }

        if (!name.trim()) {
          setErrorMessage('Escribe tu nombre.');
          return;
        }

        if (password !== confirmPassword) {
          setErrorMessage('Las contraseñas no coinciden.');
          return;
        }

        const registerResponse = await claimRegisterUser(claimToken, name.trim(), password);
        setAuthMode('login');
        setName('');
        setPassword('');
        setConfirmPassword('');
        setSuccessMessage(registerResponse.message || 'Cuenta creada. Inicia sesión para entrar.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/identity/login`, {
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
        const message = await getAuthResponseMessage(response);
        throw new Error(getLoginErrorMessage(response, message));
      }

      const loginResponse = (await response.json()) as LoginResponse;
      const identity = await getIdentityMe(loginResponse);

      if (!hasActiveSubscription(identity) && !hasCanceledSubscription(identity)) {
        clearAuthSession();
        throw new Error(SUBSCRIPTION_EXPIRED_MESSAGE);
      }

      saveAuthSession(loginResponse, identity);
      onEnter();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : authMode === 'register'
            ? 'No se pudo crear la cuenta.'
            : 'Correo o contraseña inválidos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendClaimLink = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage('Escribe el correo con el que se hizo el pago para reenviar el enlace.');
      setSuccessMessage('');
      return;
    }

    setIsResendingClaimLink(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await resendClaimLink(normalizedEmail);
      setSuccessMessage(
        response.message || 'Si existe un pago activo para este email, enviaremos un nuevo enlace.',
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo reenviar el enlace.');
    } finally {
      setIsResendingClaimLink(false);
    }
  };

  return (
    <section className="screen screen--login">
      <div className="login-mark" aria-hidden="true">
        <div className="login-mark__ring">
          <img src="/brand/manlab_dragon_dorado.svg" alt="" className="login-mark__logo" />
        </div>
      </div>

      <div className="login-brand">
        <h1>MANLAB</h1>
        <p>HONOS · PROBITAS · PERFECTIO</p>
      </div>

      <div className="auth-mode-toggle" aria-label="Modo de acceso">
        <button
          type="button"
          className={authMode === 'login' ? 'is-active' : ''}
          onClick={() => {
            setAuthMode('login');
            setConfirmPassword('');
            setErrorMessage('');
            setSuccessMessage('');
          }}
        >
          Acceso
        </button>
        <button
          type="button"
          className={authMode === 'register' ? 'is-active' : ''}
          onClick={() => {
            setAuthMode('register');
            setPassword('');
            setConfirmPassword('');
            setErrorMessage('');
            setSuccessMessage('');
          }}
        >
          Registro
        </button>
      </div>

      <form className="auth-form" onSubmit={handleAuthSubmit}>
        {authMode === 'login' ? (
          <label className="field">
            <span>CORREO</span>
            <input
              type="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
        ) : (
          <>
            <label className="field">
              <span>NOMBRE</span>
              <input
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>CORREO DE COMPRA</span>
              <input
                type="email"
                placeholder="buyer@email.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </>
        )}

        <label className="field">
          <span>CONTRASEÑA</span>
          <input
            type="password"
            placeholder="••••••••"
            autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {authMode === 'register' ? (
          <label className="field">
            <span>CONFIRMAR CONTRASEÑA</span>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
        ) : null}

        {successMessage ? <p className="auth-success">{successMessage}</p> : null}
        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

        <ShellButton type="submit" variant="primary" fullWidth>
          {isSubmitting ? (authMode === 'register' ? 'CREANDO...' : 'ENTRANDO...') : authMode === 'register' ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}
        </ShellButton>

        {authMode === 'register' ? (
          <button
            type="button"
            className="auth-secondary-action"
            onClick={handleResendClaimLink}
            disabled={isResendingClaimLink}
          >
            {isResendingClaimLink ? 'REENVIANDO ENLACE...' : 'REENVIAR ENLACE DE CREACIÓN'}
          </button>
        ) : null}
      </form>

      <p className="auth-linkline">
        ¿Olvidaste tu contraseña? <button type="button" className="link-button">Enlace mágico</button>
      </p>

      <div className="login-separator" />

      <p className="login-note">El acceso se activa al completar tu suscripción en manlabproject.com</p>
    </section>
  );
}

function getClaimTokenFromUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const tokenFromSearch = extractRawToken(window.location.search);
  if (tokenFromSearch) {
    return tokenFromSearch;
  }

  const hash = window.location.hash || '';
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const tokenFromHash = extractRawToken(hashQuery);
  if (tokenFromHash) {
    return tokenFromHash;
  }

  return '';
}

function extractRawToken(source: string) {
  if (!source) {
    return '';
  }

  const match = source.match(/[?&]token=([^&]+)/i);
  if (!match) {
    return '';
  }

  // Preserve '+' characters from email links (URLSearchParams converts them to spaces).
  const rawToken = match[1].trim();

  try {
    return decodeURIComponent(rawToken);
  } catch {
    return rawToken;
  }
}

function RetoScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [dailyLog, setDailyLog] = useState<RetoDailyLog>(defaultRetoLog);
  const [recentLogs, setRecentLogs] = useState<RetoDailyLog[]>([]);
  const [weakLinks, setWeakLinks] = useState<WeakLink[]>([]);
  const [streak, setStreak] = useState<RetoStreak>({ currentStreak: 0, longestStreak: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isStreakInfoOpen, setIsStreakInfoOpen] = useState(false);
  const [isWeakLinkInfoOpen, setIsWeakLinkInfoOpen] = useState(false);
  const [isBitacoraHelpOpen, setIsBitacoraHelpOpen] = useState(false);

  const loadWeakLinks = async () => {
    try {
      setWeakLinks(await getWeakLinks());
    } catch {
      setWeakLinks([]);
    }
  };

  const loadStreak = async () => {
    try {
      setStreak(await getRetoStreak());
    } catch {
      setStreak({ currentStreak: 0, longestStreak: 0 });
    }
  };

  const loadRecentLogs = async () => {
    try {
      setRecentLogs(await getRetoLogsFromTo(getLocalDateOffset(-6), getTodayLogDate()));
    } catch {
      setRecentLogs([]);
    }
  };

  useEffect(() => {
    let isMounted = true;

    setIsLoadingLog(true);
    getRetoDailyLog()
      .then((log) => {
        if (isMounted) {
          setDailyLog({ ...log, bitacora: log.bitacora ?? '' });
          setStatusMessage('');
        }
      })
      .catch(async (error) => {
        if (isMounted) {
          if (error instanceof DailyLogNotFoundError) {
            try {
              const createdLog = await createRetoDailyLog({
                logDate: getTodayLogDate(),
                fIntelectual: false,
                fEspiritual: false,
                fFisico: false,
                fEconomico: false,
                fSocialAtraccion: false,
                bitacora: '',
              });

              if (isMounted) {
                setDailyLog({ ...createdLog, bitacora: createdLog.bitacora ?? '' });
                setStatusMessage('');
              }
            } catch {
              if (isMounted) {
                setStatusMessage('No se pudo crear la bitácora de hoy.');
              }
            }

            return;
          }

          setStatusMessage('No se pudo cargar la bitácora de hoy.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingLog(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadWeakLinks();
    loadStreak();
    loadRecentLogs();
  }, []);

  const updateFront = (key: keyof RetoDailyLogPatch) => {
    setDailyLog((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateNote = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDailyLog((current) => ({
      ...current,
      bitacora: event.target.value,
    }));
  };

  const saveDailyLog = async () => {
    setIsSavingLog(true);
    setStatusMessage('');

    try {
      const updatedLog = await updateRetoDailyLog({
        fIntelectual: dailyLog.fIntelectual,
        fEspiritual: dailyLog.fEspiritual,
        fFisico: dailyLog.fFisico,
        fEconomico: dailyLog.fEconomico,
        fSocialAtraccion: dailyLog.fSocialAtraccion,
        bitacora: dailyLog.bitacora ?? '',
      });

      setDailyLog({ ...updatedLog, bitacora: updatedLog.bitacora ?? '' });
      await loadWeakLinks();
      await loadStreak();
      await loadRecentLogs();
      setStatusMessage('Bitácora guardada.');
    } catch {
      setStatusMessage('No se pudo guardar la bitácora.');
    } finally {
      setIsSavingLog(false);
    }
  };

  const primaryWeakLink = weakLinks[0];
  const reverseRetoDay = getReverseRetoDay(dailyLog.dayIndex);
  const completedFronts = retoFrentes.filter((front) => dailyLog[front.key]).length;
  const adjustedCurrentStreak = getAdjustedCurrentStreak(streak, recentLogs, dailyLog);
  const scrollToRetoSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="screen screen--stacked reto-dashboard">
      <header className="screen-header screen-header--with-metric">
        <div>
          <h2>DIA {reverseRetoDay}/100</h2>
          <p>{dailyLog.logDate}</p>
        </div>

        <button
          type="button"
          className="metric metric--button"
          onClick={() => setIsStreakInfoOpen((isOpen) => !isOpen)}
          aria-expanded={isStreakInfoOpen}
          aria-controls="reto-streak-info"
        >
          <FlameIcon />
          <span>{adjustedCurrentStreak}</span>
        </button>
      </header>

      {isStreakInfoOpen ? (
        <button
          type="button"
          className="reto-info-box reto-info-box--sticky"
          id="reto-streak-info"
          onClick={() => setIsStreakInfoOpen(false)}
        >
          <strong>Racha actual</strong>
          <p>
            Son los días consecutivos que has completado los cinco frentes. Si hoy todavía no está completo,
            la racha de ayer se mantiene hasta que termine el día.
          </p>
          <span>Máxima: {streak.longestStreak} días</span>
        </button>
      ) : null}

      <button
        type="button"
        className="alert-pill alert-pill--button"
        onClick={() => setIsWeakLinkInfoOpen((isOpen) => !isOpen)}
        aria-expanded={isWeakLinkInfoOpen}
        aria-controls="reto-weak-link-info"
      >
        <WarningIcon />
        <span>
          {primaryWeakLink
            ? `Eslabón débil: ${primaryWeakLink.discipline} — ${primaryWeakLink.failedDays} días cayendo`
            : 'Eslabón débil: sin fallas registradas'}
        </span>
      </button>

      {isWeakLinkInfoOpen ? (
        <button
          type="button"
          className="reto-info-box"
          id="reto-weak-link-info"
          onClick={() => setIsWeakLinkInfoOpen(false)}
        >
          <strong>Eslabón débil</strong>
          <p>
            Es el frente que más has fallado en tu historial reciente (3 dias). Úsalo como señal para ajustar el día,
            no como excusa para soltar el reto.
          </p>
          <span>
            {primaryWeakLink
              ? `${primaryWeakLink.discipline}: ${primaryWeakLink.failedDays} días fallados`
              : 'No hay fallas suficientes para marcar un eslabón.'}
          </span>
        </button>
      ) : null}

      <div className="reto-fronts-header">
        <p className="section-kicker">LOS CINCO FRENTES</p>
        <span>{completedFronts}/5</span>
      </div>

      <div className="fronts-list" role="list">
        {retoFrentes.map((front) => (
          <button
            type="button"
            className="front-row"
            key={front.label}
            role="listitem"
            onClick={() => updateFront(front.key)}
            disabled={isLoadingLog}
          >
            <div className="front-row__label">
              <span className="front-row__icon">{front.icon}</span>
              <span>{front.label}</span>
            </div>

            <div className={`front-row__state ${dailyLog[front.key] ? 'is-checked' : 'is-empty'}`}>
              {dailyLog[front.key] ? <CheckIcon /> : <span />}
            </div>
          </button>
        ))}
      </div>

      <section className="home-section reto-mini-menu">
        <h3>ACCESO RETO</h3>
        <div className="home-quick-grid">
          <QuickAccessButton label="Editar 5 Disciplinas" icon={<EditIcon />} onClick={() => scrollToRetoSection('reto-edit')} />
          <QuickAccessButton label="Historial 7 Dias" icon={<HistoryIcon />} onClick={() => scrollToRetoSection('reto-history')} />
          <QuickAccessButton label="Resumen 7 Dias" icon={<FlameIcon />} onClick={() => scrollToRetoSection('reto-summary')} />
        </div>
      </section>

      <section className="reto-card" id="reto-bitacora">
        <div className="reto-card__header">
          <div className="reto-card__title-with-help">
            <h3>BITÁCORA</h3>
            <button
              type="button"
              className="help-button"
              onClick={() => setIsBitacoraHelpOpen(true)}
              aria-label="Ver ejemplo de bitácora"
            >
              ?
            </button>
          </div>
        </div>

        <label className="note-field">
          <span className="sr-only">Bitácora de hoy</span>
          <textarea
            placeholder="Detalla tus 5 disciplinas "
            rows={5}
            value={dailyLog.bitacora ?? ''}
            onChange={updateNote}
            disabled={isLoadingLog}
          />
        </label>

        <ShellButton variant="secondary" fullWidth onClick={saveDailyLog}>
          {isSavingLog ? 'GUARDANDO...' : 'GUARDAR BITÁCORA'}
        </ShellButton>

        <ShellButton variant="primary" fullWidth onClick={() => onNavigate('veredicto')}>
          PEDIR VEREDICTO AL CLON
        </ShellButton>
      </section>

      {statusMessage ? <p className="reto-status">{statusMessage}</p> : null}

      {isBitacoraHelpOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsBitacoraHelpOpen(false)}>
          <section
            className="bitacora-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bitacora-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bitacora-help-modal__header">
              <h3 id="bitacora-help-title">Cómo escribir una buena bitácora</h3>
              <button type="button" onClick={() => setIsBitacoraHelpOpen(false)} aria-label="Cerrar ejemplo">
                ×
              </button>
            </div>

            <p>
              Escribe evidencia concreta de lo que hiciste. Puedes combinar varias disciplinas en una misma
              historia si ocurrieron juntas.
            </p>

            <div className="bitacora-example">
              <p><strong>Intelectual:</strong> Hoy estudié 30 minutos mi curso de programación y terminé un módulo.</p>
              <p><strong>Espiritual:</strong> Medité 15 minutos y mantuve presencia de mente aunque me distraía. Escuché el audiolibro del Poder del Ahora en el metro.</p>
              <p><strong>Físico:</strong> Hice mi rutina de pesas de pierna y fui al club de correr durante 30 minutos.</p>
              <p><strong>Económico:</strong> Estudié 20 minutos anuncios de Facebook para mi negocio. Solo pude eso; mañana empiezo a correrlos.</p>
              <p><strong>Social:</strong> En el club de correr hablé con 2 chavos nuevos. En el camino a casa abordé a 1 mujer; no pude sacar cita, me grabé y soné nervioso.</p>
            </div>
          </section>
        </div>
      ) : null}

      <BottomNav current="reto" onNavigate={onNavigate} />
    </section>
  );
}

function RetoHistoryRow({ log }: { log: RetoDailyLog }) {
  const completed = [
    log.fIntelectual,
    log.fEspiritual,
    log.fFisico,
    log.fEconomico,
    log.fSocialAtraccion,
  ].filter(Boolean).length;

  return (
    <article className="reto-history-row">
      <div>
        <strong>{log.logDate}</strong>
        <p>{log.bitacora || 'Sin bitácora escrita'}</p>
      </div>
      <span>{completed}/5</span>
    </article>
  );
}

function HomeScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [streak, setStreak] = useState<RetoStreak>({ currentStreak: 0, longestStreak: 0 });
  const [recentLogs, setRecentLogs] = useState<RetoDailyLog[]>([]);
  const [homeNotifications, setHomeNotifications] = useState<AppNotification[]>(fallbackHomeNotifications);
  const [isFeaturedOverflowOpen, setIsFeaturedOverflowOpen] = useState(false);
  const [homeDailyTip, setHomeDailyTip] = useState<AppNotification | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<DisplayNotification | null>(null);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const reverseRetoDay = getReverseRetoDay(1);
  const adjustedCurrentStreak = getAdjustedCurrentStreak(streak, recentLogs);
  const visibleHomeNotifications = homeNotifications.slice(0, HOME_FEATURED_NOTIFICATIONS_COLLAPSED_COUNT);
  const featuredOverflowNotifications = homeNotifications.slice(HOME_FEATURED_NOTIFICATIONS_COLLAPSED_COUNT);

  useEffect(() => {
    let isMounted = true;

    getRetoStreak()
      .then((retoStreak) => {
        if (isMounted) {
          setStreak(retoStreak);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStreak({ currentStreak: 0, longestStreak: 0 });
        }
      });

    getRetoLogsFromTo(getLocalDateOffset(-6), getTodayLogDate())
      .then((logs) => {
        if (isMounted) {
          setRecentLogs(logs);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRecentLogs([]);
        }
      });

    getLatestAppNotifications(100)
      .then((notifications) => {
        if (isMounted) {
          setHomeNotifications(notifications);
          setHomeDailyTip(findDailyTipNotification(notifications) || null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHomeNotifications(fallbackHomeNotifications);
          setHomeDailyTip(findDailyTipNotification(fallbackHomeNotifications) || null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEnableNotifications = async () => {
    setNotificationStatus('');
    setIsEnablingNotifications(true);

    try {
      await enableOneSignalNotifications();
      setNotificationStatus('Notificaciones activadas.');
    } catch (error) {
      setNotificationStatus(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  return (
    <section className="screen screen--stacked screen--tight-bottom home-screen">
      <header className="home-brand-card">
        <div className="home-brand-card__main">
          <img src="/brand/manlab_dragon_dorado.svg" alt="" className="home-brand-card__logo" />
          <div>
            <h2>MANLAB APP</h2>
            <p>H O N O S · P R O B I T A S ‎· P E R F E C T I O</p>
          </div>
        </div>
        <button
          type="button"
          className="home-bell-button"
          aria-label="Activar notificaciones"
          onClick={handleEnableNotifications}
          disabled={isEnablingNotifications}
        >
          <BellIcon />
        </button>
      </header>

      {notificationStatus ? <p className="home-notification-status">{notificationStatus}</p> : null}

      <button
        type="button"
        className="home-action-card home-action-card--button"
        onClick={() => {
          if (homeDailyTip) {
            setSelectedNotification(homeDailyTip);
          }
        }}
      >
        <span>CONSEJO DEL DÍA</span>
        <strong>{getHomeDailyTipPreview(homeDailyTip)}</strong>
        <p>{homeDailyTip?.title || dailyTip.author}</p>
      </button>

      <div className="home-stats-grid">
        <article className="home-stat-card">
          <strong>DIA {reverseRetoDay}</strong>
          <span>Reto 100 De 100</span>
        </article>
        <article className="home-stat-card">
          <strong>{adjustedCurrentStreak}</strong>
          <span>Racha actual</span>
        </article>
      </div>

      <section className="home-section">
        <h3>ACCESO RÁPIDO</h3>
        <div className="home-quick-grid">
          <QuickAccessButton label="Reto" icon={<ClipboardIcon />} onClick={() => onNavigate('reto')} />
          <QuickAccessButton label="Avisos" icon={<BellIcon />} onClick={() => onNavigate('notifications')} />
          <QuickAccessButton label="Clon" icon={<ChatIcon />} onClick={() => onNavigate('clon')} />
          <QuickAccessButton label="Contenido" icon={<BookIcon />} onClick={() => onNavigate('contenido')} />
        </div>
      </section>

      <section className="home-section">
        <h3>AVISOS DESTACADOS</h3>
        <div className="home-alerts">
          {visibleHomeNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              messageWordLimit={HOME_NOTIFICATION_PREVIEW_WORDS}
              onOpen={() => setSelectedNotification(notification)}
            />
          ))}
        </div>
        {homeNotifications.length > 0 ? (
          <button
            type="button"
            className="show-more-arrow-button"
            onClick={() => setIsFeaturedOverflowOpen(true)}
          >
            <span>SHOW MORE</span>
            <ChevronRightIcon />
          </button>
        ) : null}
      </section>

      <BottomNav current="home" onNavigate={onNavigate} />
      {selectedNotification ? (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      ) : null}
      {isFeaturedOverflowOpen ? (
        <NotificationOverflowModal
          title="Más avisos destacados"
          items={featuredOverflowNotifications}
          emptyMessage="No hay más avisos por mostrar."
          onClose={() => setIsFeaturedOverflowOpen(false)}
          onOpenNotification={(notification) => {
            setIsFeaturedOverflowOpen(false);
            setSelectedNotification(notification);
          }}
        />
      ) : null}
    </section>
  );
}

function QuickAccessButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="home-quick-button" onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
    </button>
  );
}

function ContenidoScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);

      if (next.has(sectionTitle)) {
        next.delete(sectionTitle);
      } else {
        next.add(sectionTitle);
      }

      return next;
    });
  };

  return (
    <section className="screen screen--stacked screen--tight-bottom content-screen">
      <div className="content-topbar">
        <button type="button" className="back-button" onClick={() => onNavigate('home')} aria-label="Volver al home">
          <ArrowLeftIcon />
          <span>CONTENIDO</span>
        </button>

        <div className="content-topbar__copy">
          <p className="section-kicker">BIBLIOTECA MANLAB</p>
          <span>Videos, cursos, audiolibros y ebooks</span>
        </div>
      </div>

      <header className="content-hero">
        <h2>CONTENIDO</h2>
        <p>
          Aquí se concentra toda la biblioteca: videos, cursos digitales, audiolibros y libros técnicos.
          Parte del catálogo se libera con la suscripción y otra parte se desbloquea por compra individual.
        </p>
      </header>

      <div className="content-sections">
        {contentSections.map((section) => (
          <article key={section.title} className="content-section-card">
            <div className="content-section-card__header">
              <div>
                <span>{section.eyebrow}</span>
                <h3>{section.title}</h3>
              </div>
              <p>{section.items.length} piezas</p>
            </div>

            <p className="content-section-card__summary">{section.summary}</p>

            <button
              type="button"
              className="content-section-card__toggle"
              onClick={() => toggleSection(section.title)}
              aria-expanded={expandedSections.has(section.title)}
            >
              {expandedSections.has(section.title) ? 'VER MENOS' : 'VER CONTENIDO'}
            </button>

            {expandedSections.has(section.title) ? (
              <div className="content-item-list">
                {section.items.map((item) => (
                  <article key={item.title} className={`content-item ${item.locked ? 'is-locked' : ''}`}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <div className="content-item__actions">
                      <span className="content-status-pill">{item.status}</span>
                      <button type="button" className="content-item__cta" disabled={item.locked}>
                        {item.ctaLabel}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <p className="content-footer-note">
        El acceso completo dependerá de tu plan activo y de las compras que se habiliten dentro de la app.
      </p>

      <BottomNav current="contenido" onNavigate={onNavigate} />
    </section>
  );
}

function getNotificationIcon(notification: DisplayNotification) {
  const icon = notification.icon?.toLowerCase();
  const type = notification.type?.toLowerCase() || '';
  const title = notification.title?.toLowerCase() || '';

  if (icon === 'warning' || type.includes('payment') || title.includes('pago fallido')) {
    return <WarningIcon />;
  }

  if (icon === 'book' || type.includes('ebook') || title.includes('ebook') || title.includes('libro')) {
    return <BookIcon />;
  }

  if (icon === 'bulb' || icon === 'light' || type.includes('consejo') || title.includes('consejo')) {
    return <BulbIcon />;
  }

  if (icon === 'video' || icon === 'live' || type.includes('video') || type.includes('live')) {
    return <VideoIcon />;
  }

  return <BellIcon />;
}

function getNotificationMeta(notification: DisplayNotification) {
  const dateValue = getNotificationDate(notification);
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Reciente';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'Ahora';
  }

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function NotificationRow({
  notification,
  messageWordLimit,
  onOpen,
  onRequestDelete,
  showSeenState = false,
}: {
  notification: DisplayNotification;
  messageWordLimit?: number;
  onOpen: () => void;
  onRequestDelete?: (notification: UserNotification) => void;
  showSeenState?: boolean;
}) {
  const [didImageFail, setDidImageFail] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const shouldShowImage = Boolean(notification.imageUrl && !didImageFail);
  const previewMessage = messageWordLimit
    ? truncateWords(notification.message, messageWordLimit)
    : notification.message;
  const isSeen = isNotificationSeen(notification);
  const canDelete = Boolean(onRequestDelete && 'deliveryId' in notification);

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const requestDelete = () => {
    if (canDelete && 'deliveryId' in notification) {
      onRequestDelete?.(notification);
    }
  };

  const handlePointerDown = () => {
    if (!canDelete) {
      return;
    }

    didLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      requestDelete();
    }, 280);
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
  };

  const handleOpen = () => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }

    onOpen();
  };

  return (
    <div className={`notification-row-shell ${canDelete ? 'notification-long-press' : ''}`}>
      <button
        type="button"
        className={`home-alert-row home-alert-row--clickable ${showSeenState && !isSeen ? 'home-alert-row--unseen' : ''}`}
        onClick={handleOpen}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <span className="home-alert-row__icon">
          {shouldShowImage ? (
            <img
              src={notification.imageUrl || ''}
              alt=""
              className="home-alert-row__image"
              onError={() => setDidImageFail(true)}
            />
          ) : (
            getNotificationIcon(notification)
          )}
        </span>
        <div>
          <strong>{notification.title}</strong>
          {previewMessage ? <span className="home-alert-row__message">{previewMessage}</span> : null}
          <p>{getNotificationMeta(notification)}</p>
        </div>
        <span className="home-alert-row__meta">
          {showSeenState && !isSeen ? <span className="notification-unseen-dot" aria-label="No visto" /> : null}
          <ArrowLeftIcon />
        </span>
      </button>
    </div>
  );
}

function NotificationDetailModal({
  notification,
  onClose,
}: {
  notification: DisplayNotification;
  onClose: () => void;
}) {
  const [didImageFail, setDidImageFail] = useState(false);
  const shouldShowImage = Boolean(notification.imageUrl && !didImageFail);

  const openUrl = () => {
    if (notification.url) {
      window.open(notification.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <article
        className="notification-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`notification-detail-${getNotificationId(notification)}`}
        onClick={(event) => event.stopPropagation()}
      >
        {shouldShowImage ? (
          <img
            src={notification.imageUrl || ''}
            alt=""
            className="notification-detail-modal__image"
            onError={() => setDidImageFail(true)}
          />
        ) : null}
        <div className="notification-detail-modal__header">
          <span className="home-alert-row__icon">{getNotificationIcon(notification)}</span>
          <div>
            <h3 id={`notification-detail-${getNotificationId(notification)}`}>{notification.title}</h3>
            <p>{getNotificationMeta(notification)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
        <p className="notification-detail-modal__message">{notification.message}</p>
        {notification.url ? (
          <ShellButton variant="primary" fullWidth onClick={openUrl}>
            ABRIR ENLACE
          </ShellButton>
        ) : null}
      </article>
    </div>
  );
}

function NotificationOverflowModal({
  title,
  items,
  emptyMessage,
  onClose,
  onOpenNotification,
  onRequestDelete,
}: {
  title: string;
  items: DisplayNotification[];
  emptyMessage: string;
  onClose: () => void;
  onOpenNotification: (notification: DisplayNotification) => void;
  onRequestDelete?: (notification: UserNotification) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <article
        className="notification-overflow-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notification-overflow-modal__header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar listado de avisos">
            ×
          </button>
        </div>

        <div className="notification-overflow-modal__list">
          {items.length === 0 ? <p className="notifications-empty">{emptyMessage}</p> : null}
          {items.map((notification) => (
            <NotificationRow
              key={getNotificationId(notification)}
              notification={notification}
              onOpen={() => onOpenNotification(notification)}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      </article>
    </div>
  );
}

function NotificationsScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [preferenceForm, setPreferenceForm] =
    useState<NotificationPreferenceCreate>(defaultNotificationPreferenceForm);
  const [selectedNotification, setSelectedNotification] = useState<DisplayNotification | null>(null);
  const [notificationPendingDelete, setNotificationPendingDelete] = useState<UserNotification | null>(null);
  const [filter, setFilter] = useState<'all' | 'unseen'>('all');
  const [avisosView, setAvisosView] = useState<'notifications' | 'reminders'>('notifications');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [isMarkingAllSeen, setIsMarkingAllSeen] = useState(false);
  const [isDeletingNotification, setIsDeletingNotification] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isPersonalOverflowOpen, setIsPersonalOverflowOpen] = useState(false);
  const visiblePersonalNotifications = notifications.slice(0, PERSONAL_NOTIFICATIONS_COLLAPSED_COUNT);
  const personalOverflowNotifications = notifications.slice(PERSONAL_NOTIFICATIONS_COLLAPSED_COUNT);

  const loadNotifications = async () => {
    setIsLoading(true);
    setStatusMessage('');

    try {
      const userNotifications = await getMyNotifications(filter === 'unseen' ? false : undefined);
      setNotifications(
        filter === 'unseen'
          ? userNotifications.filter((notification) => !isNotificationSeen(notification))
          : userNotifications,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudieron cargar los avisos.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreferences = async () => {
    setIsLoadingPreferences(true);

    try {
      setPreferences(await getNotificationPreferences());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus recordatorios.');
    } finally {
      setIsLoadingPreferences(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setStatusMessage('');
    getMyNotifications(filter === 'unseen' ? false : undefined)
      .then((userNotifications) => {
        if (isMounted) {
          setNotifications(
            filter === 'unseen'
              ? userNotifications.filter((notification) => !isNotificationSeen(notification))
              : userNotifications,
          );
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStatusMessage(error instanceof Error ? error.message : 'No se pudieron cargar los avisos.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filter]);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingPreferences(true);
    getNotificationPreferences()
      .then((nextPreferences) => {
        if (isMounted) {
          setPreferences(nextPreferences);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStatusMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus recordatorios.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPreferences(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (avisosView !== 'notifications') {
      return;
    }

    let isMounted = true;

    const refreshNotificationsLive = async () => {
      try {
        const userNotifications = await getMyNotifications(filter === 'unseen' ? false : undefined);
        if (!isMounted) {
          return;
        }
        setNotifications(
          filter === 'unseen'
            ? userNotifications.filter((notification) => !isNotificationSeen(notification))
            : userNotifications,
        );
      } catch {
        // Keep current list on transient live-refresh failures.
      }
    };

    const handleWindowFocus = () => {
      void refreshNotificationsLive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotificationsLive();
      }
    };

    const liveRefreshIntervalId = window.setInterval(() => {
      void refreshNotificationsLive();
    }, NOTIFICATIONS_LIVE_REFRESH_MS);

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowFocus);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(liveRefreshIntervalId);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowFocus);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [avisosView, filter]);

  const openNotification = async (notification: DisplayNotification) => {
    setSelectedNotification(notification);

    if (isNotificationSeen(notification)) {
      return;
    }

    if (!('deliveryId' in notification)) {
      return;
    }

    try {
      await markNotificationSeen(notification.deliveryId);
      const seenNotification = { ...notification, isSeen: true, seenAt: new Date().toISOString() };
      setSelectedNotification(seenNotification);
      setNotifications((current) =>
        current
          .map((item) =>
            'deliveryId' in item && item.deliveryId === notification.deliveryId ? seenNotification : item,
          )
          .filter((item) => filter !== 'unseen' || !isNotificationSeen(item)),
      );
      notifyNotificationsChanged();
    } catch {
      setStatusMessage('No se pudo marcar el aviso como visto.');
    }
  };

  const markAllSeen = async () => {
    setIsMarkingAllSeen(true);
    setStatusMessage('');

    try {
      await markAllNotificationsSeen();
      setNotifications((current) =>
        current
          .map((notification) =>
            'deliveryId' in notification
              ? {
                  ...notification,
                  isSeen: true,
                  seenAt: notification.seenAt || new Date().toISOString(),
                }
              : notification,
          )
          .filter((notification) => filter !== 'unseen' || !isNotificationSeen(notification)),
      );
      notifyNotificationsChanged();
      setStatusMessage('Avisos marcados como vistos.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudieron marcar los avisos.');
    } finally {
      setIsMarkingAllSeen(false);
    }
  };

  const confirmDeleteNotification = async () => {
    if (!notificationPendingDelete) {
      return;
    }

    setIsDeletingNotification(true);
    setStatusMessage('');

    try {
      await deleteUserNotification(notificationPendingDelete.deliveryId);
      setNotifications((current) =>
        current.filter((notification) => getNotificationId(notification) !== notificationPendingDelete.deliveryId),
      );
      setSelectedNotification((current) =>
        current && getNotificationId(current) === notificationPendingDelete.deliveryId ? null : current,
      );
      setNotificationPendingDelete(null);
      notifyNotificationsChanged();
      setStatusMessage('Aviso eliminado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo eliminar la notificación.');
    } finally {
      setIsDeletingNotification(false);
    }
  };

  const updatePreferenceForm = (key: keyof NotificationPreferenceCreate, value: string | boolean | null) => {
    setPreferenceForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const createPreference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPreference(true);
    setStatusMessage('');

    try {
      await createNotificationPreference({
        ...preferenceForm,
        discipline: preferenceForm.discipline || null,
        reminderText: preferenceForm.reminderText?.trim() || null,
      });
      setPreferenceForm((current) => ({
        ...defaultNotificationPreferenceForm,
        timeOfDay: current.timeOfDay,
        timezone: current.timezone,
      }));
      await loadPreferences();
      setStatusMessage('Recordatorio creado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo crear el recordatorio.');
    } finally {
      setIsSavingPreference(false);
    }
  };

  const togglePreference = async (preference: NotificationPreference) => {
    setStatusMessage('');

    try {
      await updateNotificationPreference(preference.id, { enabled: !preference.enabled });
      setPreferences((current) =>
        current.map((item) =>
          item.id === preference.id ? { ...item, enabled: !item.enabled } : item,
        ),
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo actualizar el recordatorio.');
    }
  };

  const updatePreferenceTime = async (preference: NotificationPreference, timeOfDay: string) => {
    setStatusMessage('');

    try {
      await updateNotificationPreference(preference.id, { timeOfDay });
      setPreferences((current) =>
        current.map((item) => (item.id === preference.id ? { ...item, timeOfDay } : item)),
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo actualizar la hora.');
    }
  };

  const updatePreferenceReminderText = async (preference: NotificationPreference, reminderText: string) => {
    setStatusMessage('');

    try {
      await updateNotificationPreference(preference.id, { reminderText: reminderText.trim() || null });
      setPreferences((current) =>
        current.map((item) => (item.id === preference.id ? { ...item, reminderText } : item)),
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo actualizar el texto.');
    }
  };

  const removePreference = async (preferenceId: string) => {
    setStatusMessage('');

    try {
      await deleteNotificationPreference(preferenceId);
      setPreferences((current) => current.filter((preference) => preference.id !== preferenceId));
      setStatusMessage('Recordatorio eliminado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo eliminar el recordatorio.');
    }
  };

  return (
    <section className="screen screen--stacked screen--tight-bottom screen--notifications">
      <header className="screen-header">
        <h2>AVISOS</h2>
        <p>Notificaciones de ManLab</p>
      </header>

      <section
        className={`notification-preferences-card ${avisosView === 'reminders' ? '' : 'is-hidden'}`}
        aria-labelledby="notification-preferences-title"
      >
        <div className="notification-preferences-card__header">
          <div>
            <h3 id="notification-preferences-title">Mis recordatorios</h3>
            <p>Programa avisos personales para tu Reto.</p>
          </div>
        </div>

        <form className="notification-preference-form" onSubmit={createPreference}>
          <label>
            Tipo
            <select
              value={preferenceForm.type}
              onChange={(event) => updatePreferenceForm('type', event.target.value)}
            >
              {notificationPreferenceTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Disciplina
            <select
              value={preferenceForm.discipline || ''}
              onChange={(event) => updatePreferenceForm('discipline', event.target.value || null)}
            >
              {notificationPreferenceDisciplines.map((discipline) => (
                <option key={discipline.value} value={discipline.value}>
                  {discipline.label}
                </option>
              ))}
            </select>
          </label>
          <label className="notification-preference-form__time">
            Hora
            <input
              type="time"
              value={preferenceForm.timeOfDay}
              onChange={(event) => updatePreferenceForm('timeOfDay', event.target.value)}
              required
            />
          </label>
          <label>
            Zona
            <select
              value={preferenceForm.timezone}
              onChange={(event) => updatePreferenceForm('timezone', event.target.value)}
            >
              {notificationPreferenceTimezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>
          <label className="notification-preference-toggle">
            <input
              type="checkbox"
              checked={preferenceForm.enabled}
              onChange={(event) => updatePreferenceForm('enabled', event.target.checked)}
            />
            Activo
          </label>
          <button type="submit" disabled={isSavingPreference}>
            {isSavingPreference ? 'Guardando' : 'Crear'}
          </button>
          <label className="notification-preference-form__wide">
            Texto
            <textarea
              value={preferenceForm.reminderText || ''}
              onChange={(event) => updatePreferenceForm('reminderText', event.target.value)}
              placeholder="Escribe tu recordatorio..."
              rows={3}
            />
          </label>
        </form>

        <div className="notification-preference-list">
          {preferences.map((preference) => (
            <article key={preference.id} className="notification-preference-row">
              <div>
                <strong>{notificationPreferenceTypes.find((type) => type.value === preference.type)?.label || preference.type}</strong>
                <span>
                  {notificationPreferenceDisciplines.find((discipline) => discipline.value === preference.discipline)?.label ||
                    preference.discipline ||
                    'General'} · {preference.timezone}
                </span>
              </div>
              <textarea
                value={preference.reminderText || ''}
                onChange={(event) => {
                  const reminderText = event.target.value;
                  setPreferences((current) =>
                    current.map((item) => (item.id === preference.id ? { ...item, reminderText } : item)),
                  );
                }}
                onBlur={(event) => void updatePreferenceReminderText(preference, event.target.value)}
                aria-label="Texto del recordatorio"
                rows={2}
              />
              <input
                type="time"
                value={preference.timeOfDay}
                onChange={(event) => void updatePreferenceTime(preference, event.target.value)}
                aria-label="Hora del recordatorio"
              />
              <button
                type="button"
                className={preference.enabled ? 'notification-preference-state is-active' : 'notification-preference-state'}
                onClick={() => void togglePreference(preference)}
              >
                {preference.enabled ? 'Activo' : 'Pausado'}
              </button>
              <button
                type="button"
                className="notification-preference-delete"
                onClick={() => void removePreference(preference.id)}
                aria-label="Eliminar recordatorio"
              >
                ×
              </button>
            </article>
          ))}
          {!isLoadingPreferences && preferences.length === 0 ? (
            <p className="notifications-empty">Aún no tienes recordatorios personales.</p>
          ) : null}
          {isLoadingPreferences ? <p className="notifications-empty">Cargando recordatorios...</p> : null}
        </div>
      </section>

      <div className="notifications-toolbar">
        <div className="segmented-control" aria-label="Filtro de avisos">
          <button
            type="button"
            className={avisosView === 'notifications' ? 'is-active' : ''}
            onClick={() => {
              setAvisosView('notifications');
              setFilter('all');
            }}
          >
            Todos
          </button>
          <button
            type="button"
            className={avisosView === 'reminders' ? 'is-active' : ''}
            onClick={() => setAvisosView('reminders')}
          >
            Mis recordatorios
          </button>
        </div>
        <button
          type="button"
          className={`notifications-mark-button ${avisosView === 'notifications' ? '' : 'is-placeholder'}`}
          onClick={() => void markAllSeen()}
          disabled={
            avisosView !== 'notifications' ||
            isMarkingAllSeen ||
            notifications.every((notification) => isNotificationSeen(notification))
          }
          aria-hidden={avisosView !== 'notifications'}
          tabIndex={avisosView === 'notifications' ? 0 : -1}
        >
          {isMarkingAllSeen ? 'Marcando' : 'Marcar vistos'}
        </button>
      </div>

      {statusMessage ? <p className="notifications-status">{statusMessage}</p> : null}

      {avisosView === 'notifications' ? (
      <div className="home-alerts notifications-list">
        {visiblePersonalNotifications.map((notification) => (
          <NotificationRow
            key={getNotificationId(notification)}
            notification={notification}
            showSeenState
            onOpen={() => void openNotification(notification)}
            onRequestDelete={(item) => setNotificationPendingDelete(item)}
          />
        ))}
        {!isLoading && notifications.length === 0 ? (
          <p className="notifications-empty">
            {filter === 'unseen' ? 'No tienes avisos pendientes.' : 'Todavía no hay avisos.'}
          </p>
        ) : null}
        {isLoading ? <p className="notifications-empty">Cargando avisos...</p> : null}
      </div>
      ) : null}

      {avisosView === 'notifications' && notifications.length > 0 ? (
        <button
          type="button"
          className="show-more-arrow-button show-more-arrow-button--notifications"
          onClick={() => setIsPersonalOverflowOpen(true)}
        >
          <span>SHOW MORE</span>
          <ChevronRightIcon />
        </button>
      ) : null}

      <div className="screen-spacer" />

      <BottomNav current="notifications" onNavigate={onNavigate} />
      {selectedNotification ? (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => {
            setSelectedNotification(null);
            void loadNotifications();
          }}
        />
      ) : null}
      {isPersonalOverflowOpen ? (
        <NotificationOverflowModal
          title="Más avisos personales"
          items={personalOverflowNotifications}
          emptyMessage="No hay más avisos por mostrar."
          onClose={() => setIsPersonalOverflowOpen(false)}
          onOpenNotification={(notification) => {
            setIsPersonalOverflowOpen(false);
            void openNotification(notification);
          }}
          onRequestDelete={(notification) => {
            setIsPersonalOverflowOpen(false);
            setNotificationPendingDelete(notification);
          }}
        />
      ) : null}
      {notificationPendingDelete ? (
        <div
          className="modal-backdrop notification-delete-backdrop"
          role="presentation"
          onClick={() => {
            if (!isDeletingNotification) {
              setNotificationPendingDelete(null);
            }
          }}
        >
          <article
            className="notification-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <span>Eliminar aviso</span>
              <h3 id="notification-delete-title">{notificationPendingDelete.title}</h3>
              <p>Esto lo borra solo de tu bandeja dentro de ManLab.</p>
            </div>
            <div className="notification-delete-modal__actions">
              <button
                type="button"
                onClick={() => setNotificationPendingDelete(null)}
                disabled={isDeletingNotification}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => void confirmDeleteNotification()}
                disabled={isDeletingNotification}
              >
                {isDeletingNotification ? 'Eliminando' : 'Eliminar'}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function VeredictoScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="screen screen--stacked screen--veredicto">
      <button type="button" className="back-button" onClick={onBack} aria-label="Volver al reto">
        <ArrowLeftIcon />
        <span>VEREDICTO</span>
      </button>

      <div className="tag-pill">Eslabón débil: Físico</div>

      <p className="verdict-copy">{verdictText}</p>

      <div className="doctrine-footer">HONOS · PROBITAS · PERFECTIO</div>

      <ShellButton variant="secondary" fullWidth onClick={onBack}>
        VOLVER AL RETO
      </ShellButton>
    </section>
  );
}

function ClonScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  return (
    <section className="screen screen--stacked screen--tight-bottom">
      <header className="screen-header">
        <h2>HABLA CON EL CLON</h2>
        <p>Master Santana</p>
      </header>

      <DelphiEmbed />

      <BottomNav current="clon" onNavigate={onNavigate} />
    </section>
  );
}

function DelphiEmbed() {
  const embedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = embedRef.current;
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://www.delphi.ai/embed.js';
    script.async = true;
    script.dataset.channel = '78394006-0094-4443-bd09-85ecc0901a19';
    script.dataset.mode = 'inline';
    script.dataset.width = '100%';
    script.dataset.height = '600';

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return <div ref={embedRef} className="delphi-embed" aria-label="Chat Delphi" />;
}

function formatSubscriptionEndDate(value?: string) {
  if (!value) {
    return 'Sin fecha registrada';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatPlanCode(planCode?: string) {
  const normalizedPlan = planCode?.toLowerCase();

  if (normalizedPlan === 'mensual') {
    return 'Mensual';
  }

  if (normalizedPlan === 'anual') {
    return 'Anual';
  }

  if (normalizedPlan === 'fundador') {
    return 'Fundador';
  }

  return planCode || 'Sin plan';
}

function getProfileInitials(name?: string, email?: string) {
  const label = name?.trim() || email?.trim() || 'ManLab';
  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

type LegalDocumentKey = 'terms' | 'privacy' | 'refunds';

const legalDocuments: Record<LegalDocumentKey, { title: string; body: string }> = {
  terms: {
    title: 'Términos',
    body:
      'Mockup: Al usar ManLab aceptas utilizar la plataforma de forma personal, cuidar tus credenciales y respetar las reglas de la comunidad. El acceso, contenido y funciones pueden evolucionar mientras la app sigue en construcción.',
  },
  privacy: {
    title: 'Privacidad',
    body:
      'Mockup: ManLab usa tu nombre, correo, estado de suscripción, progreso del Reto y datos de notificaciones para operar tu cuenta. No vendemos tu información personal. Puedes solicitar revisión o eliminación de datos desde soporte.',
  },
  refunds: {
    title: 'Política de reembolsos',
    body:
      'Mockup: Los reembolsos se revisan caso por caso según la fecha de compra, el uso de la cuenta y las condiciones de la oferta vigente. Las suscripciones activas pueden cancelarse para evitar renovaciones futuras.',
  },
};

function PerfilScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const identity = getIdentity();
  const [streak, setStreak] = useState<RetoStreak>({ currentStreak: 0, longestStreak: 0 });
  const [recentLogs, setRecentLogs] = useState<RetoDailyLog[]>([]);
  const [pushStatus, setPushStatus] = useState('');
  const [isPushEnabled, setIsPushEnabled] = useState(
    identity?.pushEnabled ??
      (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted'),
  );
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [isRenewingSubscription, setIsRenewingSubscription] = useState(false);
  const [billingPortalStatus, setBillingPortalStatus] = useState('');
  const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocumentKey | null>(null);
  const planLabel = formatPlanCode(identity?.planCode);
  const subscriptionEndDate = formatSubscriptionEndDate(identity?.currentPeriodEnd);
  const legalDocument = activeLegalDocument ? legalDocuments[activeLegalDocument] : null;
  const adjustedCurrentStreak = getAdjustedCurrentStreak(streak, recentLogs);
  const hasPaymentFailure = isPaymentFailureStatus(identity);
  const isSubscriptionCanceled = hasCanceledSubscription(identity);

  const handleLogout = () => {
    clearAuthSession();
    onNavigate('login');
  };

  const handlePushToggle = async () => {
    setPushStatus('');
    setIsUpdatingPush(true);

    try {
      if (!isPushEnabled) {
        await enableOneSignalNotifications();
        setIsPushEnabled(true);
        getCurrentIdentityMe().then(updateAuthIdentity).catch(() => undefined);
        setPushStatus('Notificaciones push activadas.');
        return;
      }

      await disableOneSignalNotifications();
      setIsPushEnabled(false);
      getCurrentIdentityMe().then(updateAuthIdentity).catch(() => undefined);
      setPushStatus('Push pausado en este dispositivo. Los avisos dentro de la app seguirán visibles.');
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : 'No se pudo actualizar push.');
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setBillingPortalStatus('');
    setIsOpeningBillingPortal(true);
    const portalWindow = isStandalonePwa() ? window.open('about:blank', '_blank') : null;

    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}#perfil`;
      const response = await createBillingPortalSession(returnUrl);

      if (!response.url) {
        throw new Error('No se recibió URL del portal de facturación.');
      }

      window.sessionStorage.setItem(BILLING_PORTAL_RETURN_REPAINT_KEY, '1');
      if (portalWindow) {
        portalWindow.opener = null;
        portalWindow.location.href = response.url;
        setBillingPortalStatus('Stripe se abrió fuera de la app.');
        return;
      }

      window.location.assign(response.url);
    } catch (error) {
      const status = (error as Error & { status?: number })?.status;

      if (status === 409) {
        setBillingPortalStatus('Tu suscripción está cancelada. Reactiva tu plan para volver a entrar.');
        return;
      }

      portalWindow?.close();
      setBillingPortalStatus(
        error instanceof Error ? error.message : 'No se pudo abrir el portal de facturación.',
      );
    } finally {
      setIsOpeningBillingPortal(false);
    }
  };

  const handleRenewSubscription = async () => {
    setBillingPortalStatus('');
    setIsRenewingSubscription(true);

    try {
      const planCode = identity?.planCode || 'clon';
      const email = identity?.email || '';
      const response = await createSubscriptionCheckoutSession(planCode, email);

      if (!response.url && !response.checkoutUrl) {
        throw new Error('No se recibió la URL del checkout de renovación.');
      }

      window.location.assign(response.url || response.checkoutUrl || '#perfil');
    } catch (error) {
      setBillingPortalStatus(
        error instanceof Error ? error.message : 'No se pudo crear la renovación de la suscripción.',
      );
    } finally {
      setIsRenewingSubscription(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    getRetoStreak()
      .then((retoStreak) => {
        if (isMounted) {
          setStreak(retoStreak);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStreak({ currentStreak: 0, longestStreak: 0 });
        }
      });

    getRetoLogsFromTo(getLocalDateOffset(-6), getTodayLogDate())
      .then((logs) => {
        if (isMounted) {
          setRecentLogs(logs);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRecentLogs([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="screen screen--stacked screen--tight-bottom profile-screen">
      <header className="profile-hero">
        <div className="profile-hero__avatar">{getProfileInitials(identity?.name, identity?.email)}</div>
        <div>
          <h2>PERFIL</h2>
          <p>{identity?.name || 'Hombre en obra'}</p>
          <span className="profile-hero__email">{identity?.email || 'Sin correo registrado'}</span>
        </div>
      </header>

      <div className="profile-identity-card">
        <div>
          <span>Nombre</span>
          <strong>{identity?.name || 'Sin nombre registrado'}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{identity?.email || 'Sin correo registrado'}</strong>
        </div>
      </div>

      <div className={`profile-card profile-card--accent ${hasPaymentFailure ? 'profile-card--warning' : ''}`}>
        <span className="profile-card__eyebrow">Estado actual</span>
        <strong>
          {isSubscriptionCanceled
            ? 'Suscripción cancelada'
            : hasPaymentFailure
              ? 'Pago fallido'
              : identity?.subscriptionStatus === 'active'
                ? 'Acceso activo'
                : 'Revisar suscripción'}
        </strong>
        <p>Plan: {planLabel}</p>
        <p>Termina: {subscriptionEndDate}</p>
        {isSubscriptionCanceled ? (
          <p>Tu acceso a Home, Reto, Avisos y Clon quedó bloqueado. Reactiva o actualiza tu plan desde el portal de facturación para volver a entrar.</p>
        ) : hasPaymentFailure ? (
          <p>Actualiza tu método de pago desde Stripe para evitar perder acceso.</p>
        ) : null}
        <p>Edición: <strong>HIERRO</strong></p>
      </div>

      <div className="profile-rank-rail">
        <div className="profile-rank-rail__item">
          <span>Rango</span>
          <strong>Hombre en obra</strong>
        </div>
        <div className="profile-rank-rail__divider" aria-hidden="true" />
        <div className="profile-rank-rail__item">
          <span>Racha</span>
          <strong>{adjustedCurrentStreak} días</strong>
          <p>Máxima: {streak.longestStreak}</p>
        </div>
      </div>

      <div className="profile-card profile-card--settings">
        <span className="profile-card__eyebrow">Preferencias</span>
        <label className="profile-toggle-row">
          <span>
            <strong>Push notifications</strong>
            <p>{pushStatus || 'Guarda el player ID de OneSignal para tus avisos.'}</p>
          </span>
          <input
            type="checkbox"
            checked={isPushEnabled}
            onChange={handlePushToggle}
            disabled={isUpdatingPush}
          />
        </label>
      </div>

      <div className="profile-card profile-card--billing">
        <span className="profile-card__eyebrow">Suscripción</span>
        <p>Administra pagos, método de cobro, facturas y cancelación desde Stripe.</p>
        <div className="profile-billing-actions">
          {isSubscriptionCanceled ? (
            <ShellButton
              variant="primary"
              fullWidth
              onClick={handleRenewSubscription}
              disabled={isRenewingSubscription}
            >
              {isRenewingSubscription ? 'REACTIVANDO...' : 'REACTIVAR SUSCRIPCIÓN'}
            </ShellButton>
          ) : (
            <ShellButton
              variant="primary"
              fullWidth
              onClick={handleOpenBillingPortal}
              disabled={isOpeningBillingPortal}
            >
              {isOpeningBillingPortal ? 'ABRIENDO PORTAL...' : 'ADMINISTRAR SUSCRIPCIÓN'}
            </ShellButton>
          )}
          {!isSubscriptionCanceled ? (
            <ShellButton
              variant="secondary"
              fullWidth
              onClick={handleOpenBillingPortal}
              disabled={isOpeningBillingPortal}
            >
              {isOpeningBillingPortal ? 'ABRIENDO PORTAL...' : 'CANCELAR SUSCRIPCIÓN'}
            </ShellButton>
          ) : null}
        </div>
        {billingPortalStatus ? <p className="profile-billing-status">{billingPortalStatus}</p> : null}
      </div>

      <ShellButton variant="secondary" fullWidth onClick={handleLogout}>
        CERRAR SESIÓN
      </ShellButton>

      <div className="profile-legal-list profile-legal-list--featured" aria-label="Documentos legales">
        <button type="button" onClick={() => setActiveLegalDocument('terms')}>Términos</button>
        <button type="button" onClick={() => setActiveLegalDocument('privacy')}>Privacidad</button>
        <button type="button" onClick={() => setActiveLegalDocument('refunds')}>Política de reembolsos</button>
      </div>

      <BottomNav current="perfil" onNavigate={onNavigate} />
      {legalDocument ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveLegalDocument(null)}>
          <div
            className="profile-legal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-legal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-legal-modal__header">
              <h3 id="profile-legal-title">{legalDocument.title}</h3>
              <button type="button" onClick={() => setActiveLegalDocument(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <p>{legalDocument.body}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BottomNav({ current, onNavigate }: { current: ScreenKey; onNavigate: (screen: ScreenKey) => void }) {
  const [unseenCount, setUnseenCount] = useState(0);
  const [repaintKey, setRepaintKey] = useState(0);
  const [isRepainting, setIsRepainting] = useState(false);
  const visibleTabs = hasCanceledSubscription(getIdentity()) ? tabs.filter((tab) => tab.key === 'perfil') : tabs;

  useEffect(() => {
    let isMounted = true;
    const repaintTimers: number[] = [];

    const loadUnseenCount = async () => {
      if (!isAuthenticated()) {
        return;
      }

      try {
        const result = await getUnseenNotificationCount();
        if (isMounted) {
          setUnseenCount(result.count);
        }
      } catch {
        if (isMounted) {
          setUnseenCount(0);
        }
      }
    };

    const handleWindowFocus = () => {
      void loadUnseenCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadUnseenCount();
      }
    };

    const triggerNavRepaint = (force = false) => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const shouldForceRepaint =
        force || window.sessionStorage.getItem(BILLING_PORTAL_RETURN_REPAINT_KEY) === '1';

      if (!shouldForceRepaint) {
        setRepaintKey((currentKey) => currentKey + 1);
        return;
      }

      window.sessionStorage.removeItem(BILLING_PORTAL_RETURN_REPAINT_KEY);
      setIsRepainting(true);

      [0, 80, 240, 520].forEach((delay) => {
        const timerId = window.setTimeout(() => {
          if (isMounted) {
            setRepaintKey((currentKey) => currentKey + 1);
          }
        }, delay);
        repaintTimers.push(timerId);
      });

      const finishTimerId = window.setTimeout(() => {
        if (isMounted) {
          setIsRepainting(false);
        }
      }, 720);
      repaintTimers.push(finishTimerId);
    };

    const handleFocusRepaint = () => triggerNavRepaint();
    const handlePageShow = () => triggerNavRepaint(true);
    const handleVisibilityRepaint = () => triggerNavRepaint();

    void loadUnseenCount();
    const refreshIntervalId = window.setInterval(() => {
      void loadUnseenCount();
    }, NOTIFICATIONS_LIVE_REFRESH_MS);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowFocus);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('focus', handleFocusRepaint);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityRepaint);

    return () => {
      isMounted = false;
      window.clearInterval(refreshIntervalId);
      repaintTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleWindowFocus);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('focus', handleFocusRepaint);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityRepaint);
    };
  }, []);

  return (
    <nav
      key={repaintKey}
      className={`bottom-nav ${isRepainting ? 'bottom-nav--repainting' : ''}`}
      aria-label="Navegación principal"
    >
      {visibleTabs.map((tab) => (
        <TabButton
          key={tab.key}
          current={current}
          target={tab.key}
          label={tab.label}
          icon={tab.icon}
          badgeCount={tab.key === 'notifications' ? unseenCount : 0}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function TabButton({ current, target, label, icon, badgeCount = 0, onNavigate }: TabButtonProps) {
  const active = current === target;

  return (
    <button
      type="button"
      className={`bottom-nav__item ${active ? 'is-active' : ''}`}
      onClick={() => onNavigate(target)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="bottom-nav__icon">
        {icon}
        {badgeCount > 0 ? <span className="bottom-nav__badge">{badgeCount > 9 ? '9+' : badgeCount}</span> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

function ShellButton({
  children,
  variant = 'secondary',
  fullWidth,
  type = 'button',
  onClick,
  disabled = false,
}: ShellButtonProps) {
  return (
    <button
      type={type}
      className={`shell-button shell-button--${variant} ${fullWidth ? 'shell-button--full' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ClipboardIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M9 4h6a2 2 0 0 1 2 2v1H7V6a2 2 0 0 1 2-2Z" />
      <path d="M7 7h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7Z" />
      <path d="M9 11h6M9 15h6" />
    </SvgIcon>
  );
}

function HomeIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </SvgIcon>
  );
}

function BulbIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8 10a4 4 0 1 1 8 0c0 1.7-.8 3-2 4-.6.5-1 1.1-1 2h-2c0-.9-.4-1.5-1-2-1.2-1-2-2.3-2-4Z" />
    </SvgIcon>
  );
}

function BellIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </SvgIcon>
  );
}

function BookIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
    </SvgIcon>
  );
}

function VideoIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 6h11v12H4V6Z" />
      <path d="m15 10 5-3v10l-5-3" />
    </SvgIcon>
  );
}

function EditIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m13 7 4 4" />
    </SvgIcon>
  );
}

function HistoryIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 12a8 8 0 1 0 3-6" />
      <path d="M4 4v6h6" />
      <path d="M12 8v5l3 2" />
    </SvgIcon>
  );
}

function ChatIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 5h16v10H9l-5 4V5Z" />
      <path d="M8 9h8" />
    </SvgIcon>
  );
}

function UserIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </SvgIcon>
  );
}

function IdeaIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M12 4a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z" />
      <path d="M10 19h4" />
    </SvgIcon>
  );
}

function FeatherIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M19 5c-4 0-8 2-11 5-2 2-3 4-3 8 4 0 6-1 8-3 3-3 5-7 6-10Z" />
      <path d="M5 19l6-6" />
    </SvgIcon>
  );
}

function DumbbellIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M4 10v4M8 8v8M16 8v8M20 10v4" />
      <path d="M8 12h8" />
    </SvgIcon>
  );
}

function DollarIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M12 4v16" />
      <path d="M15.5 8.5C15.5 7 14.2 6 12 6s-3.5 1-3.5 2.5S10 11 12 11s3.5 1.3 3.5 2.5S14.2 16 12 16s-3.5-1-3.5-2.5" />
    </SvgIcon>
  );
}

function PeopleIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M16 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M4 20a4 4 0 0 1 8 0" />
      <path d="M13 20a3.5 3.5 0 0 1 7 0" />
    </SvgIcon>
  );
}

function WarningIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M12 5 3 19h18L12 5Z" />
      <path d="M12 10v4" />
      <path d="M12 16h.01" />
    </SvgIcon>
  );
}

function CheckIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M20 7 10 17l-5-5" />
    </SvgIcon>
  );
}

function FlameIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M13 3c1 4-1 5-1 7 0 2 2 3 2 5a4 4 0 1 1-8 0c0-2 1-3 2-4 1-2 0-4 1-6 1 1 2 3 4 3Z" />
    </SvgIcon>
  );
}

function ArrowLeftIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M15 18 9 12l6-6" />
    </SvgIcon>
  );
}

function ChevronRightIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="m9 6 6 6-6 6" />
    </SvgIcon>
  );
}

function SvgIcon({ children, viewBox }: { children: ReactNode; viewBox: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
