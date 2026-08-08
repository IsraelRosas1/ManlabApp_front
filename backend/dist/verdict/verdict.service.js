"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerdictService = void 0;
const verdict_guardrails_1 = require("./verdict.guardrails");
/**
 * Orquesta la generación del Veredicto:
 *  1. Llama al provider (LLM detrás de la interfaz).
 *  2. Valida contra los guardrails de marca (§11).
 *  3. Si falla, reintenta (hasta maxRetries).
 *  4. Persiste en reto_verdicts (con costo por llamada — observabilidad).
 *
 * El que llama (controller de /reto/verdict y el job nocturno) no sabe
 * qué proveedor está detrás.
 */
class VerdictService {
    provider;
    saveVerdict;
    maxRetries;
    constructor(provider, saveVerdict, maxRetries = 2) {
        this.provider = provider;
        this.saveVerdict = saveVerdict;
        this.maxRetries = maxRetries;
    }
    async generateForEnrollment(enrollmentId, input) {
        let last = null;
        let reason;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            last = await this.provider.generate(input);
            const check = (0, verdict_guardrails_1.validateVerdict)(last.verdictText);
            if (check.ok) {
                await this.saveVerdict(enrollmentId, last, {
                    generatedForDay: input.diaActual,
                    trigger: input.trigger,
                    attempts: attempt + 1,
                });
                return last;
            }
            reason = check.reason;
            // log: salida rechazada por guardrail -> regenerar
        }
        throw new Error(`Veredicto no pasó guardrails tras ${this.maxRetries + 1} intentos: ${reason}`);
    }
}
exports.VerdictService = VerdictService;
