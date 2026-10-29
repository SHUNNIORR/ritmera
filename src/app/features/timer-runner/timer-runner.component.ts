import {
  Component, OnInit, OnDestroy, signal, computed, inject, Input
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TimerEngineService, TimerTick, TimerEngineEvent } from '../../core/timer-engine/timer-engine.service';
import { RoutineRepository } from '../../core/persistence/routine.repository';
import { SessionRepository } from '../../core/persistence/session.repository';
import { SettingsRepository } from '../../core/persistence/settings.repository';
import { AudioService } from '../../core/audio/audio.service';
import { SpeechService } from '../../core/audio/speech.service';
import { WakeLockService } from '../../core/pwa/wake-lock.service';
import {
  Routine, TimerSession, ExpandedStep, StepType, AppSettings, SCHEMA_VERSION
} from '../../core/timer-engine/timer-engine.types';
import {
  generateId, formatDuration, msToSecsCeil, defaultRoutinePreferences
} from '../../core/timer-engine/timer-engine.utils';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-timer-runner',
  standalone: true,
  imports: [CommonModule, RouterLink, DurationPipe, ConfirmDialogComponent],
  template: `
    <div class="runner-page" [style.--step-bg]="currentStepColor()">
      <!-- Barra superior / Header del runner -->
      <header class="runner-top-bar">
        <button class="btn btn-ghost btn-icon" (click)="requestExit()" aria-label="Salir de la rutina">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div class="runner-routine-meta">
          <h1 class="routine-title">{{ session()?.routineName || 'Temporizador' }}</h1>
          <span class="round-badge" *ngIf="currentBlockInfo()">
            Ronda {{ currentBlockInfo()?.repetition }} / {{ currentBlockInfo()?.totalRepetitions }}
          </span>
        </div>

        <button class="btn btn-ghost btn-icon" (click)="toggleAudio()" [attr.aria-label]="audioEnabled() ? 'Silenciar' : 'Activar sonido'">
          <svg *ngIf="audioEnabled()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <svg *ngIf="!audioEnabled()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        </button>
      </header>

      <!-- Estado: Finalizado -->
      <section *ngIf="isCompleted()" class="runner-summary card" aria-live="polite">
        <div class="celebration-badge" aria-hidden="true">🎉</div>
        <h2 class="summary-title">¡Entrenamiento Completado!</h2>
        <p class="summary-subtitle">Excelente trabajo, has completado todas las etapas de la rutina.</p>

        <div class="summary-stats">
          <div class="stat-card">
            <span class="stat-label">Tiempo total</span>
            <span class="stat-val">{{ (session()?.totalElapsedMs || 0) / 1000 | duration }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Etapas hechas</span>
            <span class="stat-val">{{ session()?.stepsCompleted }} / {{ session()?.expandedSteps?.length }}</span>
          </div>
        </div>

        <div class="summary-actions">
          <button class="btn btn-secondary" (click)="restartEntireSession()">
            Repetir rutina
          </button>
          <a routerLink="/biblioteca" class="btn btn-primary">
            Volver a la biblioteca
          </a>
        </div>
      </section>

      <!-- Estado: En ejecución o Pausado -->
      <main *ngIf="!isCompleted()" class="runner-main" [class.paused]="isPaused()" [class.warning]="tick()?.isWarning">
        <!-- Indicador de tipo de etapa -->
        <div class="step-indicator-tag" [class.work]="currentStepType() === 'work'" [class.rest]="currentStepType() === 'rest'">
          <span class="indicator-dot"></span>
          <span class="indicator-text">{{ stepTypeLabel(currentStepType()) }}</span>
        </div>

        <h2 class="current-step-name">{{ currentStep()?.step?.name || 'Preparado' }}</h2>

        <!-- Reloj principal con fuentes tabulares para no saltar -->
        <div class="clock-display" [attr.aria-label]="'Tiempo restante ' + remainingSecondsFormatted()">
          <span class="time-numbers">{{ remainingSecondsFormatted() }}</span>
        </div>

        <!-- Barra de progreso visual -->
        <div class="progress-bar-container" role="progressbar"
             [attr.aria-valuenow]="stepProgressPercent()"
             aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar-fill" [style.width.%]="stepProgressPercent()"></div>
        </div>

        <!-- Ajustes rápidos de tiempo (+/- 10s) -->
        <div class="time-adjustments" aria-label="Ajustar tiempo de etapa actual">
          <button class="btn btn-ghost chip" (click)="adjustTime(-10)" aria-label="Restar 10 segundos">-10s</button>
          <button class="btn btn-ghost chip" (click)="adjustTime(10)" aria-label="Sumar 10 segundos">+10s</button>
        </div>

        <!-- Próxima etapa -->
        <div class="next-step-preview" *ngIf="nextExpandedStep()">
          <span class="next-label">A continuación:</span>
          <span class="next-title">{{ nextExpandedStep()?.step?.name }} ({{ nextExpandedStep()?.step?.durationSeconds | duration }})</span>
        </div>

        <!-- Tiempos totales acumulados -->
        <div class="overall-progress" *ngIf="settings()?.showElapsedTime">
          <span>Restante total: {{ (tick()?.totalRemainingMs || 0) / 1000 | duration }}</span>
        </div>

        <!-- Controles primarios accesibles y grandes -->
        <div class="runner-controls" role="group" aria-label="Controles del temporizador">
          <button class="btn btn-secondary control-btn"
                  (click)="prevStep()"
                  [disabled]="!canGoPrev()"
                  aria-label="Etapa anterior">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
          </button>

          <button class="btn btn-primary play-pause-btn"
                  (click)="togglePlayPause()"
                  [attr.aria-label]="isPaused() ? 'Reanudar temporizador' : 'Pausar temporizador'">
            <svg *ngIf="!isPaused()" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"></rect>
              <rect x="14" y="4" width="4" height="16" rx="1"></rect>
            </svg>
            <svg *ngIf="isPaused()" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          </button>

          <button class="btn btn-secondary control-btn"
                  (click)="nextStep()"
                  aria-label="Siguiente etapa">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
        </div>

        <!-- Botones secundarios: Reiniciar etapa y Finalizar -->
        <div class="secondary-controls">
          <button class="btn btn-ghost" (click)="restartCurrentStep()">
            Reiniciar etapa
          </button>
          <button class="btn btn-ghost danger-text" (click)="requestExit()">
            Finalizar sesión
          </button>
        </div>
      </main>
    </div>

    <!-- Confirmación al salir anticipadamente -->
    <app-confirm-dialog
      *ngIf="showExitConfirm()"
      title="¿Finalizar entrenamiento?"
      message="¿Seguro que deseas salir antes de terminar? La sesión se registrará como interrumpida."
      confirmLabel="Finalizar"
      cancelLabel="Continuar entrenando"
      [isDanger]="true"
      (confirmed)="confirmExit()"
      (cancelled)="showExitConfirm.set(false)" />
  `,
  styles: [`
    .runner-page {
      min-height: calc(100dvh - var(--header-height));
      display: flex;
      flex-direction: column;
      background: radial-gradient(circle at top, var(--step-bg, var(--color-bg-primary)) 0%, var(--color-bg-primary) 70%);
      padding: var(--space-4);
      max-width: 600px;
      margin: 0 auto;
      transition: background 0.4s ease;
    }

    .runner-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .runner-routine-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      overflow: hidden;
    }
    .routine-title {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
    }
    .round-badge {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      background: var(--color-surface-2);
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      margin-top: 2px;
    }

    .runner-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: var(--space-3);
    }

    .step-indicator-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-surface-3);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .step-indicator-tag.work { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .step-indicator-tag.rest { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .current-step-name {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      margin: var(--space-1) 0;
      min-height: 40px;
    }

    .clock-display {
      font-family: var(--font-mono);
      font-size: var(--font-size-timer);
      font-weight: var(--font-weight-bold);
      font-variant-numeric: tabular-nums;
      line-height: 1;
      color: var(--color-text-primary);
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      user-select: none;
    }
    .warning .clock-display {
      color: var(--color-warning);
      animation: pulse 0.5s infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.03); }
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: var(--color-surface-3);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin: var(--space-2) 0;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--color-accent);
      border-radius: var(--radius-full);
      transition: width 0.1s linear;
    }

    .time-adjustments {
      display: flex;
      gap: var(--space-3);
    }

    .next-step-preview {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      background: var(--color-surface-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-lg);
    }
    .next-label {
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
    }

    .overall-progress {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      font-family: var(--font-mono);
    }

    .runner-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-5);
      margin-top: var(--space-4);
    }
    .control-btn {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .play-pause-btn {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-accent);
    }

    .secondary-controls {
      display: flex;
      gap: var(--space-4);
      margin-top: var(--space-2);
    }
    .danger-text {
      color: var(--color-error);
    }

    /* Resumen post-entrenamiento */
    .runner-summary {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-4);
      padding: var(--space-8) var(--space-4);
      margin-top: var(--space-6);
    }
    .celebration-badge {
      font-size: 4rem;
      animation: bounce 1s infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-10px); }
    }
    .summary-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
    }
    .summary-subtitle {
      color: var(--color-text-secondary);
      max-width: 380px;
    }
    .summary-stats {
      display: flex;
      gap: var(--space-4);
      width: 100%;
      max-width: 320px;
      margin: var(--space-3) 0;
    }
    .stat-card {
      flex: 1;
      background: var(--color-surface-2);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .stat-val {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-accent);
      font-family: var(--font-mono);
    }
    .summary-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      width: 100%;
      max-width: 320px;
    }
  `],
})
export class TimerRunnerComponent implements OnInit, OnDestroy {
  @Input() id?: string; // id de rutina o undefined para rápido

  private router = inject(Router);
  private timerEngine = inject(TimerEngineService);
  private routineRepo = inject(RoutineRepository);
  private sessionRepo = inject(SessionRepository);
  private settingsRepo = inject(SettingsRepository);
  private audioService = inject(AudioService);
  private speechService = inject(SpeechService);
  private wakeLock = inject(WakeLockService);

  private subs = new Subscription();

  session = signal<TimerSession | null>(null);
  tick = signal<TimerTick | null>(null);
  settings = signal<AppSettings | null>(null);
  audioEnabled = signal<boolean>(true);
  showExitConfirm = signal<boolean>(false);

  currentStep = computed(() => this.tick()?.currentExpandedStep ?? null);
  nextExpandedStep = computed(() => this.tick()?.nextExpandedStep ?? null);

  isPaused = computed(() => this.session()?.state === 'paused');
  isCompleted = computed(() => this.session()?.state === 'completed');

  remainingSecondsFormatted = computed(() => {
    const ms = this.tick()?.remainingMs ?? 0;
    return formatDuration(msToSecsCeil(ms));
  });

  currentStepType = computed<StepType>(() => {
    return this.currentStep()?.step.type ?? 'work';
  });

  currentStepColor = computed(() => {
    const type = this.currentStepType();
    switch (type) {
      case 'work': return 'rgba(239, 68, 68, 0.15)';
      case 'rest': return 'rgba(34, 197, 94, 0.15)';
      case 'warmup': return 'rgba(249, 115, 22, 0.15)';
      case 'cooldown': return 'rgba(59, 130, 246, 0.15)';
      default: return 'transparent';
    }
  });

  stepProgressPercent = computed(() => {
    const step = this.currentStep();
    if (!step) return 0;
    const totalMs = step.step.durationSeconds * 1000;
    const remainingMs = this.tick()?.remainingMs ?? 0;
    const elapsed = Math.max(0, totalMs - remainingMs);
    return Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
  });

  currentBlockInfo = computed(() => {
    const step = this.currentStep();
    const sess = this.session();
    if (!step || !sess) return null;
    const block = sess.routineSnapshot.blocks[step.blockIndex];
    if (!block) return null;
    return {
      repetition: step.repetitionIndex + 1,
      totalRepetitions: block.repetitions
    };
  });

  async ngOnInit(): Promise<void> {
    const appSettings = await this.settingsRepo.get();
    this.settings.set(appSettings);
    this.audioEnabled.set(appSettings.soundEnabled);
    this.audioService.setEnabled(appSettings.soundEnabled);
    this.speechService.setEnabled(appSettings.voiceEnabled);
    this.timerEngine.setWarningBeforeEndMs(appSettings.warningBeforeEndSec * 1000);

    // Audio context initialization on user navigation
    this.audioService.initContext();

    if (appSettings.keepScreenAwake) {
      this.wakeLock.acquire();
    }

    this.subscribeEngine();

    // Check for active session recovery
    const active = await this.sessionRepo.getActiveSession();
    if (active && (active.state === 'running' || active.state === 'paused')) {
      // If active session belongs to the requested route (or quick timer)
      if (!this.id || active.routineId === this.id) {
        this.timerEngine.restoreSession(active);
        return;
      }
    }

    await this.initSession();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.wakeLock.release();
  }

  private subscribeEngine(): void {
    this.subs.add(
      this.timerEngine.session$.subscribe(s => {
        this.session.set(s);
        if (s) {
          if (s.state === 'running' || s.state === 'paused') {
            this.sessionRepo.saveActiveSession(s);
          } else if (s.state === 'completed' || s.state === 'cancelled') {
            this.sessionRepo.clearActiveSession(s.id);
            this.persistToHistory(s);
          }
        }
      })
    );

    this.subs.add(
      this.timerEngine.tick$.subscribe(t => {
        this.tick.set(t);
      })
    );

    this.subs.add(
      this.timerEngine.events$.subscribe(e => {
        this.handleEngineEvent(e);
      })
    );
  }

  private async initSession(): Promise<void> {
    let routine: Routine | undefined;

    if (this.id) {
      routine = await this.routineRepo.getById(this.id);
      if (routine) {
        await this.routineRepo.markUsed(routine.id);
      }
    }

    if (!routine) {
      // Temporizador rápido por defecto: 3 rondas 45s trabajo / 15s descanso
      routine = this.createQuickTimerRoutine();
    }

    this.timerEngine.startSession(routine);
  }

  private createQuickTimerRoutine(): Routine {
    const now = Date.now();
    return {
      id: generateId(),
      name: 'Temporizador Rápido',
      category: 'custom',
      color: '#FF6B35',
      tags: ['rapido'],
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      preferences: defaultRoutinePreferences(),
      blocks: [
        {
          id: generateId(),
          name: 'Rondas rápidas',
          repetitions: 3,
          restBetweenRoundsSec: 15,
          restAfterLastRound: false,
          steps: [
            {
              id: generateId(),
              name: 'Trabajo',
              type: 'work',
              durationSeconds: 45,
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            }
          ]
        }
      ]
    };
  }

  private handleEngineEvent(event: TimerEngineEvent): void {
    if (!this.audioEnabled()) return;

    switch (event.type) {
      case 'step-start':
        this.audioService.play('start');
        if (event.expandedStep?.step.voiceAnnouncement) {
          const text = event.expandedStep.step.customAnnouncementText || event.expandedStep.step.name;
          this.speechService.speak(text);
        }
        break;
      case 'warning':
        this.audioService.play('warning');
        break;
      case 'session-complete':
        this.audioService.play('complete');
        this.speechService.speak('¡Entrenamiento completado!');
        this.wakeLock.release();
        break;
    }
  }

  private async persistToHistory(session: TimerSession): Promise<void> {
    const plannedSec = session.expandedSteps.reduce((acc, es) => acc + es.step.durationSeconds, 0);
    await this.sessionRepo.addHistoryEntry({
      sessionId: session.id,
      routineId: session.routineId,
      routineName: session.routineName,
      routineSnapshot: {
        id: session.routineSnapshot.id,
        name: session.routineSnapshot.name,
        category: session.routineSnapshot.category,
        color: session.routineSnapshot.color,
        blocks: session.routineSnapshot.blocks,
      },
      startedAt: session.startedAt || Date.now(),
      endedAt: session.completedAt || Date.now(),
      plannedDurationSec: plannedSec,
      actualDurationMs: session.totalElapsedMs,
      stepsCompleted: session.stepsCompleted,
      totalSteps: session.expandedSteps.length,
      status: session.state === 'completed' ? 'completed' : 'interrupted',
    });
  }

  togglePlayPause(): void {
    this.audioService.initContext();
    if (this.isPaused()) {
      this.timerEngine.resume();
    } else {
      this.timerEngine.pause();
    }
  }

  nextStep(): void {
    this.timerEngine.nextStep();
  }

  prevStep(): void {
    this.timerEngine.prevStep();
  }

  canGoPrev(): boolean {
    const s = this.session();
    return !!s && s.currentStepGlobalIndex > 0;
  }

  restartCurrentStep(): void {
    this.timerEngine.restartStep();
  }

  adjustTime(deltaSec: number): void {
    this.timerEngine.adjustCurrentStepTime(deltaSec);
  }

  restartEntireSession(): void {
    const sess = this.session();
    if (sess) {
      this.timerEngine.startSession(sess.routineSnapshot);
    }
  }

  toggleAudio(): void {
    const current = this.audioEnabled();
    this.audioEnabled.set(!current);
    this.audioService.setEnabled(!current);
    this.speechService.setEnabled(!current);
  }

  requestExit(): void {
    if (this.isCompleted()) {
      this.router.navigate(['/biblioteca']);
      return;
    }
    this.timerEngine.pause();
    this.showExitConfirm.set(true);
  }

  async confirmExit(): Promise<void> {
    this.showExitConfirm.set(false);
    this.timerEngine.cancel();
    this.router.navigate(['/biblioteca']);
  }

  stepTypeLabel(type: StepType): string {
    const map: Record<StepType, string> = {
      work: 'Trabajo',
      rest: 'Descanso',
      warmup: 'Calentamiento',
      cooldown: 'Vuelta a la calma',
      recovery: 'Recuperación',
      custom: 'Personalizada',
    };
    return map[type] || type;
  }
}
