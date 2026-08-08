import fs from 'node:fs';
import path from 'node:path';
import type { RetoWindow, VerdictResult } from './verdict.types';

/**
 * Contrato a prueba de futuro. El servicio que lo consume NO debe saber qué
 * proveedor está detrás. Cambiar de Claude → GPT → Delphi Immortal = cambiar
 * solo esta implementación, sin tocar el resto de la app.
 */
export interface VerdictProvider {
  generate(input: RetoWindow): Promise<VerdictResult>;
}

// El system prompt vive como archivo verbatim (no retranscribir).
const SYSTEM_PROMPT = fs.readFileSync(
  path.resolve(__dirname, '../../../docs/verdict-system-prompt.txt'),
  'utf-8',
);

/**
 * Implementación actual: Anthropic Claude.
 * Requiere ANTHROPIC_API_KEY y ANTHROPIC_MODEL en el entorno.
 * NOTA: pseudo-implementación de referencia. El dev conecta el SDK real
 * (@anthropic-ai/sdk) y enchufa los few-shot de docs/verdict-fewshot-examples.md.
 */
export class ClaudeVerdictProvider implements VerdictProvider {
  constructor(
    private readonly apiKey = process.env.ANTHROPIC_API_KEY!,
    private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    private readonly maxTokens = Number(process.env.VERDICT_MAX_TOKENS ?? 400),
    private readonly temperature = Number(process.env.VERDICT_TEMPERATURE ?? 0.6),
  ) {}

  async generate(input: RetoWindow): Promise<VerdictResult> {
    const payload = JSON.stringify(
      {
        racha_actual: input.rachaActual,
        racha_maxima: input.rachaMaxima,
        dia_actual: input.diaActual,
        eslabon_debil: input.eslabonDebil,
        ventana: input.ventana,
      },
      null,
      2,
    );

    // TODO(dev): reemplazar por la llamada real al SDK de Anthropic.
    // const client = new Anthropic({ apiKey: this.apiKey });
    // const res = await client.messages.create({
    //   model: this.model, max_tokens: this.maxTokens, temperature: this.temperature,
    //   system: SYSTEM_PROMPT,
    //   messages: [ ...fewShotExamples, { role: 'user', content: payload } ],
    // });
    // const verdictText = res.content[0].type === 'text' ? res.content[0].text : '';

    const verdictText = `[stub] payload recibido:\n${payload}\nHonos · Probitas · Perfectio`;
    return { verdictText, weakLink: input.eslabonDebil };
  }
}
