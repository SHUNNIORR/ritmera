// ============================================================
// Intervala – Timer Engine Types
// Todas las duraciones en milisegundos internamente.
// Las fechas son epoch ms (Date.now()).
// ============================================================

export const SCHEMA_VERSION = 1;

// ── Categorías de rutina ────────────────────────────────────
export type RoutineCategory =
  | 'hiit'
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'study'
  | 'custom';

// ── Tipos de etapa ──────────────────────────────────────────
export type StepType =
  | 'work'
  | 'rest'
  | 'warmup'
  | 'cooldown'
  | 'recovery'
  | 'custom';

// ── Estado de sesión ────────────────────────────────────────
export type SessionState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type SessionStatus = 'completed' | 'cancelled' | 'interrupted';

// ── Etapa de rutina ─────────────────────────────────────────
export interface RoutineStep {
  id: string;
  name: string;
  type: StepType;
  /** Duración en segundos (≥ 1) */
  durationSeconds: number;
  soundOnStart: boolean;
  soundOnEnd: boolean;
  voiceAnnouncement: boolean;
  customAnnouncementText?: string;
}

// ── Bloque de repeticiones ──────────────────────────────────
export interface RoutineBlock {
  id: string;
  name?: string;
  steps: RoutineStep[];
  /** Número de repeticiones del bloque (≥ 1) */
  repetitions: number;
  /** Segundos de descanso entre repeticiones (undefined = sin descanso) */
  restBetweenRoundsSec?: number;
  /** Si se añade descanso después de la última repetición */
  restAfterLastRound: boolean;
}

// ── Preferencias de la rutina ───────────────────────────────
export interface RoutinePreferences {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  countdownBeforeStartSec: number; // 0 = sin cuenta regresiva
  warningBeforeEndSec: number;     // 0 = sin aviso previo
}

// ── Rutina (definición reutilizable) ────────────────────────
export interface Routine {
  id: string;
  name: string;
  description?: string;
  category: RoutineCategory;
  /** Color HEX identificador, ej. "#FF6B35" */
  color: string;
  tags: string[];
  blocks: RoutineBlock[];
  preferences: RoutinePreferences;
  isFavorite: boolean;
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
  lastUsedAt?: number; // epoch ms
  schemaVersion: number;
}

// ── Posición dentro de la sesión expandida ──────────────────
export interface ExpandedStep {
  /** Índice global en la secuencia expandida */
  globalIndex: number;
  blockIndex: number;
  /** Repetición actual del bloque (0-based) */
  repetitionIndex: number;
  stepIndex: number;
  step: RoutineStep;
  /** Si es el descanso entre repeticiones (no una etapa de usuario) */
  isInterRoundRest: boolean;
}

// ── Sesión activa (instancia) ───────────────────────────────
export interface TimerSession {
  id: string;
  routineId?: string;
  routineName: string;
  /** Copia inmutable de la rutina al iniciar */
  routineSnapshot: Routine;
  /** Secuencia expandida generada al iniciar */
  expandedSteps: ExpandedStep[];
  state: SessionState;
  currentStepGlobalIndex: number;
  /** epoch ms en que comenzó la etapa actual */
  stepStartedAt?: number;
  /** epoch ms en que la etapa actual debería terminar */
  stepDeadlineAt?: number;
  /** ms restantes al momento de pausar */
  pausedRemainingMs?: number;
  startedAt?: number;   // epoch ms
  completedAt?: number; // epoch ms
  /** ms de tiempo real transcurrido (excluye pausas) */
  totalElapsedMs: number;
  stepsCompleted: number;
  schemaVersion: number;
}

// ── Entrada de historial ─────────────────────────────────────
export interface SessionHistoryEntry {
  id: string;
  sessionId: string;
  routineId?: string;
  routineName: string;
  /** Instantánea relevante de la rutina para referencia futura */
  routineSnapshot: Pick<Routine, 'id' | 'name' | 'category' | 'color' | 'blocks'>;
  startedAt: number;
  endedAt: number;
  /** Duración planificada en segundos */
  plannedDurationSec: number;
  /** Duración real en ms */
  actualDurationMs: number;
  stepsCompleted: number;
  totalSteps: number;
  status: SessionStatus;
  notes?: string;
  schemaVersion: number;
}

// ── Ajustes de la aplicación ─────────────────────────────────
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
  countdownBeforeStartSec: number;
  warningBeforeEndSec: number;
  keepScreenAwake: boolean;
  showElapsedTime: boolean;
  schemaVersion: number;
}

// ── Payload de exportación ───────────────────────────────────
export interface ExportPayload {
  schemaVersion: number;
  exportedAt: number; // epoch ms
  appVersion: string;
  routines: Routine[];
  settings?: Partial<AppSettings>;
  history?: SessionHistoryEntry[];
}

// ── Plantillas predefinidas ──────────────────────────────────
export type TemplateKey =
  | 'tabata'
  | 'hiit4020'
  | 'emom'
  | 'pomodoro'
  | 'custom';

export interface RoutineTemplate {
  key: TemplateKey;
  name: string;
  description: string;
  category: RoutineCategory;
  color: string;
}
