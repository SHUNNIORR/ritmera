import {
  formatDuration,
  calcRoutineDurationSec,
  calcBlockDurationSec,
  expandRoutineSteps,
  computeCurrentStep,
  validateRoutine,
  msToSecsCeil,
} from './timer-engine.utils';
import { Routine, RoutineBlock, SCHEMA_VERSION } from './timer-engine.types';

describe('TimerEngineUtils', () => {
  describe('formatDuration', () => {
    it('formats seconds < 60 as mm:ss', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(5)).toBe('00:05');
      expect(formatDuration(59)).toBe('00:59');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration(60)).toBe('01:00');
      expect(formatDuration(125)).toBe('02:05');
      expect(formatDuration(599)).toBe('09:59');
    });

    it('formats durations >= 1 hour as hh:mm:ss', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
      expect(formatDuration(3665)).toBe('01:01:05');
      expect(formatDuration(7325)).toBe('02:02:05');
    });

    it('handles negative or fractional seconds safely', () => {
      expect(formatDuration(-10)).toBe('00:00');
      expect(formatDuration(45.8)).toBe('00:45');
    });
  });

  describe('msToSecsCeil', () => {
    it('rounds up milliseconds to nearest ceiling second', () => {
      expect(msToSecsCeil(0)).toBe(0);
      expect(msToSecsCeil(1)).toBe(1);
      expect(msToSecsCeil(999)).toBe(1);
      expect(msToSecsCeil(1000)).toBe(1);
      expect(msToSecsCeil(1001)).toBe(2);
    });
  });

  describe('calcBlockDurationSec', () => {
    it('calculates duration for single repetition without rest', () => {
      const block: RoutineBlock = {
        id: 'b1',
        steps: [
          { id: 's1', name: 'Work', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
          { id: 's2', name: 'Rest', type: 'rest', durationSeconds: 15, soundOnStart: false, soundOnEnd: false, voiceAnnouncement: false },
        ],
        repetitions: 1,
        restAfterLastRound: false,
      };
      expect(calcBlockDurationSec(block)).toBe(45);
    });

    it('calculates duration with multiple repetitions and rest between rounds', () => {
      const block: RoutineBlock = {
        id: 'b1',
        steps: [
          { id: 's1', name: 'Work', type: 'work', durationSeconds: 20, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
        ],
        repetitions: 4,
        restBetweenRoundsSec: 10,
        restAfterLastRound: false,
      };
      // 4 * 20s + (4 - 1) * 10s = 80 + 30 = 110s
      expect(calcBlockDurationSec(block)).toBe(110);
    });

    it('includes rest after last round when restAfterLastRound is true', () => {
      const block: RoutineBlock = {
        id: 'b1',
        steps: [
          { id: 's1', name: 'Work', type: 'work', durationSeconds: 20, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
        ],
        repetitions: 4,
        restBetweenRoundsSec: 10,
        restAfterLastRound: true,
      };
      // 4 * 20s + 4 * 10s = 120s
      expect(calcBlockDurationSec(block)).toBe(120);
    });
  });

  describe('calcRoutineDurationSec', () => {
    it('sums all block durations accurately', () => {
      const routine: Routine = {
        id: 'r1',
        name: 'Test',
        category: 'hiit',
        color: '#fff',
        tags: [],
        isFavorite: false,
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: SCHEMA_VERSION,
        preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 0 },
        blocks: [
          {
            id: 'b1',
            repetitions: 2,
            restBetweenRoundsSec: 10,
            restAfterLastRound: false,
            steps: [{ id: 's1', name: 'A', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false }],
          },
          {
            id: 'b2',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [{ id: 's2', name: 'B', type: 'cooldown', durationSeconds: 60, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false }],
          },
        ],
      };
      // Block 1: 2 * 30 + 1 * 10 = 70s
      // Block 2: 1 * 60 = 60s
      // Total: 130s
      expect(calcRoutineDurationSec(routine)).toBe(130);
    });
  });

  describe('expandRoutineSteps', () => {
    it('expands blocks into flat sequence preserving repetition indices and inserting inter-round rests', () => {
      const routine: Routine = {
        id: 'r1',
        name: 'Test',
        category: 'hiit',
        color: '#fff',
        tags: [],
        isFavorite: false,
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: SCHEMA_VERSION,
        preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 0 },
        blocks: [
          {
            id: 'b1',
            repetitions: 2,
            restBetweenRoundsSec: 15,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'Sprint', type: 'work', durationSeconds: 20, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
            ],
          },
        ],
      };

      const expanded = expandRoutineSteps(routine);
      expect(expanded.length).toBe(3); // Sprint (rep 0), Rest (rep 0), Sprint (rep 1)

      expect(expanded[0].globalIndex).toBe(0);
      expect(expanded[0].step.name).toBe('Sprint');
      expect(expanded[0].isInterRoundRest).toBe(false);

      expect(expanded[1].globalIndex).toBe(1);
      expect(expanded[1].step.name).toBe('Descanso');
      expect(expanded[1].step.durationSeconds).toBe(15);
      expect(expanded[1].isInterRoundRest).toBe(true);

      expect(expanded[2].globalIndex).toBe(2);
      expect(expanded[2].step.name).toBe('Sprint');
      expect(expanded[2].isInterRoundRest).toBe(false);
    });
  });

  describe('computeCurrentStep (browser suspension / recovery logic)', () => {
    it('returns same step with reduced remaining time when within current step deadline', () => {
      const routine: Routine = {
        id: 'r1',
        name: 'Test',
        category: 'hiit',
        color: '#fff',
        tags: [],
        isFavorite: false,
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: SCHEMA_VERSION,
        preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 0 },
        blocks: [
          {
            id: 'b1',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'S1', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
              { id: 's2', name: 'S2', type: 'rest', durationSeconds: 20, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
            ],
          },
        ],
      };
      const expanded = expandRoutineSteps(routine);
      const deadlineAt = 100000;
      const now = 90000; // 10s before deadline

      const res = computeCurrentStep(expanded, 0, deadlineAt, now);
      expect(res).not.toBeNull();
      expect(res!.stepIndex).toBe(0);
      expect(res!.remainingMs).toBe(10000);
    });

    it('advances through multiple expired steps if suspended longer than step durations', () => {
      const routine: Routine = {
        id: 'r1',
        name: 'Test',
        category: 'hiit',
        color: '#fff',
        tags: [],
        isFavorite: false,
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: SCHEMA_VERSION,
        preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 0 },
        blocks: [
          {
            id: 'b1',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'S1', type: 'work', durationSeconds: 10, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false }, // [0..10s]
              { id: 's2', name: 'S2', type: 'rest', durationSeconds: 20, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false }, // [10..30s]
              { id: 's3', name: 'S3', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false }, // [30..60s]
            ],
          },
        ],
      };
      const expanded = expandRoutineSteps(routine);
      const step0Deadline = 10000; // S1 ends at 10s
      // Suppose phone was suspended from 5s to 25s (25000 ms)
      const now = 25000;
      // S1 ended at 10000, S2 starts at 10000 and ends at 30000. So at 25000 we are in S2 with 5000ms left.
      const res = computeCurrentStep(expanded, 0, step0Deadline, now);
      expect(res).not.toBeNull();
      expect(res!.stepIndex).toBe(1);
      expect(res!.remainingMs).toBe(5000);
    });

    it('returns null if session has completed while suspended', () => {
      const routine: Routine = {
        id: 'r1',
        name: 'Test',
        category: 'hiit',
        color: '#fff',
        tags: [],
        isFavorite: false,
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: SCHEMA_VERSION,
        preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 0 },
        blocks: [
          {
            id: 'b1',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'S1', type: 'work', durationSeconds: 10, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
            ],
          },
        ],
      };
      const expanded = expandRoutineSteps(routine);
      const step0Deadline = 10000;
      const now = 50000; // Far past the end

      const res = computeCurrentStep(expanded, 0, step0Deadline, now);
      expect(res).toBeNull();
    });
  });

  describe('validateRoutine', () => {
    it('returns error if name is empty', () => {
      const errors = validateRoutine({ name: '', blocks: [] });
      expect(errors).toContain('El nombre es obligatorio.');
    });

    it('returns error if no blocks exist', () => {
      const errors = validateRoutine({ name: 'Valid Name', blocks: [] });
      expect(errors).toContain('La rutina debe tener al menos un bloque.');
    });

    it('returns error if step duration is less than 1', () => {
      const errors = validateRoutine({
        name: 'Valid Name',
        blocks: [
          {
            id: 'b1',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'Bad Step', type: 'work', durationSeconds: 0, soundOnStart: false, soundOnEnd: false, voiceAnnouncement: false },
            ],
          },
        ],
      });
      expect(errors.some(e => e.includes('debe durar al menos 1 segundo'))).toBe(true);
    });

    it('returns empty array when routine is valid', () => {
      const errors = validateRoutine({
        name: 'Valid Routine',
        blocks: [
          {
            id: 'b1',
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              { id: 's1', name: 'Work', type: 'work', durationSeconds: 30, soundOnStart: false, soundOnEnd: false, voiceAnnouncement: false },
            ],
          },
        ],
      });
      expect(errors.length).toBe(0);
    });
  });
});
