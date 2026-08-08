"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeVerdictProvider = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// El system prompt vive como archivo verbatim (no retranscribir).
const SYSTEM_PROMPT = node_fs_1.default.readFileSync(node_path_1.default.resolve(__dirname, '../../../docs/verdict-system-prompt.txt'), 'utf-8');
/**
 * Implementación actual: Anthropic Claude.
 * Requiere ANTHROPIC_API_KEY y ANTHROPIC_MODEL en el entorno.
 * NOTA: pseudo-implementación de referencia. El dev conecta el SDK real
 * (@anthropic-ai/sdk) y enchufa los few-shot de docs/verdict-fewshot-examples.md.
 */
class ClaudeVerdictProvider {
    apiKey;
    model;
    maxTokens;
    temperature;
    constructor(apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6', maxTokens = Number(process.env.VERDICT_MAX_TOKENS ?? 400), temperature = Number(process.env.VERDICT_TEMPERATURE ?? 0.6)) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
    }
    async generate(input) {
        const payload = JSON.stringify({
            racha_actual: input.rachaActual,
            racha_maxima: input.rachaMaxima,
            dia_actual: input.diaActual,
            eslabon_debil: input.eslabonDebil,
            ventana: input.ventana,
        }, null, 2);
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
exports.ClaudeVerdictProvider = ClaudeVerdictProvider;
