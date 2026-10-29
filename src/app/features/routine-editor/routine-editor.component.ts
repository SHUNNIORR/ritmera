import {
  Component, OnInit, signal, computed, inject, Input
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { RoutineRepository } from '../../core/persistence/routine.repository';
import {
  Routine, RoutineBlock, RoutineStep, RoutineCategory, StepType, SCHEMA_VERSION
} from '../../core/timer-engine/timer-engine.types';
import {
  generateId, calcRoutineDurationSec, defaultRoutinePreferences, validateRoutine, formatDuration
} from '../../core/timer-engine/timer-engine.utils';
import { DurationInputComponent } from '../../shared/components/duration-input/duration-input.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

const STEP_TYPE_LABELS: Record<StepType, string> = {
  work: 'Trabajo',
  rest: 'Descanso',
  warmup: 'Calentamiento',
  cooldown: 'Vuelta a la calma',
  recovery: 'Recuperación',
  custom: 'Personalizada',
};

const CATEGORY_LABELS: Record<RoutineCategory, string> = {
  hiit: 'HIIT',
  strength: 'Fuerza',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  study: 'Estudio',
  custom: 'Personalizada',
};

const PALETTE_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

@Component({
  selector: 'app-routine-editor',
  standalone: true,
  imports: [RouterLink, FormsModule, ReactiveFormsModule, DurationInputComponent, ConfirmDialogComponent, DurationPipe],
  template: `
    <div class="editor-page">
      <header class="editor-header">
        <button class="btn btn-ghost btn-icon" (click)="onCancel()" aria-label="Volver">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 class="editor-title">{{ isNew ? 'Nueva rutina' : 'Editar rutina' }}</h1>
        <button class="btn btn-primary" (click)="onSave()" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : 'Guardar' }}
        </button>
      </header>

      @if (errors().length > 0) {
        <div class="editor-errors" role="alert" aria-live="assertive">
          <ul>
            @for (err of errors(); track err) {
              <li>{{ err }}</li>
            }
          </ul>
        </div>
      }

      <div class="editor-body">
        <!-- Panel izquierdo: datos de la rutina -->
        <section class="editor-meta card" aria-label="Datos de la rutina">
          <div class="form-field">
            <label class="form-label" for="routine-name">Nombre <span aria-hidden="true">*</span></label>
            <input id="routine-name" type="text" class="form-input"
                   [(ngModel)]="routineName" placeholder="Ej. Mi HIIT matutino"
                   maxlength="80" required aria-required="true"
                   [class.error]="nameError()" />
            @if (nameError()) {
              <span class="form-error" role="alert">El nombre es obligatorio.</span>
            }
          </div>

          <div class="form-field">
            <label class="form-label" for="routine-desc">Descripción</label>
            <textarea id="routine-desc" class="form-input" style="height:80px; resize:vertical;"
                      [(ngModel)]="routineDescription" placeholder="Opcional..."
                      maxlength="300"></textarea>
          </div>

          <div class="form-field">
            <label class="form-label">Categoría</label>
            <div class="category-select">
              @for (cat of categories; track cat) {
                <button class="chip" [class.active]="routineCategory === cat"
                        (click)="routineCategory = cat" [attr.aria-pressed]="routineCategory === cat">
                  {{ categoryLabel(cat) }}
                </button>
              }
            </div>
          </div>

          <div class="form-field">
            <label class="form-label">Color</label>
            <div class="color-palette" role="group" aria-label="Seleccionar color">
              @for (color of paletteColors; track color) {
                <button class="color-swatch" [style.background]="color"
                        [class.selected]="routineColor === color"
                        (click)="routineColor = color"
                        [attr.aria-label]="'Color ' + color"
                        [attr.aria-pressed]="routineColor === color">
                </button>
              }
            </div>
          </div>

          <!-- Duración total estimada -->
          <div class="duration-summary">
            <span class="duration-summary-label">Duración estimada:</span>
            <span class="duration-summary-value">{{ estimatedDuration() | duration }}</span>
          </div>
        </section>

        <!-- Panel derecho: bloques y etapas -->
        <section class="editor-blocks" aria-label="Bloques y etapas">
          @for (block of blocks; track block.id; let bi = $index) {
            <div class="block-card card">
              <div class="block-header">
                <input type="text" class="block-name-input"
                       [(ngModel)]="block.name" placeholder="Nombre del bloque"
                       [attr.aria-label]="'Nombre del bloque ' + (bi + 1)" />

                <div class="block-controls">
                  <label class="form-label" style="flex-direction:row;align-items:center;gap:var(--space-2)">
                    <span>Repeticiones:</span>
                    <input type="number" class="form-input" style="width:60px"
                           [(ngModel)]="block.repetitions" min="1" max="99"
                           [attr.aria-label]="'Repeticiones del bloque ' + (bi + 1)" />
                  </label>

                  <label class="form-label" style="flex-direction:row;align-items:center;gap:var(--space-2)">
                    <span>Descanso entre rondas (seg):</span>
                    <input type="number" class="form-input" style="width:70px"
                           [(ngModel)]="block.restBetweenRoundsSec" min="0" max="3600"
                           placeholder="0" [attr.aria-label]="'Descanso entre rondas del bloque ' + (bi + 1)" />
                  </label>

                  <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-sm)">
                    <input type="checkbox" [(ngModel)]="block.restAfterLastRound" />
                    Descanso tras última repetición
                  </label>
                </div>

                <div class="block-actions">
                  <button class="btn btn-ghost" (click)="moveBlock(bi, -1)" [disabled]="bi === 0"
                          aria-label="Subir bloque">↑</button>
                  <button class="btn btn-ghost" (click)="moveBlock(bi, 1)" [disabled]="bi === blocks.length - 1"
                          aria-label="Bajar bloque">↓</button>
                  <button class="btn btn-ghost" (click)="removeBlock(bi)"
                          aria-label="Eliminar bloque" [disabled]="blocks.length <= 1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Etapas del bloque -->
              <ul class="step-list" role="list" [attr.aria-label]="'Etapas del bloque ' + (bi + 1)">
                @for (step of block.steps; track step.id; let si = $index) {
                  <li class="step-item" [style.--step-color]="stepColor(step.type)">
                    <div class="step-dot" aria-hidden="true"></div>
                    <div class="step-content">
                      <div class="step-row">
                        <input type="text" class="step-name-input"
                               [(ngModel)]="step.name" placeholder="Nombre de la etapa"
                               [attr.aria-label]="'Nombre etapa ' + (si + 1) + ' bloque ' + (bi + 1)" />
                        <select class="form-input step-type-select"
                                [(ngModel)]="step.type"
                                [attr.aria-label]="'Tipo etapa ' + (si + 1)">
                          @for (type of stepTypes; track type) {
                            <option [value]="type">{{ stepTypeLabel(type) }}</option>
                          }
                        </select>
                      </div>

                      <div class="step-row">
                        <app-duration-input
                          [label]="'Duración etapa ' + (si + 1)"
                          [(ngModel)]="step.durationSeconds"
                          [showError]="step.durationSeconds < 1" />

                        <div class="step-flags">
                          <label class="step-flag">
                            <input type="checkbox" [(ngModel)]="step.soundOnStart" />
                            🔔 Inicio
                          </label>
                          <label class="step-flag">
                            <input type="checkbox" [(ngModel)]="step.soundOnEnd" />
                            🔔 Fin
                          </label>
                          <label class="step-flag">
                            <input type="checkbox" [(ngModel)]="step.voiceAnnouncement" />
                            🎤 Voz
                          </label>
                        </div>
                      </div>

                      <div class="step-actions">
                        <button class="btn btn-ghost" style="font-size:var(--font-size-xs)"
                                (click)="moveStep(bi, si, -1)" [disabled]="si === 0"
                                [attr.aria-label]="'Subir etapa ' + (si + 1)">↑</button>
                        <button class="btn btn-ghost" style="font-size:var(--font-size-xs)"
                                (click)="moveStep(bi, si, 1)" [disabled]="si === block.steps.length - 1"
                                [attr.aria-label]="'Bajar etapa ' + (si + 1)">↓</button>
                        <button class="btn btn-ghost" style="font-size:var(--font-size-xs)"
                                (click)="duplicateStep(bi, si)"
                                [attr.aria-label]="'Duplicar etapa ' + (si + 1)">📋</button>
                        <button class="btn btn-ghost" style="font-size:var(--font-size-xs);color:var(--color-error)"
                                (click)="removeStep(bi, si)" [disabled]="block.steps.length <= 1"
                                [attr.aria-label]="'Eliminar etapa ' + (si + 1)">🗑️</button>
                      </div>
                    </div>
                  </li>
                }
              </ul>

              <button class="btn btn-secondary" style="width:100%;margin-top:var(--space-3)"
                      (click)="addStep(bi)">
                + Añadir etapa
              </button>
            </div>
          }

          <button class="btn btn-secondary add-block-btn" (click)="addBlock()">
            + Añadir bloque
          </button>
        </section>
      </div>
    </div>

    @if (showCancelDialog()) {
      <app-confirm-dialog
        title="¿Descartar cambios?"
        message="Tienes cambios sin guardar. ¿Quieres salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        [isDanger]="true"
        (confirmed)="router.navigate(['/biblioteca'])"
        (cancelled)="showCancelDialog.set(false)" />
    }
  `,
  styles: [`
    .editor-page { max-width: var(--content-max-width); margin: 0 auto; padding: var(--space-4); }

    .editor-header {
      display: flex; align-items: center; gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .editor-title { flex: 1; font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); }

    .editor-errors {
      background: rgba(239,68,68,0.1); border: 1px solid var(--color-error);
      border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4); color: var(--color-error); font-size: var(--font-size-sm);
    }

    .editor-body {
      display: flex; flex-direction: column; gap: var(--space-4);
    }
    @media (min-width: 900px) {
      .editor-body { flex-direction: row; align-items: flex-start; }
      .editor-meta { width: 300px; flex-shrink: 0; position: sticky; top: calc(var(--header-height) + var(--space-4)); }
      .editor-blocks { flex: 1; }
    }

    .editor-meta { display: flex; flex-direction: column; gap: var(--space-4); }

    .category-select { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .color-palette { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .color-swatch {
      width: 32px; height: 32px; border-radius: var(--radius-full);
      border: 2px solid transparent; cursor: pointer; transition: transform var(--duration-fast);
    }
    .color-swatch.selected { border-color: white; transform: scale(1.2); }
    .color-swatch:hover { transform: scale(1.1); }

    .duration-summary {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3); background: var(--color-surface-2);
      border-radius: var(--radius-md); margin-top: var(--space-2);
    }
    .duration-summary-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
    .duration-summary-value { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-accent); font-family: var(--font-mono); }

    /* Bloques */
    .editor-blocks { display: flex; flex-direction: column; gap: var(--space-4); }
    .block-card { display: flex; flex-direction: column; gap: var(--space-3); }
    .block-header { display: flex; flex-direction: column; gap: var(--space-3); }
    .block-name-input {
      font-size: var(--font-size-md); font-weight: var(--font-weight-semibold);
      background: transparent; border: none; border-bottom: 1px solid var(--color-border-strong);
      color: var(--color-text-primary); padding: var(--space-1) 0; width: 100%;
    }
    .block-name-input:focus { outline: none; border-bottom-color: var(--color-accent); }
    .block-controls { display: flex; flex-direction: column; gap: var(--space-2); }
    .block-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }

    /* Etapas */
    .step-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }
    .step-item { display: flex; gap: var(--space-3); align-items: flex-start; }
    .step-dot {
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--step-color, var(--color-accent));
      flex-shrink: 0; margin-top: 14px;
    }
    .step-content { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
    .step-row { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: flex-start; }
    .step-name-input {
      flex: 1; min-width: 120px; height: var(--touch-target);
      padding: 0 var(--space-3); border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md); background: var(--color-surface-2);
      color: var(--color-text-primary); font-size: var(--font-size-sm);
    }
    .step-type-select {
      width: 140px; height: var(--touch-target); font-size: var(--font-size-sm);
    }
    .step-flags { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
    .step-flag { display: flex; align-items: center; gap: var(--space-1); font-size: var(--font-size-xs); cursor: pointer; }
    .step-actions { display: flex; gap: var(--space-1); }
    .add-block-btn { width: 100%; }
  `],
})
export class RoutineEditorComponent implements OnInit {
  @Input() id?: string; // route param

  router = inject(Router);
  private routineRepo = inject(RoutineRepository);

  // Estado del formulario
  routineName = '';
  routineDescription = '';
  routineCategory: RoutineCategory = 'custom';
  routineColor = PALETTE_COLORS[0];
  blocks: RoutineBlock[] = [];
  saving = signal(false);
  errors = signal<string[]>([]);
  showCancelDialog = signal(false);
  nameError = computed(() => this.errors().some(e => e.includes('nombre')));

  isNew = true;
  private originalRoutine?: Routine;
  paletteColors = PALETTE_COLORS;
  categories: RoutineCategory[] = ['hiit', 'strength', 'cardio', 'mobility', 'study', 'custom'];
  stepTypes: StepType[] = ['work', 'rest', 'warmup', 'cooldown', 'recovery', 'custom'];

  estimatedDuration = computed(() => {
    const routine = this.buildRoutine();
    return calcRoutineDurationSec(routine);
  });

  async ngOnInit(): Promise<void> {
    if (this.id) {
      this.isNew = false;
      const routine = await this.routineRepo.getById(this.id);
      if (routine) {
        this.loadRoutine(routine);
        this.originalRoutine = routine;
      } else {
        this.router.navigate(['/biblioteca']);
      }
    } else {
      this.addBlock();
    }
  }

  private loadRoutine(routine: Routine): void {
    this.routineName = routine.name;
    this.routineDescription = routine.description ?? '';
    this.routineCategory = routine.category;
    this.routineColor = routine.color;
    // Deep copy para no mutar el original
    this.blocks = JSON.parse(JSON.stringify(routine.blocks)) as RoutineBlock[];
  }

  addBlock(): void {
    this.blocks.push({
      id: generateId(),
      name: '',
      steps: [this.newStep()],
      repetitions: 1,
      restBetweenRoundsSec: undefined,
      restAfterLastRound: false,
    });
  }

  removeBlock(bi: number): void {
    if (this.blocks.length <= 1) return;
    this.blocks.splice(bi, 1);
  }

  moveBlock(bi: number, dir: -1 | 1): void {
    const target = bi + dir;
    if (target < 0 || target >= this.blocks.length) return;
    const tmp = this.blocks[bi];
    this.blocks[bi] = this.blocks[target];
    this.blocks[target] = tmp;
  }

  addStep(bi: number): void {
    this.blocks[bi].steps.push(this.newStep());
  }

  removeStep(bi: number, si: number): void {
    if (this.blocks[bi].steps.length <= 1) return;
    this.blocks[bi].steps.splice(si, 1);
  }

  duplicateStep(bi: number, si: number): void {
    const copy = { ...this.blocks[bi].steps[si], id: generateId() };
    this.blocks[bi].steps.splice(si + 1, 0, copy);
  }

  moveStep(bi: number, si: number, dir: -1 | 1): void {
    const steps = this.blocks[bi].steps;
    const target = si + dir;
    if (target < 0 || target >= steps.length) return;
    const tmp = steps[si];
    steps[si] = steps[target];
    steps[target] = tmp;
  }

  categoryLabel(cat: RoutineCategory): string {
    return CATEGORY_LABELS[cat] ?? cat;
  }

  stepTypeLabel(type: StepType): string {
    return STEP_TYPE_LABELS[type] ?? type;
  }

  stepColor(type: StepType): string {
    const map: Record<StepType, string> = {
      work: 'var(--color-step-work)',
      rest: 'var(--color-step-rest)',
      warmup: 'var(--color-step-warmup)',
      cooldown: 'var(--color-step-cooldown)',
      recovery: 'var(--color-step-recovery)',
      custom: 'var(--color-step-custom)',
    };
    return map[type];
  }

  async onSave(): Promise<void> {
    const routine = this.buildRoutine();
    const validationErrors = validateRoutine(routine);
    this.errors.set(validationErrors);
    if (validationErrors.length) return;

    this.saving.set(true);
    try {
      if (this.isNew) {
        await this.routineRepo.create(routine);
      } else {
        await this.routineRepo.save({ ...routine, id: this.id! });
      }
      this.router.navigate(['/biblioteca']);
    } catch (err) {
      this.errors.set(['Error al guardar. Inténtalo de nuevo.']);
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    // Si hay cambios, pedir confirmación
    const hasChanges = this.routineName !== (this.originalRoutine?.name ?? '');
    if (hasChanges || (!this.isNew && this.originalRoutine)) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/biblioteca']);
    }
  }

  private buildRoutine(): Routine {
    const now = Date.now();
    return {
      id: this.id ?? generateId(),
      name: this.routineName.trim(),
      description: this.routineDescription.trim() || undefined,
      category: this.routineCategory,
      color: this.routineColor,
      tags: [],
      isFavorite: this.originalRoutine?.isFavorite ?? false,
      blocks: this.blocks,
      preferences: this.originalRoutine?.preferences ?? defaultRoutinePreferences(),
      createdAt: this.originalRoutine?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  private newStep(): RoutineStep {
    return {
      id: generateId(),
      name: 'Trabajo',
      type: 'work',
      durationSeconds: 30,
      soundOnStart: true,
      soundOnEnd: false,
      voiceAnnouncement: false,
    };
  }
}
