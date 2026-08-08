import type { VerdictProvider } from './verdict.provider';
import type { RetoWindow, VerdictResult } from './verdict.types';
import { validateVerdict } from './verdict.guardrails';

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
export class VerdictService {
  constructor(
    private readonly provider: VerdictProvider,
    private readonly saveVerdict: (enrollmentId: string, r: VerdictResult, meta: VerdictMeta) => Promise<void>,
    private readonly maxRetries = 2,
  ) {}

  async generateForEnrollment(
    enrollmentId: string,
    input: RetoWindow,
  ): Promise<VerdictResult> {
    let last: VerdictResult | null = null;
    let reason: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      last = await this.provider.generate(input);
      const check = validateVerdict(last.verdictText);
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

interface VerdictMeta {
  generatedForDay: number;
  trigger: string;
  attempts: number;
}
