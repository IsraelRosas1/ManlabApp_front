# ManLab App

PWA instalable de retención para el ecosistema ManLab. Una sola suscripción
(modelo Netflix) desbloquea Reto 100 de 100, Veredicto del Clon (el MOAT),
Clon conversacional, libros, audiolibros y videoteca.

> **Objetivo del producto:** retener, no adquirir. Ataca el churn del Clon
> (vida promedio 2.66 meses, caída mes 2→3). El diferenciador es el **Veredicto**:
> el sistema lee la bitácora del Reto y devuelve un diagnóstico en la voz de Master.

**Confidencial.** No reproducir fuera del equipo de desarrollo. Ver `CONFIDENTIAL.md`.

---

## Estructura del repo

```
manlab-app/
├── docs/        Documento maestro (spec MD + PDF), contrato de API, migración,
│                checklist de aceptación, system prompt y few-shot del Veredicto.
├── db/          schema.sql ejecutable (Postgres) + seeds.
├── backend/     API REST/JSON (Node + TypeScript). Módulos por carpeta.
│   └── src/verdict/  ← EL MOAT (interfaz VerdictProvider lista).
├── frontend/    PWA (React + Vite + TS). Manifest, íconos, tokens de marca, fuentes.
└── brand/       Kits de logo (lockup + dragón) + brand-tokens.json.
```

**Empieza por `docs/00_README_HANDOFF.md`** (orden de lectura) y luego `docs/SPEC_BUILD_MANLAB.md` (o el PDF).

---

## Arranque rápido

**Requisitos:** Node 20+, PostgreSQL 15+ (Supabase o Neon sirve), cuenta Stripe,
key de LLM (Anthropic), proyecto OneSignal, cuenta Brevo, Bunny/Mux (Fase 3).

```bash
# 1. Base de datos
psql "$DATABASE_URL" -f db/schema.sql

# 2. Backend
cd backend
cp .env.example .env        # rellenar secrets (NUNCA commitear .env)
npm install
npm run dev

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

---

## Decisiones cerradas (no reabrir sin Dirección)

- **Cobro fuera de la app** (Stripe en `manlabproject.com`). La app solo verifica el derecho.
- **Clon DESACOPLADO:** Delphi embed (iframe) para conversación + LLM propio para el Veredicto. No se sube a Immortal.
- **Reto:** 100 días, 5 frentes, 100%-o-nada, sin periodo de gracia.
- **Precios:** mensual $39 · anual $349 (destacado) · fundador $29 congelado (win-back + migración). Todo USD.
- **Reglas de marca §11:** obligatorias en TODO copy. Violarlas es un bug (ver `docs/SPEC` §11 y `brand/`).

---

## Fases

1. **Retención** — Auth + entitlement Stripe + Reto con bitácora + Veredicto + Clon embed + consejo + notificaciones + admin + dunning.
2. **Lectura** — Lector EPUB + audiolibros (progreso persistente, offline).
3. **Comunidad/catálogo** — Videoteca + hermandad + rangos + win-back de 1,979 expirados.

Criterios de aceptación por fase (definen el pago): `docs/acceptance-checklist.md`.

---

Honos · Probitas · Perfectio
# ManlabApp_front
