"use strict";
// Guardrails de marca del Veredicto. Si la salida del LLM falla cualquiera,
// el servicio debe regenerar. Las reglas de marca NO son negociables (§11).
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERDICT_GUARDRAILS = void 0;
exports.validateVerdict = validateVerdict;
exports.VERDICT_GUARDRAILS = {
    // Debe cerrar con la línea doctrinal exacta:
    mustEndWith: 'Honos · Probitas · Perfectio',
    // Si aparece cualquiera de estos términos, rechazar y regenerar:
    forbiddenTerms: ['marco', 'frame', 'seducción', 'seducir', 'seduccion', 'omnicracia'],
    // Vocabulario permitido para el frente social:
    allowedSocialTerms: ['atracción', 'magnetismo', 'presencia', 'postura'],
    minLines: 4,
    maxLines: 8,
};
function validateVerdict(text) {
    const lower = text.toLowerCase();
    for (const term of exports.VERDICT_GUARDRAILS.forbiddenTerms) {
        if (lower.includes(term))
            return { ok: false, reason: `término prohibido: "${term}"` };
    }
    if (!text.trim().endsWith(exports.VERDICT_GUARDRAILS.mustEndWith)) {
        return { ok: false, reason: 'no cierra con la línea doctrinal' };
    }
    const lines = text.trim().split('\n').filter((l) => l.trim()).length;
    if (lines < exports.VERDICT_GUARDRAILS.minLines || lines > exports.VERDICT_GUARDRAILS.maxLines + 1) {
        // +1 tolera la línea doctrinal en renglón aparte
        return { ok: false, reason: `longitud fuera de rango (${lines} líneas)` };
    }
    return { ok: true };
}
