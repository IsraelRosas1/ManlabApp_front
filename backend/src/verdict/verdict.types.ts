// Tipos del Reto y del Veredicto. Fuente: docs/interfaces (handoff).
// Los 5 frentes son FIJOS. No renombrar.

export type Frente =
  | 'intelectual'
  | 'espiritual'
  | 'fisico'
  | 'economico'
  | 'social_atraccion';

export interface DailyLog {
  dia: number; // 1..100
  intelectual: boolean;
  espiritual: boolean;
  fisico: boolean;
  economico: boolean;
  social_atraccion: boolean;
  note?: string; // bitácora libre (la lee el Veredicto)
}

export type VerdictTrigger = 'manual' | 'racha_rota' | 'eslabon_persistente';

export interface RetoWindow {
  rachaActual: number;
  rachaMaxima: number;
  diaActual: number;
  eslabonDebil: Frente;
  ventana: DailyLog[]; // últimos 7–14 días
  trigger: VerdictTrigger;
}

export interface VerdictResult {
  verdictText: string; // texto en voz de Master
  weakLink: Frente;
}
