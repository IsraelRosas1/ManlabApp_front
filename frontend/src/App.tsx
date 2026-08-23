import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  API_BASE_URL,
  DailyLogNotFoundError,
  type ApiStatus,
  type AppNotification,
  type RetoDailyLog,
  type RetoDailyLogPatch,
  type RetoStreak,
  type WeakLink,
  checkApiConnection,
  createRetoDailyLog,
  getCurrentIdentityMe,
  getIdentityMe,
  getLatestAppNotifications,
  getLocalDateOffset,
  getRetoDailyLog,
  getRetoLogsFromTo,
  getRetoStreak,
  getTodayLogDate,
  getWeakLinks,
  enableOneSignalNotifications,
  registerUser,
  sendBrevoTestEmail,
  updateRetoDailyLog,
} from './api';
import {
  SUBSCRIPTION_EXPIRED_MESSAGE,
  clearAuthSession,
  getIdentity,
  hasActiveSubscription,
  isAuthenticated,
  type LoginResponse,
  saveAuthSession,
  updateAuthIdentity,
} from './auth';

type ScreenKey = 'login' | 'home' | 'reto' | 'notifications' | 'clon' | 'perfil' | 'veredicto';

type BottomNavKey = Exclude<ScreenKey, 'login' | 'veredicto'>;

const protectedScreens: ScreenKey[] = ['home', 'reto', 'notifications', 'clon', 'perfil', 'veredicto'];
const SUBSCRIPTION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

type TabButtonProps = {
  current: ScreenKey;
  target: BottomNavKey;
  label: string;
  icon: ReactNode;
  onNavigate: (screen: ScreenKey) => void;
};

type ShellButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
};

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

function getInitialScreen(): ScreenKey {
  if (typeof window === 'undefined') {
    return 'login';
  }

  const hash = window.location.hash.replace('#', '') as ScreenKey;
  if (['login', 'home', 'reto', 'notifications', 'clon', 'perfil', 'veredicto'].includes(hash)) {
    if (protectedScreens.includes(hash) && !isAuthenticated()) {
      return 'login';
    }

    return hash;
  }

  return 'login';
}

function useScreen() {
  const [screen, setScreen] = useState<ScreenKey>(getInitialScreen);

  useEffect(() => {
    const syncFromHash = () => {
      const nextScreen = getInitialScreen();

      if (nextScreen === 'login' && window.location.hash !== '#login') {
        window.location.hash = '#login';
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
      reto: 'ManLab · Reto',
      notifications: 'ManLab · Avisos',
      clon: 'ManLab · Clon',
      perfil: 'ManLab · Perfil',
      veredicto: 'ManLab · Veredicto',
    };

    document.title = titles[screen];
  }, [screen]);

  const navigate = (next: ScreenKey) => {
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        await registerUser(email, password);
        setAuthMode('login');
        setPassword('');
        setSuccessMessage('Cuenta creada. Inicia sesión para entrar.');
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
        throw new Error('No se pudo iniciar sesión.');
      }

      const loginResponse = (await response.json()) as LoginResponse;
      const identity = await getIdentityMe(loginResponse);

      if (!hasActiveSubscription(identity)) {
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
            setErrorMessage('');
            setSuccessMessage('');
          }}
        >
          Registro
        </button>
      </div>

      <form className="auth-form" onSubmit={handleAuthSubmit}>
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

        <label className="field">
          <span>CONTRASEÑA</span>
          <input
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {successMessage ? <p className="auth-success">{successMessage}</p> : null}
        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

        <ShellButton type="submit" variant="primary" fullWidth>
          {isSubmitting ? (authMode === 'register' ? 'CREANDO...' : 'ENTRANDO...') : authMode === 'register' ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}
        </ShellButton>
      </form>

      <p className="auth-linkline">
        ¿Olvidaste tu contraseña? <button type="button" className="link-button">Enlace mágico</button>
      </p>

      <div className="login-separator" />

      <p className="login-note">El acceso se activa al completar tu suscripción en manlabproject.com</p>
    </section>
  );
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
          <span>{streak.currentStreak}</span>
        </button>
      </header>

      {isStreakInfoOpen ? (
        <button
          type="button"
          className="reto-info-box"
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
  const [homeNotifications, setHomeNotifications] = useState<AppNotification[]>(fallbackHomeNotifications);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const reverseRetoDay = getReverseRetoDay(1);

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

    getLatestAppNotifications(5)
      .then((notifications) => {
        if (isMounted) {
          setHomeNotifications(notifications.slice(0, 5));
        }
      })
      .catch(() => {
        if (isMounted) {
          setHomeNotifications(fallbackHomeNotifications);
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
            <p>H O N O S · P R O B I T A S ‎ · P E R F E C T I O</p>
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

      <article className="home-action-card">
        <span>CONSEJO DEL DÍA</span>
        <strong>{dailyTip.body}</strong>
        <p>{dailyTip.author}</p>
      </article>

      <div className="home-stats-grid">
        <article className="home-stat-card">
          <strong>DIA {reverseRetoDay}</strong>
          <span>Reto 100 De 100</span>
        </article>
        <article className="home-stat-card">
          <strong>{streak.currentStreak}</strong>
          <span>Racha actual</span>
        </article>
      </div>

      <section className="home-section">
        <h3>ACCESO RÁPIDO</h3>
        <div className="home-quick-grid">
          <QuickAccessButton label="Reto" icon={<ClipboardIcon />} onClick={() => onNavigate('reto')} />
          <QuickAccessButton label="Avisos" icon={<BellIcon />} onClick={() => onNavigate('notifications')} />
          <QuickAccessButton label="Clon" icon={<ChatIcon />} onClick={() => onNavigate('clon')} />
          <QuickAccessButton label="Contenido" icon={<BookIcon />} onClick={() => onNavigate('home')} />
        </div>
      </section>

      <section className="home-section">
        <h3>ÚLTIMAS NOTIFICACIONES</h3>
        <div className="home-alerts">
          {homeNotifications.slice(0, 5).map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      </section>

      <BottomNav current="home" onNavigate={onNavigate} />
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

function getNotificationIcon(notification: AppNotification) {
  const icon = notification.icon?.toLowerCase();
  const type = notification.type?.toLowerCase() || '';
  const title = notification.title?.toLowerCase() || '';

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

function getNotificationMeta(notification: AppNotification) {
  const dateValue = notification.sentAt || notification.createdAt;
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

function NotificationRow({ notification }: { notification: AppNotification }) {
  const [didImageFail, setDidImageFail] = useState(false);
  const shouldShowImage = Boolean(notification.imageUrl && !didImageFail);

  const handleClick = () => {
    if (notification.url) {
      window.open(notification.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <article
      className={`home-alert-row ${notification.url ? 'home-alert-row--clickable' : ''}`}
      onClick={handleClick}
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
        {notification.message ? <span className="home-alert-row__message">{notification.message}</span> : null}
        <p>{getNotificationMeta(notification)}</p>
      </div>
      <ArrowLeftIcon />
    </article>
  );
}

function NotificationsScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  return (
    <section className="screen screen--stacked screen--tight-bottom">
      <header className="screen-header">
        <h2>AVISOS</h2>
        <p>Notificaciones</p>
      </header>

      <div className="locked-stack">
        <div className="locked-row">
          <span>Hoy</span>
          <strong>Completa tu bitácora diaria</strong>
        </div>
        <div className="locked-row">
          <span>Reto</span>
          <strong>Revisa tu eslabón débil</strong>
        </div>
      </div>

      <div className="screen-spacer" />

      <BottomNav current="notifications" onNavigate={onNavigate} />
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

function PerfilScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [streak, setStreak] = useState<RetoStreak>({ currentStreak: 0, longestStreak: 0 });
  const [emailTestStatus, setEmailTestStatus] = useState('');
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    onNavigate('login');
  };

  const handleSendEmailTest = async () => {
    setEmailTestStatus('');
    setIsSendingEmailTest(true);

    try {
      await sendBrevoTestEmail();
      setEmailTestStatus('Email de prueba enviado.');
    } catch (error) {
      setEmailTestStatus(error instanceof Error ? error.message : 'No se pudo enviar el email de prueba.');
    } finally {
      setIsSendingEmailTest(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    checkApiConnection().then((status) => {
      if (isMounted) {
        setApiStatus(status);
      }
    });

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

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="screen screen--stacked screen--tight-bottom">
      <header className="profile-hero">
        <div className="profile-hero__avatar">MH</div>
        <div>
          <h2>PERFIL</h2>
          <p>Hombre en obra · T2</p>
        </div>
      </header>

      <div className="profile-card profile-card--accent">
        <span className="profile-card__eyebrow">Estado actual</span>
        <strong>Acceso activo</strong>
        <p>La suscripción desbloquea el Reto, el consejo, el Clon y el resto del muro.</p>
      </div>

      <div className="api-status">
        <span className={`api-status__dot api-status__dot--${apiStatus}`} />
        <div>
          <strong>{getApiStatusLabel(apiStatus)}</strong>
          <p>{API_BASE_URL || 'VITE_API_BASE_URL no está configurado'}</p>
        </div>
      </div>

      <div className="profile-grid">
        <article className="profile-card">
          <span className="profile-card__eyebrow">Racha</span>
          <strong>{streak.currentStreak} días</strong>
          <p>Máxima: {streak.longestStreak}</p>
        </article>
        <article className="profile-card">
          <span className="profile-card__eyebrow">Rango</span>
          <strong>T2</strong>
          <p>Hombre en obra</p>
        </article>
      </div>

      <div className="locked-stack">
        <div className="locked-row">
          <span>Fase 2</span>
          <strong>Lector EPUB</strong>
        </div>
        <div className="locked-row">
          <span>Fase 2</span>
          <strong>Audiolibros</strong>
        </div>
        <div className="locked-row">
          <span>Fase 3</span>
          <strong>Videoteca · Hermandad</strong>
        </div>
      </div>

      <div className="profile-card">
        <span className="profile-card__eyebrow">Brevo</span>
        <strong>Email de prueba</strong>
        <p>{emailTestStatus || 'Enviar prueba a israelrosassalinas@hotmail.com'}</p>
        <ShellButton variant="secondary" fullWidth onClick={handleSendEmailTest}>
          {isSendingEmailTest ? 'ENVIANDO...' : 'ENVIAR TEST'}
        </ShellButton>
      </div>

      <ShellButton variant="secondary" fullWidth onClick={handleLogout}>
        CERRAR SESIÓN
      </ShellButton>

      <BottomNav current="perfil" onNavigate={onNavigate} />
    </section>
  );
}

function getApiStatusLabel(status: ApiStatus) {
  const labels: Record<ApiStatus, string> = {
    checking: 'Revisando API local',
    connected: 'API local conectada',
    unreachable: 'API local sin respuesta',
    'not-configured': 'API sin configurar',
  };

  return labels[status];
}

function BottomNav({ current, onNavigate }: { current: ScreenKey; onNavigate: (screen: ScreenKey) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {tabs.map((tab) => (
        <TabButton
          key={tab.key}
          current={current}
          target={tab.key}
          label={tab.label}
          icon={tab.icon}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function TabButton({ current, target, label, icon, onNavigate }: TabButtonProps) {
  const active = current === target;

  return (
    <button
      type="button"
      className={`bottom-nav__item ${active ? 'is-active' : ''}`}
      onClick={() => onNavigate(target)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="bottom-nav__icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ShellButton({ children, variant = 'secondary', fullWidth, type = 'button', onClick }: ShellButtonProps) {
  return (
    <button
      type={type}
      className={`shell-button shell-button--${variant} ${fullWidth ? 'shell-button--full' : ''}`}
      onClick={onClick}
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

function SvgIcon({ children, viewBox }: { children: ReactNode; viewBox: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
