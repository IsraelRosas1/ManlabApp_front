# Backend — ManLab App

Node + TypeScript. API REST/JSON. Un módulo por carpeta en `src/`.

## Módulos
- `auth/` — email+contraseña+magic link, JWT propios.
- `entitlements/` — deriva el derecho de la subscription vigente; gating de contenido.
- `reto/` — engine del Reto (5 frentes, racha, eslabón débil, INEVITABILIDAD).
- `verdict/` — **EL MOAT**: lee la bitácora y genera el veredicto (interfaz `VerdictProvider`).
- `content/` — libros, audiolibros, videos, consejo del día, progreso.
- `webhooks/` — Stripe (firma + idempotencia + pending_entitlements).
- `admin/` — operación sin código (grant/revoke, push, precios, dunning, win-back).
- `notifications/` — OneSignal (push) + Brevo (email/dunning).

## Setup
```bash
cp .env.example .env   # rellenar; NUNCA commitear
npm install
npm run db:schema      # corre ../db/schema.sql
npm run dev
```

## No negociable
- Verificar firma del webhook de Stripe; handler idempotente.
- Key del LLM solo en el servidor. Rate limiting en `/reto/verdict`.
- Veredicto pasa guardrails (`src/verdict/verdict.guardrails.ts`) o se regenera.
- Endpoints completos: `../docs/api-contract.md`.
