# Checklist de aceptación — ManLab App (handoff dev)

Cada caja es **verificable** (se demuestra o no se demuestra). El pago de cada fase
se libera cuando TODAS las cajas de esa fase están marcadas y validadas por Dirección.
La caja transversal de **§11 (Sistema Verbal)** aplica a las tres fases: violar una
regla de marca es un bug, no un detalle.

---

## Transversal — Reglas de marca §11 (aplica a todas las fases)

- [ ] Ningún copy in-app usa "marco" ni "frame" (siempre "postura").
- [ ] Ningún copy in-app usa "seducción"/"seducir" (frente 5 = "Social / Atracción").
- [ ] "Omnicracia" no aparece en ningún lugar de la app.
- [ ] "Sé ese tipo de hombre" (T1) solo aparece como cierre doctrinal, nunca como apertura/título.
- [ ] "Universidad del Hombre" siempre por su nombre, nunca "OnlyFans".
- [ ] Frases firmadas se usan tal cual, sin atribuir a otros.
- [ ] El Veredicto pasa el filtro de guardrails (`validateVerdict`) en el 100% de las salidas.

---

## Fase 1 — Corazón de retención

**Auth + entitlement**
- [ ] Un usuario nuevo que paga en la web recibe acceso y desbloquea la app **sin intervención manual**.
- [ ] Un usuario sin suscripción activa **NO** ve contenido protegido (responde 402).
- [ ] El webhook de Stripe verifica firma y es idempotente (reintentos no duplican).
- [ ] Caso "email distinto": el pago no se pierde (queda en `pending_entitlements`) y se resuelve al registrarse o vía relink admin.
- [ ] Login por email+contraseña y por magic link funcionan; reset de contraseña funciona.

**Reto con bitácora**
- [ ] La bitácora calcula `racha` y `eslabón débil` correctamente.
- [ ] Un día cuenta como "completo" **solo con 5/5**; la UI comunica "4 de 5 = día caído" sin suavizar.
- [ ] El visual del eslabón débil delata el frente más bajo de la ventana (circuito cerrado).
- [ ] La doctrina INEVITABILIDAD aparece con su texto exacto.

**Veredicto (MOAT)**
- [ ] El botón "Pedir veredicto al Clon" devuelve un veredicto en voz de Master que cita días/frentes reales.
- [ ] El veredicto cumple §11 y cierra con `Honos · Probitas · Perfectio`.
- [ ] El veredicto automático se dispara por racha rota o eslabón débil persistente (≥3 días).
- [ ] Se registra costo por llamada del LLM (observabilidad).
- [ ] El Veredicto está detrás de la interfaz `VerdictProvider` (swap de proveedor sin reescritura).

**Clon conversacional**
- [ ] El iframe de Delphi se renderiza **solo** si `entitlement=active`.

**Consejo del día + notificaciones**
- [ ] El consejo del día se muestra y es editable desde admin.
- [ ] Push de recordatorio diario llega en Android y desktop (iOS documentado con caveat).
- [ ] Video nuevo en YouTube dispara push automático.

**Dunning + admin mínimo**
- [ ] Dunning configurado: los 92 pagos fallidos dejan de perderse (secuencia de recobro activa).
- [ ] Panel admin opera: grant/revoke manual, push manual, aviso de LIVE, editar consejo, ver dunning, configurar precios.

**PWA**
- [ ] Instalable: manifest válido + service worker; pasa auditoría Lighthouse PWA.

---

## Fase 2 — Lectura

- [ ] Abrir un libro (EPUB), cerrar la app, reabrir y **continuar donde se quedó**.
- [ ] Abrir un audiolibro, cerrar la app, reabrir y **continuar donde se quedó**.
- [ ] Reproductor de audio: marcadores de capítulo, control de velocidad, fondo/bloqueo de pantalla.
- [ ] Lectura disponible offline (cache vía service worker).

---

## Fase 3 — Comunidad y catálogo

- [ ] La videoteca (~400) sirve con signed URLs; los videos **no se pueden hotlinkear** fuera de la app.
- [ ] Progreso por video persistente.
- [ ] Un par de accountability ve la racha del otro y puede enviar un empujón.
- [ ] Rangos por racha visibles en el perfil (estatus "Hombre en obra", sin gamificación blanda).
- [ ] Un expirado de UDH recibe la campaña de win-back y puede activar el plan fundador.

---

## "Terminado" global

- [ ] Las tres fases cumplen sus criterios.
- [ ] Todo copy in-app pasa la revisión §11.
- [ ] El flujo cobro web→app funciona de punta a punta sin intervención manual para Stripe.
- [ ] Panel admin operable por no-desarrolladores.
- [ ] Handoff documentado: README, variables de entorno, cómo desplegar (mantenible por un solo dev).
