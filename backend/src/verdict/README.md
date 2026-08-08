# Módulo Veredicto — EL MOAT

Lee la bitácora del Reto y devuelve un diagnóstico en la voz de Master que
conecta los frentes (circuito cerrado) y confronta sin consentir. Es la pieza
que ataca el churn del mes 2→3.

## Archivos
- `verdict.types.ts` — `Frente`, `DailyLog`, `RetoWindow`, `VerdictResult`.
- `verdict.guardrails.ts` — reglas de marca §11 + `validateVerdict()`.
- `verdict.provider.ts` — interfaz `VerdictProvider` + `ClaudeVerdictProvider` (stub).
- `verdict.service.ts` — orquesta: genera → valida → reintenta → persiste.

## Cómo conectarlo (dev)
1. `npm i @anthropic-ai/sdk` y completa el `TODO(dev)` en `verdict.provider.ts`.
2. Carga los few-shot de `docs/verdict-fewshot-examples.md` **una vez aprobados por Master**.
3. El system prompt se lee verbatim de `docs/verdict-system-prompt.txt` — **no lo reescribas**.
4. Dispara desde `POST /reto/verdict` (botón) y desde el job nocturno
   (racha rota / eslabón débil ≥3 días → push).
5. Persiste en `reto_verdicts` con `llm_provider` y `llm_cost_usd` (observabilidad).

## Reglas no negociables
- Cierra SIEMPRE con `Honos · Probitas · Perfectio`.
- Nunca "marco/frame" (→ "postura"), nunca "seducción", nunca "omnicracia".
- Temperatura baja-media, tokens cortos. Si falla guardrail, regenera.
- El `VerdictProvider` permite cambiar a GPT o a Delphi Immortal sin reescribir la app.
