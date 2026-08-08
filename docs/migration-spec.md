# Especificación de migración — ManLab App (handoff dev)

Tres poblaciones a migrar. Dos son **derechos** (entitlements) y una es **contenido** (videos UDH).
El importador debe ser idempotente (correr dos veces no duplica).

> ⚠️ **Dato a confirmar por Dirección antes de programar:** en qué plataforma
> viven hoy la membresía **UDH** y los **~400 videos** (Hotmart/Kajabi/custom/etc.),
> y si esa plataforma **permite exportar** los videos hacia Bunny/Mux. De eso
> depende si la videoteca (Fase 3) se migra o se re-sube manualmente.

---

## 1. Base actual del Clon → `plan_fundador`

Los suscriptores del Clon **ya están en Stripe** (el Clon es el 44.3% del revenue de Stripe).
Migración = identificarlos y moverlos al precio **fundador $29 congelado** para no churnarlos
en la transición.

- Estrategia recomendada: en Stripe, mover/etiquetar esas suscripciones al `price` fundador
  (o crear la nueva sub fundador y cancelar la del Clon al final del periodo).
- En la app: al llegar el webhook, `plan_code='fundador'`, `price_locked=true`.
- No requiere CSV si se hace desde Stripe; sí requiere la **lista de customer IDs** del Clon.

## 2. Expirados de UDH (1,979) → win-back con `plan_fundador`

Estos NO están activos en Stripe. Se importan como lista para campaña de win-back (Brevo) +
se les entrega `plan_fundador` por link/código privado cuando aceptan.

**CSV esperado** (`expirados_udh.csv`):

```csv
email,display_name,country,expired_on,source_platform
juan@ejemplo.com,Juan Pérez,MX,2025-11-02,udh
```

- Se cargan a `pending_entitlements` NO (solo cuando paguen) — para win-back se cargan a la
  **lista de Brevo** (`BREVO_LIST_WINBACK_ID`) vía `POST /admin/winback/campaign`.
- Cuando uno acepta y paga el fundador → flujo normal de Stripe → entitlement active.

## 3. Otorgamientos manuales históricos (Wise/USDT), si existen

**CSV esperado** (`manual_grants.csv`):

```csv
email,display_name,country,expires_at
pedro@ejemplo.com,Pedro Gómez,CO,2026-09-01
```

- Importador llama internamente la misma lógica que `POST /admin/entitlement/grant`
  (`source=manual`). Recordatorio de expiración automático 7 y 3 días antes (Brevo).

---

## Caso de borde crítico: "pagó con un email y se registró con otro"

Pasa seguido y, sin manejarlo, esos hombres quedan fuera y generan soporte.

1. Webhook de Stripe llega con `email = el de la tarjeta`.
2. Si **existe** user con ese email → se le adjunta la subscription. Listo.
3. Si **no existe** → se guarda en `pending_entitlements` (no se pierde el pago).
4. Cuando el hombre se registra/verifica un email que coincide → se materializa
   la subscription automáticamente (`/auth/register` resuelve pendientes por email).
5. Si se registró con un email DISTINTO al de pago → Admin usa
   `POST /admin/entitlement/relink { stripeCustomerId, targetEmail }`.

---

## Videoteca UDH (~400 videos) — Fase 3

Depende del dato a confirmar (arriba). Dos rutas:

- **Si la plataforma actual permite descarga/export:** migrar a Bunny/Mux, guardar
  `bunny_video_id` + `category` (módulo) en la tabla `videos`.
- **Si no:** re-subir desde los archivos maestros que tenga Dirección. Mismo destino.

En ambos casos: signed URLs, nunca exponer URLs directas (no hotlinkeables fuera de la app).
