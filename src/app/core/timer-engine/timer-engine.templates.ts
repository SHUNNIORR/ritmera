// ============================================================
// Ritmera – Plantillas predefinidas de rutinas
// ============================================================

import { Routine, SCHEMA_VERSION } from './timer-engine.types';
import { generateId, defaultRoutinePreferences } from './timer-engine.utils';

export function defaultTemplates(): Routine[] {
  const now = Date.now();

  return [
    // ── Tabata clásico ──────────────────────────────────────
    {
      id: generateId(),
      name: 'Tabata clásico',
      description: '8 rondas de 20 segundos de trabajo + 10 de descanso.',
      category: 'hiit',
      color: '#EF4444',
      tags: ['tabata', 'hiit'],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      preferences: defaultRoutinePreferences(),
      blocks: [
        {
          id: generateId(),
          name: 'Tabata',
          repetitions: 8,
          restAfterLastRound: false,
          restBetweenRoundsSec: 10,
          steps: [
            {
              id: generateId(),
              name: 'Trabajo',
              type: 'work',
              durationSeconds: 20,
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            },
          ],
        },
      ],
    },

    // ── HIIT 40/20 ──────────────────────────────────────────
    {
      id: generateId(),
      name: 'HIIT 40/20',
      description: '40 segundos de trabajo y 20 de descanso, 8 rondas.',
      category: 'hiit',
      color: '#F97316',
      tags: ['hiit', 'cardio'],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      preferences: defaultRoutinePreferences(),
      blocks: [
        {
          id: generateId(),
          name: 'HIIT',
          repetitions: 8,
          restAfterLastRound: false,
          restBetweenRoundsSec: 20,
          steps: [
            {
              id: generateId(),
              name: 'Trabajo',
              type: 'work',
              durationSeconds: 40,
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            },
          ],
        },
      ],
    },

    // ── EMOM 10 minutos ─────────────────────────────────────
    {
      id: generateId(),
      name: 'EMOM 10 min',
      description: 'Cada minuto en el minuto, durante 10 minutos.',
      category: 'strength',
      color: '#8B5CF6',
      tags: ['emom', 'fuerza'],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      preferences: defaultRoutinePreferences(),
      blocks: [
        {
          id: generateId(),
          name: 'EMOM',
          repetitions: 10,
          restAfterLastRound: false,
          restBetweenRoundsSec: undefined,
          steps: [
            {
              id: generateId(),
              name: 'Trabajo (40s)',
              type: 'work',
              durationSeconds: 40,
              soundOnStart: true,
              soundOnEnd: false,
              voiceAnnouncement: false,
            },
            {
              id: generateId(),
              name: 'Descanso (20s)',
              type: 'rest',
              durationSeconds: 20,
              soundOnStart: false,
              soundOnEnd: true,
              voiceAnnouncement: false,
            },
          ],
        },
      ],
    },

    // ── Pomodoro ────────────────────────────────────────────
    {
      id: generateId(),
      name: 'Pomodoro',
      description: '25 min de concentración + 5 min de descanso, 4 ciclos.',
      category: 'study',
      color: '#10B981',
      tags: ['pomodoro', 'estudio', 'foco'],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      preferences: {
        ...defaultRoutinePreferences(),
        countdownBeforeStartSec: 0,
        warningBeforeEndSec: 60,
      },
      blocks: [
        {
          id: generateId(),
          name: 'Pomodoro',
          repetitions: 4,
          restAfterLastRound: false,
          restBetweenRoundsSec: 300, // 5 min
          steps: [
            {
              id: generateId(),
              name: 'Concentración',
              type: 'work',
              durationSeconds: 1500, // 25 min
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            },
          ],
        },
      ],
    },
  ];
}
