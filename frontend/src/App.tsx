import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  API_BASE_URL,
  DailyLogNotFoundError,
  type ApiStatus,
  type RetoDailyLog,
  type RetoDailyLogPatch,
  type RetoStreak,
  type WeakLink,
  checkApiConnection,
  createRetoDailyLog,
  getIdentityMe,
  getRetoDailyLog,
  getRetoStreak,
  getTodayLogDate,
  getWeakLinks,
  updateRetoDailyLog,
} from './api';
import { clearAuthSession, getIdentity, isAuthenticated, type LoginResponse, saveAuthSession } from './auth';

type ScreenKey = 'login' | 'reto' | 'consejo' | 'clon' | 'perfil' | 'veredicto';

type BottomNavKey = Exclude<ScreenKey, 'login' | 'veredicto'>;

const protectedScreens: ScreenKey[] = ['reto', 'consejo', 'clon', 'perfil', 'veredicto'];

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
    key: 'reto',
    label: 'Reto',
    icon: <ClipboardIcon />, 
  },
  {
    key: 'consejo',
    label: 'Consejo',
    icon: <BulbIcon />,
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
  author: 'MASTER',
};

const verdictText =
  'Tres días sin pisar el gimnasio, y el resto del circuito ya lo siente. Tu economía se sostuvo, tu palabra con Dios se sostuvo — pero el cuerpo es la base, y una base que cede arrastra todo lo que construiste encima. No es cansancio. Es una decisión que estás tomando cada mañana que te quedas en la cama.';

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
  if (['login', 'reto', 'consejo', 'clon', 'perfil', 'veredicto'].includes(hash)) {
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
      reto: 'ManLab · Reto',
      consejo: 'ManLab · Consejo',
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

  return (
    <div className="app-shell">
      <div className={`phone-frame phone-frame--${screen}`}>
        {screen === 'login' ? (
          <LoginScreen onEnter={() => navigate('reto')} onNavigate={navigate} />
        ) : screen === 'reto' ? (
          <RetoScreen onNavigate={navigate} />
        ) : screen === 'consejo' ? (
          <ConsejoScreen onNavigate={navigate} />
        ) : screen === 'clon' ? (
          <ClonScreen onNavigate={navigate} />
        ) : screen === 'perfil' ? (
          <PerfilScreen onNavigate={navigate} />
        ) : (
          <VeredictoScreen onBack={() => navigate('reto')} />
        )}
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
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

      saveAuthSession(loginResponse, identity);
      onEnter();
    } catch {
      setErrorMessage('Correo o contraseña inválidos.');
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

      <form className="auth-form" onSubmit={handleLogin}>
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

        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

        <ShellButton type="submit" variant="primary" fullWidth>
          {isSubmitting ? 'ENTRANDO...' : 'INICIAR SESIÓN'}
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
  const [weakLinks, setWeakLinks] = useState<WeakLink[]>([]);
  const [streak, setStreak] = useState<RetoStreak>({ currentStreak: 0, longestStreak: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [isSavingLog, setIsSavingLog] = useState(false);

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
      setStatusMessage('Bitácora guardada.');
    } catch {
      setStatusMessage('No se pudo guardar la bitácora.');
    } finally {
      setIsSavingLog(false);
    }
  };

  const primaryWeakLink = weakLinks[0];
  const reverseRetoDay = getReverseRetoDay(dailyLog.dayIndex);

  return (
    <section className="screen screen--stacked">
      <header className="screen-header screen-header--with-metric">
        <div>
          <h2>DIA {reverseRetoDay}/100</h2>
          <p>{dailyLog.logDate}</p>
        </div>

        <div className="metric">
          <FlameIcon />
          <span>{streak.currentStreak}</span>
        </div>
      </header>

      <div className="alert-pill">
        <WarningIcon />
        <span>
          {primaryWeakLink
            ? `Eslabón débil: ${primaryWeakLink.discipline} — ${primaryWeakLink.failedDays} días cayendo`
            : 'Eslabón débil: sin fallas registradas'}
        </span>
      </div>

      <p className="section-kicker">LOS CINCO FRENTES</p>

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

      <label className="note-field">
        <span className="sr-only">Bitácora de hoy</span>
        <textarea
          placeholder="Bitácora de hoy..."
          rows={5}
          value={dailyLog.bitacora ?? ''}
          onChange={updateNote}
          disabled={isLoadingLog}
        />
      </label>

      {statusMessage ? <p className="reto-status">{statusMessage}</p> : null}

      <blockquote className="doctrine-quote">
        “Si trabajas diario es inevitable tener resultados; si no, es inevitable fracasar.”
      </blockquote>

      <ShellButton variant="secondary" fullWidth onClick={saveDailyLog}>
        {isSavingLog ? 'GUARDANDO...' : 'GUARDAR BITÁCORA'}
      </ShellButton>

      <ShellButton variant="primary" fullWidth onClick={() => onNavigate('veredicto')}>
        PEDIR VEREDICTO AL CLON
      </ShellButton>

      <BottomNav current="reto" onNavigate={onNavigate} />
    </section>
  );
}

function ConsejoScreen({ onNavigate }: { onNavigate: (screen: ScreenKey) => void }) {
  return (
    <section className="screen screen--stacked screen--tight-bottom">
      <header className="screen-header">
        <h2>CONSEJO DEL DÍA</h2>
        <p>{dailyTip.dayLabel}</p>
      </header>

      <article className="tip-card">
        <div className="tip-card__number">{dailyTip.cardNumber}</div>
        <p className="tip-card__body">{dailyTip.body}</p>
        <div className="tip-card__author">— {dailyTip.author}</div>
      </article>

      <div className="screen-spacer" />

      <BottomNav current="consejo" onNavigate={onNavigate} />
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

  const handleLogout = () => {
    clearAuthSession();
    onNavigate('login');
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

function BulbIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8 10a4 4 0 1 1 8 0c0 1.7-.8 3-2 4-.6.5-1 1.1-1 2h-2c0-.9-.4-1.5-1-2-1.2-1-2-2.3-2-4Z" />
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
