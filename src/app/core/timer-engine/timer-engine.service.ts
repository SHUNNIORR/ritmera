// ============================================================
// Intervala – Timer Engine Service
// Máquina de estados del temporizador. Sin dependencias de UI.
// Se puede usar desde Angular o en pruebas aisladas.
// ============================================================

import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  TimerSession,
  SessionState,
  ExpandedStep,
  Routine,
  SCHEMA_VERSION,
} from './timer-engine.types';
import {
  generateId,
  expandRoutineSteps,
  computeCurrentStep,
  calcRoutineDurationSec,
} from './timer-engine.utils';

export interface TimerTick {
  session: TimerSession;
  remainingMs: number;
  totalRemainingMs: number;
  currentExpandedStep: ExpandedStep | null;
  nextExpandedStep: ExpandedStep | null;
  isWarning: boolean;
}

export interface TimerEngineEvent {
  type:
    | 'step-start'
    | 'step-end'
    | 'session-complete'
    | 'session-paused'
    | 'session-resumed'
    | 'session-cancelled'
    | 'warning';
  session: TimerSession;
  expandedStep?: ExpandedStep;
}

@Injectable({ providedIn: 'root' })
export class TimerEngineService implements OnDestroy {
  private _session$ = new BehaviorSubject<TimerSession | null>(null);
  private _tick$ = new BehaviorSubject<TimerTick | null>(null);
  private _events$ = new Subject<TimerEngineEvent>();

  readonly session$ = this._session$.asObservable();
  readonly tick$ = this._tick$.asObservable();
  readonly events$ = this._events$.asObservable();

  private rafId: ReturnType<typeof requestAnimationFrame> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageShowHandler: (() => void) | null = null;
  /** Flag para evitar transiciones dobles */
  private _transitioning = false;
  /** Tiempo de aviso en ms (desde settings) */
  private warningBeforeEndMs = 3000;

  constructor(private ngZone: NgZone) {
    this.bindVisibilityEvents();
  }

  ngOnDestroy(): void {
    this.stopRaf();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler);
    }
  }

  // ── API pública ─────────────────────────────────────────────

  setWarningBeforeEndMs(ms: number): void {
    this.warningBeforeEndMs = ms;
  }

  startSession(routine: Routine, resumeSession?: TimerSession): void {
    this.stopRaf();
    const expandedSteps = expandRoutineSteps(routine);
    if (!expandedSteps.length) return;

    const now = Date.now();
    let session: TimerSession;

    if (resumeSession && resumeSession.state === 'paused') {
      // Reanudar sesión pausada
      session = { ...resumeSession };
      this.resumeInternal(session, now);
    } else {
      // Nueva sesión
      const firstStep = expandedSteps[0];
      session = {
        id: generateId(),
        routineId: routine.id,
        routineName: routine.name,
        routineSnapshot: routine,
        expandedSteps,
        state: 'running',
        currentStepGlobalIndex: 0,
        stepStartedAt: now,
        stepDeadlineAt: now + firstStep.step.durationSeconds * 1000,
        startedAt: now,
        totalElapsedMs: 0,
        stepsCompleted: 0,
        schemaVersion: SCHEMA_VERSION,
      };
      this._events$.next({ type: 'step-start', session, expandedStep: firstStep });
    }

    this._session$.next(session);
    this.startRaf(session);
  }

  pause(): void {
    const session = this._session$.value;
    if (!session || session.state !== 'running') return;

    const now = Date.now();
    const remaining = session.stepDeadlineAt
      ? Math.max(0, session.stepDeadlineAt - now)
      : 0;
    const elapsed = session.stepStartedAt ? now - session.stepStartedAt : 0;

    const paused: TimerSession = {
      ...session,
      state: 'paused',
      pausedRemainingMs: remaining,
      totalElapsedMs: session.totalElapsedMs + elapsed,
    };

    this.stopRaf();
    this._session$.next(paused);
    this._events$.next({ type: 'session-paused', session: paused });
    this.emitTick(paused);
  }

  resume(): void {
    const session = this._session$.value;
    if (!session || session.state !== 'paused') return;

    const now = Date.now();
    const resumed = { ...session };
    this.resumeInternal(resumed, now);
    this._session$.next(resumed);
    this._events$.next({ type: 'session-resumed', session: resumed });
    this.startRaf(resumed);
  }

  nextStep(): void {
    const session = this._session$.value;
    if (!session || this._transitioning) return;
    if (session.state !== 'running' && session.state !== 'paused') return;
    this.advanceStep(session, Date.now(), true);
  }

  prevStep(): void {
    const session = this._session$.value;
    if (!session || this._transitioning) return;
    if (session.state !== 'running' && session.state !== 'paused') return;

    const prevIndex = Math.max(0, session.currentStepGlobalIndex - 1);
    const now = Date.now();
    const step = session.expandedSteps[prevIndex];
    const updated: TimerSession = {
      ...session,
      state: 'running',
      currentStepGlobalIndex: prevIndex,
      stepStartedAt: now,
      stepDeadlineAt: now + step.step.durationSeconds * 1000,
      pausedRemainingMs: undefined,
    };
    this._session$.next(updated);
    this._events$.next({ type: 'step-start', session: updated, expandedStep: step });
    if (session.state === 'paused') {
      this.startRaf(updated);
    }
  }

  restartStep(): void {
    const session = this._session$.value;
    if (!session || this._transitioning) return;
    const step = session.expandedSteps[session.currentStepGlobalIndex];
    if (!step) return;

    const now = Date.now();
    const updated: TimerSession = {
      ...session,
      state: 'running',
      stepStartedAt: now,
      stepDeadlineAt: now + step.step.durationSeconds * 1000,
      pausedRemainingMs: undefined,
    };
    this._session$.next(updated);
    if (session.state === 'paused') {
      this.startRaf(updated);
    }
  }

  cancel(): void {
    const session = this._session$.value;
    if (!session) return;
    this.stopRaf();
    const cancelled: TimerSession = {
      ...session,
      state: 'cancelled',
      completedAt: Date.now(),
    };
    this._session$.next(cancelled);
    this._events$.next({ type: 'session-cancelled', session: cancelled });
  }

  restoreSession(session: TimerSession): void {
    if (session.state === 'running') {
      const now = Date.now();
      const result = computeCurrentStep(
        session.expandedSteps,
        session.currentStepGlobalIndex,
        session.stepDeadlineAt ?? now,
        now
      );
      if (!result) {
        // La sesión terminó mientras estaba suspendida
        const completed: TimerSession = {
          ...session,
          state: 'completed',
          completedAt: now,
          stepsCompleted: session.expandedSteps.length,
        };
        this._session$.next(completed);
        this._events$.next({ type: 'session-complete', session: completed });
        return;
      }
      const restored: TimerSession = {
        ...session,
        currentStepGlobalIndex: result.stepIndex,
        stepDeadlineAt: now + result.remainingMs,
        stepStartedAt: now - (session.expandedSteps[result.stepIndex].step.durationSeconds * 1000 - result.remainingMs),
      };
      this._session$.next(restored);
      this.startRaf(restored);
    } else {
      this._session$.next(session);
      if (session.state === 'paused') {
        this.emitTick(session);
      }
    }
  }

  adjustCurrentStepTime(deltaSec: number): void {
    const session = this._session$.value;
    if (!session || session.state === 'completed' || session.state === 'cancelled') return;

    if (session.state === 'running' && session.stepDeadlineAt) {
      const updated: TimerSession = {
        ...session,
        stepDeadlineAt: session.stepDeadlineAt + deltaSec * 1000,
      };
      this._session$.next(updated);
    } else if (session.state === 'paused' && session.pausedRemainingMs !== undefined) {
      const updated: TimerSession = {
        ...session,
        pausedRemainingMs: Math.max(0, session.pausedRemainingMs + deltaSec * 1000),
      };
      this._session$.next(updated);
      this.emitTick(updated);
    }
  }

  clearSession(): void {
    this.stopRaf();
    this._session$.next(null);
    this._tick$.next(null);
  }

  // ── Lógica interna ──────────────────────────────────────────

  private resumeInternal(session: TimerSession, now: number): void {
    const remaining = session.pausedRemainingMs ?? 0;
    session.state = 'running';
    session.stepStartedAt = now - (
      (session.expandedSteps[session.currentStepGlobalIndex]?.step.durationSeconds ?? 0) * 1000 - remaining
    );
    session.stepDeadlineAt = now + remaining;
    session.pausedRemainingMs = undefined;
  }

  private startRaf(session: TimerSession): void {
    this.stopRaf();
    const loop = () => {
      const current = this._session$.value;
      if (!current || current.state !== 'running') return;

      const now = Date.now();
      const remaining = current.stepDeadlineAt
        ? current.stepDeadlineAt - now
        : 0;

      if (remaining <= 0 && !this._transitioning) {
        this.advanceStep(current, now, false);
        return;
      }

      this.emitTick(current);
      this.rafId = requestAnimationFrame(loop);
    };

    this.ngZone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private advanceStep(session: TimerSession, now: number, manual: boolean): void {
    if (this._transitioning) return;
    this._transitioning = true;

    try {
      const nextIndex = session.currentStepGlobalIndex + 1;
      if (nextIndex >= session.expandedSteps.length) {
        // Sesión completada
        this.stopRaf();
        const completed: TimerSession = {
          ...session,
          state: 'completed',
          completedAt: now,
          stepsCompleted: session.expandedSteps.length,
          totalElapsedMs: session.totalElapsedMs + (session.stepStartedAt ? now - session.stepStartedAt : 0),
        };
        this.ngZone.run(() => {
          this._session$.next(completed);
          this._events$.next({ type: 'session-complete', session: completed });
          this.emitTick(completed);
        });
        return;
      }

      const nextStep = session.expandedSteps[nextIndex];
      const elapsed = session.stepStartedAt ? now - session.stepStartedAt : 0;
      const updated: TimerSession = {
        ...session,
        currentStepGlobalIndex: nextIndex,
        stepStartedAt: now,
        stepDeadlineAt: now + nextStep.step.durationSeconds * 1000,
        stepsCompleted: session.stepsCompleted + 1,
        totalElapsedMs: session.totalElapsedMs + elapsed,
      };

      this.ngZone.run(() => {
        this._session$.next(updated);
        this._events$.next({ type: 'step-start', session: updated, expandedStep: nextStep });
      });

      this.startRaf(updated);
    } finally {
      this._transitioning = false;
    }
  }

  private emitTick(session: TimerSession): void {
    const now = Date.now();
    let remainingMs: number;

    if (session.state === 'paused') {
      remainingMs = session.pausedRemainingMs ?? 0;
    } else if (session.state === 'running' && session.stepDeadlineAt) {
      remainingMs = Math.max(0, session.stepDeadlineAt - now);
    } else {
      remainingMs = 0;
    }

    const currentStep = session.expandedSteps[session.currentStepGlobalIndex] ?? null;
    const nextStep = session.expandedSteps[session.currentStepGlobalIndex + 1] ?? null;
    const totalRemainingMs = this.calcTotalRemainingMs(session, remainingMs);
    const isWarning = session.state === 'running' && remainingMs > 0
      && remainingMs <= this.warningBeforeEndMs;

    const tick: TimerTick = {
      session,
      remainingMs,
      totalRemainingMs,
      currentExpandedStep: currentStep,
      nextExpandedStep: nextStep,
      isWarning,
    };

    this.ngZone.run(() => {
      this._tick$.next(tick);
    });
  }

  private calcTotalRemainingMs(session: TimerSession, currentStepRemainingMs: number): number {
    let total = currentStepRemainingMs;
    for (let i = session.currentStepGlobalIndex + 1; i < session.expandedSteps.length; i++) {
      total += session.expandedSteps[i].step.durationSeconds * 1000;
    }
    return total;
  }

  private bindVisibilityEvents(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.onAppResume();
      }
    };
    this.pageShowHandler = () => this.onAppResume();

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
  }

  private onAppResume(): void {
    const session = this._session$.value;
    if (!session || session.state !== 'running') return;
    // Recalcular desde marcas de tiempo
    this.restoreSession(session);
  }
}
