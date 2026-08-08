# Contrato de API — ManLab App (handoff dev)

REST/JSON. Auth por JWT propio (Bearer). Sin SSO de Delphi (no existe en Scaler).
Roles: `user` y `admin`. Endpoints `admin/*` exigen `role=admin`.
Todo gating de contenido se valida en el backend: contenido protegido solo si
`entitlement_status = active`.

> Convención de respuestas de error: `{ "error": { "code": string, "message": string } }`.
> `401` sin/mal token · `402` sin suscripción activa · `403` sin rol · `404` no existe · `409` conflicto.

---

## Auth

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password?, country?, displayName? }` | `{ user, token }` — al crear, resuelve `pending_entitlements` que coincidan por email |
| POST | `/auth/login` | — | `{ email, password }` | `{ user, token }` |
| POST | `/auth/magic-link/request` | — | `{ email }` | `204` (envía link vía Brevo) |
| POST | `/auth/magic-link/verify` | — | `{ token }` | `{ user, token }` |
| POST | `/auth/password/reset-request` | — | `{ email }` | `204` |
| POST | `/auth/password/reset` | — | `{ token, password }` | `204` |

## Yo / derechos

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/me` | user | `{ id, email, displayName, country, role, rank }` |
| GET | `/me/entitlement` | user | `Entitlement` (status, source, planCode, priceLocked, currentPeriodEnd) |
| POST | `/me/push/subscribe` | user | `{ playerId }` → guarda `onesignal_player_id` |

## Reto 100 de 100

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/reto/enroll` | user (active) | `{ startDate }` | `{ enrollment }` (edition HIERRO) |
| GET | `/reto/today` | user (active) | — | `{ log, dayIndex, racha, eslabonDebil, doctrina:{ inevitabilidad, realObjetivo } }` |
| PUT | `/reto/logs/:date` | user (active) | `{ intelectual, espiritual, fisico, economico, social_atraccion, note? }` | `{ log, isComplete, racha }` — upsert (UNIQUE enrollment+date) |
| GET | `/reto/state` | user (active) | — | `RetoState` (racha, rachaMaxima, dayIndex, eslabonDebil, ventana) |
| POST | `/reto/verdict` | user (active) | — | `VerdictResult` — genera bajo demanda (botón "Pedir veredicto al Clon") |
| GET | `/reto/verdicts` | user (active) | — | `VerdictResult[]` (historial) |

**Reglas de negocio del Reto** (backend): calificación 100%-o-nada; `racha` se rompe a 0 con el primer día no completo; eslabón débil = frente con menor % en ventana móvil (7 días, configurable); doctrina INEVITABILIDAD se devuelve como texto exacto. Veredicto automático (push) cuando se rompe racha o un eslabón débil persiste ≥3 días.

## Contenido

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/content/daily-tip` | user (active) | `{ body }` (consejo del día) |
| GET | `/content/books` | user (active) | `Book[]` |
| GET | `/content/books/:id/file` | user (active) | EPUB vía signed URL / stream protegido |
| GET | `/content/audiobooks` | user (active) | `Audiobook[]` (con `chapters`) |
| GET | `/content/audiobooks/:id/file` | user (active) | signed URL de audio |
| GET | `/content/videos` | user (active) | `Video[]` (`?category=`) |
| GET | `/content/videos/:id/play` | user (active) | token/URL firmada de reproducción (Bunny/Mux) |
| PUT | `/content/progress` | user (active) | `{ contentType, contentId, position }` → upsert |

## Clon conversacional (Delphi embed)

No hay endpoint propio: el cliente renderiza el iframe `DELPHI_EMBED_URL` **solo si** `entitlement=active`. El backend expone un check ligero:

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/clon/access` | user | `{ allowed: boolean, embedUrl }` |

## Hermandad / rangos (Fase 3)

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/me/rank` | user | `{ name, minStreak }` |
| GET | `/hermandad/pair` | user (active) | `{ pair, partnerRacha }` |
| POST | `/hermandad/pair/nudge` | user (active) | `204` (empujón al compañero) |

## Webhook Stripe

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/webhooks/stripe` | firma | **Verificar `Stripe-Signature` en cada evento. Idempotente** (Stripe reintenta). Eventos: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. Mapea email→user; si no existe user, crea `pending_entitlements`. |

## Job nocturno (cron)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/cron/nightly` | `CRON_SECRET` | Corte de acceso al cierre del día para `past_due`/`canceled` vencidos (`entitlement → none`). Avisos 7 y 3 días antes en vencimientos conocidos (anual, Wise/USDT). Dispara veredicto automático por racha rota / eslabón persistente. |

## Admin (role=admin)

| Método | Ruta | Body | Notas |
|---|---|---|---|
| POST | `/admin/entitlement/grant` | `{ email, expiresAt, planCode? }` | pagos Wise/USDT; `source=manual` |
| POST | `/admin/entitlement/revoke` | `{ email }` | |
| POST | `/admin/entitlement/relink` | `{ stripeCustomerId, targetEmail }` | caso "pagó con email distinto" |
| POST | `/admin/push` | `{ segment, title, body }` | OneSignal manual |
| POST | `/admin/notify/live` | `{ text, link, platform }` | aviso de LIVE (botón manual) |
| POST | `/admin/notify/new-video` | `{ platform, link, text }` | TikTok/IG manual (YouTube es automático) |
| GET/PUT | `/admin/daily-tips` | `{ body, active, shownOn? }` | editar consejo del día |
| CRUD | `/admin/books` · `/admin/audiobooks` · `/admin/videos` · `/admin/ranks` | — | cargar/editar contenido |
| GET/PUT | `/admin/prices` | `{ planCode, amountUsd, stripePriceId, highlighted }` | sin redeploy |
| GET | `/admin/winback/expired` | — | exportar lista de 1,979 expirados (CSV) |
| POST | `/admin/winback/campaign` | `{ listId, templateId }` | disparar campaña (Brevo) |
| GET | `/admin/dunning` | — | pagos fallidos + estado de recobro (los 92) |
