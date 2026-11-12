import { buildCueTimeline } from './audio.service';
import { TimerSession } from '../timer-engine/timer-engine.types';

function session(partial: Partial<TimerSession>): TimerSession {
  const durations = [20, 10, 20];
  return {
    id: 's',
    routineName: 'r',
    routineSnapshot: {} as any,
    expandedSteps: durations.map(d => ({ step: { durationSeconds: d } })) as any,
    state: 'running',
    currentStepGlobalIndex: 0,
    stepDeadlineAt: 20_000,
    totalElapsedMs: 0,
    stepsCompleted: 0,
    schemaVersion: 1,
    ...partial,
  };
}

describe('buildCueTimeline', () => {
  it('schedules a start cue at each later step boundary and complete at the end', () => {
    expect(buildCueTimeline(session({}), 5_000)).toEqual([
      { atMs: 20_000, cue: 'start' },
      { atMs: 30_000, cue: 'start' },
      { atMs: 50_000, cue: 'complete' },
    ]);
  });

  it('starts from the current step and drops cues already in the past', () => {
    const s = session({ currentStepGlobalIndex: 1, stepDeadlineAt: 30_000 });
    expect(buildCueTimeline(s, 31_000)).toEqual([{ atMs: 50_000, cue: 'complete' }]);
  });

  it('adds one countdown beep per second before each step ends', () => {
    const s = session({ currentStepGlobalIndex: 1, stepDeadlineAt: 30_000 });
    expect(buildCueTimeline(s, 27_500, 3)).toEqual([
      { atMs: 28_000, cue: 'warning' },
      { atMs: 29_000, cue: 'warning' },
      { atMs: 30_000, cue: 'start' },
      { atMs: 47_000, cue: 'warning' },
      { atMs: 48_000, cue: 'warning' },
      { atMs: 49_000, cue: 'warning' },
      { atMs: 50_000, cue: 'complete' },
    ]);
  });

  it('caps countdown beeps on steps shorter than the warning window', () => {
    const s = session({ expandedSteps: [{ step: { durationSeconds: 2 } }] as any, stepDeadlineAt: 2_000 });
    expect(buildCueTimeline(s, 0, 3)).toEqual([
      { atMs: 1_000, cue: 'warning' },
      { atMs: 2_000, cue: 'complete' },
    ]);
  });

  it('schedules nothing when not running', () => {
    expect(buildCueTimeline(session({ state: 'paused' }), 0)).toEqual([]);
  });
});
