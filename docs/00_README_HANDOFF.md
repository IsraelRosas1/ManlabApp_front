# ManLab App — Paquete de handoff para desarrollador

**Versión 2.0 · Confidencial · No reproducir fuera del equipo de desarrollo.**
De: Dirección ManLab (Izahí Santana — "Master Santana").
Para: desarrollador profesional contratado.

Este paquete está hecho para que construyas la app **completa** sin reuniones de
aclaración previas. El documento maestro dice *qué* construir y *por qué*; los
demás archivos son artefactos que arrastras directo al repo.

---

## Orden de lectura

1. **`SPEC_BUILD_MANLAB.md`** (o el PDF equivalente) — el documento maestro. Léelo primero, completo.
2. **`schema.sql`** — el esquema Postgres ejecutable. Córrelo contra una base limpia.
3. **`api-contract.md`** — inventario de endpoints (método, auth, request/response).
4. **`.env.example`** — todas las variables y secrets. Copia a `.env`.
5. **`interfaces.ts`** — tipos núcleo + el contrato `VerdictProvider` + guardrails del Veredicto.
6. **`verdict-system-prompt.txt`** — el system prompt del Veredicto, verbatim. **No lo reescribas.**
7. **`verdict-fewshot-examples.md`** — ejemplos few-shot (PENDIENTE de aprobación de Master).
8. **`migration-spec.md`** — importador de datos + caso de borde de email.
9. **`acceptance-checklist.md`** — criterios de aceptación testeables por fase (define el pago).

---

## Lo que NO está en este paquete (te lo entrega Dirección por separado)

Son archivos pesados / credenciales. No bloquean el inicio del desarrollo de Fase 1.

- **Logos / Brand Kit** — ✅ ya disponible (dos kits, PNG 512/2000 + SVG, variantes).
- Tipografías licenciadas (Bebas Neue, Inter, Cormorant Garamond) o confirmación de webfont.
- Libros cerrados (fuente para conversión a EPUB) — ES e EN. *(Fase 2)*
- Audiolibros finales (4): M4B/MP3 + marcadores de capítulo. *(Fase 2)*
- Videos UDH (~400): acceso de descarga/migración. *(Fase 3 — ver `migration-spec.md`)*
- Banco de "Consejos del día" (o se cargan luego desde el panel).
- Ejemplos de veredicto aprobados por Master (afinan el few-shot — borrador incluido).
- Textos legales: términos, privacidad, reembolsos.
- Credenciales: Stripe, Delphi (Scaler), key del LLM, dominio `app.manlabproject.com`.

---

## Lo no negociable (resumen — el detalle está en el spec)

- **Modelo Netflix:** el cobro entra por la web vía Stripe; la app **nunca** procesa pagos (cero comisión de tienda). La app solo verifica el derecho y desbloquea.
- **El MOAT es el Veredicto:** el sistema lee la bitácora del Reto y devuelve un diagnóstico en la voz de Master (circuito cerrado). Es lo que ataca el churn del mes 2→3.
- **Arquitectura del Clon DESACOPLADA:** Delphi embed (iframe, Scaler) para conversación abierta + API de LLM propia para el Veredicto. No se sube a Immortal. El Veredicto va detrás de `VerdictProvider` para poder cambiar de proveedor sin reescribir.
- **Sistema Verbal §11:** reglas de marca de cumplimiento obligatorio en TODO copy. Violarlas es un bug.
- **Reto = 100 días, 5 frentes, 100%-o-nada.** Sin crédito parcial, sin periodo de gracia.

---

## Fases y pago

| Fase | Alcance | Pago se libera cuando… |
|---|---|---|
| **1 — Retención** | PWA + Auth + entitlement Stripe + Reto con bitácora + Veredicto + Clon embed + consejo del día + notificaciones + admin mínimo + dunning | todas las cajas de Fase 1 en `acceptance-checklist.md` marcadas y validadas |
| **2 — Lectura** | Lector EPUB + reproductor de audiolibros (progreso persistente, offline) | cajas de Fase 2 marcadas |
| **3 — Comunidad/catálogo** | Videoteca + hermandad/accountability + rangos + win-back de 1,979 expirados | cajas de Fase 3 marcadas |

El proyecto se considera **terminado** cuando se cumplen las tres fases, todo copy pasa §11,
el flujo cobro→app corre sin intervención manual, el panel admin lo opera un no-desarrollador,
y existe handoff documentado (README de repo, env, despliegue) para mantenimiento por un solo dev.

---

Honos · Probitas · Perfectio
