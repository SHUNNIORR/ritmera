import { TimerEngineService } from './timer-engine.service';
import { Routine, SCHEMA_VERSION } from './timer-engine.types';

describe('TimerEngineService', () => {
  let service: TimerEngineService;
  let mockNgZone: any;

  const sampleRoutine: Routine = {
    id: 'test-routine-1',
    name: 'Rutina de prueba',
    category: 'hiit',
    color: '#FF6B35',
    tags: [],
    isFavorite: false,
    createdAt: 1000,
    updatedAt: 1000,
    schemaVersion: SCHEMA_VERSION,
    preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 3 },
    blocks: [
      {
        id: 'block-1',
        repetitions: 1,
        restAfterLastRound: false,
        steps: [
          { id: 'step-1', name: 'Sprint', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: true, voiceAnnouncement: false },
          { id: 'step-2', name: 'Descanso', type: 'rest', durationSeconds: 15, soundOnStart: true, soundOnEnd: false, voiceAnnouncement: false },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockNgZone = {
      run: (fn: Function) => fn(),
      runOutsideAngular: (fn: Function) => fn(),
    };
    service = new TimerEngineService(mockNgZone);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('starts session in running state with first step active', (done) => {
    service.session$.subscribe(session => {
      if (session) {
        expect(session.state).toBe('running');
        expect(session.routineName).toBe('Rutina de prueba');
        expect(session.currentStepGlobalIndex).toBe(0);
        expect(session.expandedSteps.length).toBe(2);
        done();
      }
    });

    service.startSession(sampleRoutine);
  });

  it('pauses session and records remaining time and elapsed time', () => {
    service.startSession(sampleRoutine);
    service.pause();

    const session = (service as any)._session$.value;
    expect(session.state).toBe('paused');
    expect(session.pausedRemainingMs).toBeGreaterThan(0);
    expect(session.pausedRemainingMs).toBeLessThanOrEqual(30000);
  });

  it('resumes paused session without losing step place', () => {
    service.startSession(sampleRoutine);
    service.pause();
    const paused = (service as any)._session$.value;
    const remainingBefore = paused.pausedRemainingMs;

    service.resume();
    const resumed = (service as any)._session$.value;
    expect(resumed.state).toBe('running');
    expect(resumed.stepDeadlineAt).toBeDefined();
  });

  it('navigates nextStep manually', () => {
    service.startSession(sampleRoutine);
    service.nextStep();

    const session = (service as any)._session$.value;
    expect(session.currentStepGlobalIndex).toBe(1);
    expect(session.expandedSteps[session.currentStepGlobalIndex].step.name).toBe('Descanso');
  });

  it('navigates prevStep manually', () => {
    service.startSession(sampleRoutine);
    service.nextStep();
    service.prevStep();

    const session = (service as any)._session$.value;
    expect(session.currentStepGlobalIndex).toBe(0);
    expect(session.expandedSteps[session.currentStepGlobalIndex].step.name).toBe('Sprint');
  });

  it('restarts current step keeping the step index and resetting deadline', () => {
    service.startSession(sampleRoutine);
    service.restartStep();

    const session = (service as any)._session$.value;
    expect(session.currentStepGlobalIndex).toBe(0);
    expect(session.state).toBe('running');
  });

  it('adjusts current step time (+/- deltaSec)', () => {
    service.startSession(sampleRoutine);
    const initialDeadline = (service as any)._session$.value.stepDeadlineAt;

    service.adjustCurrentStepTime(10);
    const updatedDeadline = (service as any)._session$.value.stepDeadlineAt;
    expect(updatedDeadline).toBe(initialDeadline + 10000);

    service.adjustCurrentStepTime(-5);
    const reducedDeadline = (service as any)._session$.value.stepDeadlineAt;
    expect(reducedDeadline).toBe(updatedDeadline - 5000);
  });

  it('cancels session cleanly', () => {
    service.startSession(sampleRoutine);
    service.cancel();

    const session = (service as any)._session$.value;
    expect(session.state).toBe('cancelled');
    expect(session.completedAt).toBeDefined();
  });
});
