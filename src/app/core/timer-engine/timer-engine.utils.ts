// ============================================================
// Ritmera – Timer Engine Utils
// Funciones puras: no dependen de Angular, 100% testeables.
// ============================================================

import {
  Routine,
  RoutineBlock,
  ExpandedStep,
  AppSettings,
  SCHEMA_VERSION,
} from './timer-engine.types';

// ── Generación de IDs ────────────────────────────────────────
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Formateo de tiempo ───────────────────────────────────────
/**
 * Convierte segundos a string "mm:ss" o "hh:mm:ss" si >= 1 hora.
 */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Convierte ms a segundos redondeando hacia arriba (para cuenta regresiva).
 */
export function msToSecsCeil(ms: number): number {
  return Math.ceil(Math.max(0, ms) / 1000);
}

// ── Cálculo de duración total ────────────────────────────────
/**
 * Calcula la duración total de una rutina en segundos.
 * Incluye repeticiones, descansos entre rondas (excluye descanso
 * post-última ronda si restAfterLastRound es false).
 */
export function calcRoutineDurationSec(routine: Routine): number {
  let total = 0;
  for (const block of routine.blocks) {
    total += calcBlockDurationSec(block);
  }
  return total;
}

export function calcBlockDurationSec(block: RoutineBlock): number {
  const stepsDuration = block.steps.reduce(
    (acc, s) => acc + s.durationSeconds,
    0
  );
  const restBetween = block.restBetweenRoundsSec ?? 0;
  const reps = Math.max(1, block.repetitions);

  let total = stepsDuration * reps;
  // Descansos entre repeticiones (reps-1 descansos entre rondas)
  if (reps > 1 && restBetween > 0) {
    total += restBetween * (reps - 1);
  }
  // Descanso después de la última repetición
  if (block.restAfterLastRound && restBetween > 0) {
    total += restBetween;
  }
  return total;
}

// ── Expansión de la secuencia ────────────────────────────────
/**
 * Expande todos los bloques y repeticiones de una rutina en una
 * lista plana de ExpandedStep. Los descansos entre repeticiones
 * se representan como ExpandedStep con isInterRoundRest=true.
 */
export function expandRoutineSteps(routine: Routine): ExpandedStep[] {
  const result: ExpandedStep[] = [];
  let globalIndex = 0;

  for (let bi = 0; bi < routine.blocks.length; bi++) {
    const block = routine.blocks[bi];
    const reps = Math.max(1, block.repetitions);
    const restSec = block.restBetweenRoundsSec ?? 0;

    for (let ri = 0; ri < reps; ri++) {
      // Etapas del bloque
      for (let si = 0; si < block.steps.length; si++) {
        result.push({
          globalIndex,
          blockIndex: bi,
          repetitionIndex: ri,
          stepIndex: si,
          step: block.steps[si],
          isInterRoundRest: false,
        });
        globalIndex++;
      }

      // Descanso entre repeticiones
      const isLastRep = ri === reps - 1;
      if (restSec > 0) {
        if (!isLastRep || block.restAfterLastRound) {
          result.push({
            globalIndex,
            blockIndex: bi,
            repetitionIndex: ri,
            stepIndex: -1,
            step: {
              id: `rest-${bi}-${ri}`,
              name: 'Descanso',
              type: 'rest',
              durationSeconds: restSec,
              soundOnStart: true,
              soundOnEnd: false,
              voiceAnnouncement: false,
            },
            isInterRoundRest: true,
          });
          globalIndex++;
        }
      }
    }
  }

  return result;
}

// ── Cálculo de etapa actual tras suspensión ──────────────────
/**
 * Dado el estado al pausar/ejecutar y el tiempo actual,
 * determina en qué ExpandedStep debe estar y cuántos ms quedan.
 *
 * @param expandedSteps secuencia expandida
 * @param fromIndex índice de inicio de la búsqueda
 * @param deadlineAt epoch ms del deadline de la etapa actual
 * @param now epoch ms actual
 * @returns { stepIndex, remainingMs } o null si la sesión terminó
 */
export function computeCurrentStep(
  expandedSteps: ExpandedStep[],
  fromIndex: number,
  deadlineAt: number,
  now: number
): { stepIndex: number; remainingMs: number } | null {
  if (fromIndex >= expandedSteps.length) return null;

  let currentDeadline = deadlineAt;
  let idx = fromIndex;

  while (idx < expandedSteps.length) {
    if (now < currentDeadline) {
      // Estamos dentro de esta etapa
      return { stepIndex: idx, remainingMs: currentDeadline - now };
    }
    // La etapa venció; avanzar a la siguiente
    idx++;
    if (idx >= expandedSteps.length) return null;
    const nextStep = expandedSteps[idx];
    currentDeadline += nextStep.step.durationSeconds * 1000;
  }

  return null;
}

// ── Valores por defecto ──────────────────────────────────────
export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    soundEnabled: true,
    voiceEnabled: false,
    vibrationEnabled: true,
    countdownBeforeStartSec: 3,
    warningBeforeEndSec: 3,
    keepScreenAwake: true,
    showElapsedTime: true,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function defaultRoutinePreferences(): Routine['preferences'] {
  return {
    soundEnabled: true,
    voiceEnabled: false,
    countdownBeforeStartSec: 3,
    warningBeforeEndSec: 3,
  };
}

// ── Colores semánticos de etapa ──────────────────────────────
export function stepTypeColor(type: string): string {
  const map: Record<string, string> = {
    work: 'var(--color-step-work)',
    rest: 'var(--color-step-rest)',
    warmup: 'var(--color-step-warmup)',
    cooldown: 'var(--color-step-cooldown)',
    recovery: 'var(--color-step-recovery)',
    custom: 'var(--color-step-custom)',
  };
  return map[type] ?? 'var(--color-step-custom)';
}

// ── Validación básica ────────────────────────────────────────
export function validateRoutine(routine: Partial<Routine>): string[] {
  const errors: string[] = [];
  if (!routine.name?.trim()) errors.push('El nombre es obligatorio.');
  if (!routine.blocks?.length) errors.push('La rutina debe tener al menos un bloque.');
  for (const block of routine.blocks ?? []) {
    if (!block.steps?.length) errors.push(`El bloque "${block.name ?? 'sin nombre'}" no tiene etapas.`);
    for (const step of block.steps ?? []) {
      if (step.durationSeconds < 1) {
        errors.push(`La etapa "${step.name}" debe durar al menos 1 segundo.`);
      }
    }
  }
  return errors;
}
