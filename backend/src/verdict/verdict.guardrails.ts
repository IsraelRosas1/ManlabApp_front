// Guardrails de marca del Veredicto. Si la salida del LLM falla cualquiera,
// el servicio debe regenerar. Las reglas de marca NO son negociables (§11).

export const VERDICT_GUARDRAILS = {
  // Debe cerrar con la línea doctrinal exacta:
  mustEndWith: 'Honos · Probitas · Perfectio',
  // Si aparece cualquiera de estos términos, rechazar y regenerar:
  forbiddenTerms: ['marco', 'frame', 'seducción', 'seducir', 'seduccion', 'omnicracia'],
  // Vocabulario permitido para el frente social:
  allowedSocialTerms: ['atracción', 'magnetismo', 'presencia', 'postura'],
  minLines: 4,
  maxLines: 8,
} as const;

export function validateVerdict(text: string): { ok: boolean; reason?: string } {
  const lower = text.toLowerCase();
  for (const term of VERDICT_GUARDRAILS.forbiddenTerms) {
    if (lower.includes(term)) return { ok: false, reason: `término prohibido: "${term}"` };
  }
  if (!text.trim().endsWith(VERDICT_GUARDRAILS.mustEndWith)) {
    return { ok: false, reason: 'no cierra con la línea doctrinal' };
  }
  const lines = text.trim().split('\n').filter((l) => l.trim()).length;
  if (lines < VERDICT_GUARDRAILS.minLines || lines > VERDICT_GUARDRAILS.maxLines + 1) {
    // +1 tolera la línea doctrinal en renglón aparte
    return { ok: false, reason: `longitud fuera de rango (${lines} líneas)` };
  }
  return { ok: true };
}
