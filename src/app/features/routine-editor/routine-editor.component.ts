import {
  Component, OnInit, signal, computed, inject, Input
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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

export type RoutineEditorMode = 'tabata' | 'hiit' | 'emom' | 'pomodoro' | 'custom';

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

interface TemplateOption {
  key: RoutineEditorMode;
  icon: string;
  name: string;
  tagline: string;
}

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
        <div class="header-titles">
          <h1 class="editor-title">{{ isNew ? 'Crear rutina' : 'Editar rutina' }}</h1>
          <span class="editor-subtitle">
            {{ editorMode() === 'custom' ? 'Modo avanzado (etapas libres)' : 'Plantilla rápida: ' + currentTemplateName() }}
          </span>
        </div>
        <button class="btn btn-primary" (click)="onSave()" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : 'Guardar rutina' }}
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

      <!-- SELECTOR DE PLANTILLA / TIPO DE ENTRENAMIENTO -->
      @if (isNew) {
        <section class="template-selector card" aria-label="Seleccionar tipo de rutina">
          <div class="selector-header">
            <span class="selector-title">¿Qué tipo de entrenamiento quieres crear?</span>
            <span class="selector-hint">Elige una plantilla y solo te pediremos los datos necesarios:</span>
          </div>

          <div class="template-cards-grid" role="radiogroup" aria-label="Tipo de rutina">
            @for (tpl of templateOptions; track tpl.key) {
              <button
                type="button"
                class="template-card-btn"
                [class.selected]="editorMode() === tpl.key"
                (click)="selectMode(tpl.key)"
                [attr.aria-checked]="editorMode() === tpl.key"
                role="radio">
                <span class="template-icon" aria-hidden="true">{{ tpl.icon }}</span>
                <span class="template-name">{{ tpl.name }}</span>
                <span class="template-desc">{{ tpl.tagline }}</span>
              </button>
            }
          </div>
        </section>
      }

      <!-- RESUMEN EN VIVO DE DURACIÓN Y RONDAS -->
      <section class="live-summary-card card" [style.--accent-color]="routineColor">
        <div class="summary-left">
          <span class="summary-badge">{{ categoryLabel(routineCategory) }}</span>
          <span class="summary-total-time">{{ estimatedDuration() | duration }}</span>
          <span class="summary-label">Duración total estimada</span>
        </div>
        <div class="summary-right">
          <span class="summary-description">{{ quickSummaryText() }}</span>
          @if (editorMode() !== 'custom') {
            <button class="btn btn-ghost btn-sm customize-btn" (click)="switchToCustomMode()">
              ⚙️ Personalizar detalles en modo avanzado
            </button>
          } @else {
            <span class="custom-badge">Modo etapas libres activo</span>
          }
        </div>
      </section>

      <!-- FORMULARIO GUIADO POR TIPO -->
      <div class="editor-body">

        <!-- 1. PLANTILLA: TABATA -->
        @if (editorMode() === 'tabata') {
          <div class="guided-form card">
            <h2 class="form-section-title">⚡ Configuración Tabata Clásico</h2>
            <p class="form-section-desc">Entrenamiento por intervalos de alta intensidad: trabajo intenso y descansos cortos.</p>

            <div class="form-grid">
              <div class="form-field full-width">
                <label class="form-label" for="tabata-name">Nombre de la rutina <span aria-hidden="true">*</span></label>
                <input id="tabata-name" type="text" class="form-input" [(ngModel)]="routineName" placeholder="Ej. Tabata de Piernas" />
              </div>

              <div class="form-field">
                <label class="form-label">Rondas (repeticiones)</label>
                <div class="counter-input">
                  <button type="button" class="btn btn-secondary counter-btn" (click)="tabataRounds = Math.max(1, tabataRounds - 1)">-</button>
                  <input type="number" class="form-input num-field" [(ngModel)]="tabataRounds" min="1" max="99" />
                  <button type="button" class="btn btn-secondary counter-btn" (click)="tabataRounds = tabataRounds + 1">+</button>
                </div>
                <span class="form-hint">Tradicionalmente 8 rondas (4 min)</span>
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de trabajo</label>
                <app-duration-input label="Trabajo" [(ngModel)]="tabataWorkSec" />
                <span class="form-hint">Recomendado: 20 seg</span>
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de descanso</label>
                <app-duration-input label="Descanso" [(ngModel)]="tabataRestSec" />
                <span class="form-hint">Recomendado: 10 seg</span>
              </div>

              <div class="form-field">
                <label class="form-label">Calentamiento previo (opcional)</label>
                <app-duration-input label="Calentamiento" [(ngModel)]="warmupSec" />
                <span class="form-hint">0 = sin calentamiento</span>
              </div>
            </div>
          </div>
        }

        <!-- 2. PLANTILLA: HIIT / INTERVALOS -->
        @if (editorMode() === 'hiit') {
          <div class="guided-form card">
            <h2 class="form-section-title">🔥 Configuración HIIT / Intervalos</h2>
            <p class="form-section-desc">Intervalos personalizados de trabajo y recuperación para fuerza o cardio.</p>

            <div class="form-grid">
              <div class="form-field full-width">
                <label class="form-label" for="hiit-name">Nombre de la rutina <span aria-hidden="true">*</span></label>
                <input id="hiit-name" type="text" class="form-input" [(ngModel)]="routineName" placeholder="Ej. HIIT 40/20 Quema Grasa" />
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de trabajo por ronda</label>
                <app-duration-input label="Trabajo" [(ngModel)]="hiitWorkSec" />
                <span class="form-hint">Ej. 40 segundos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de descanso por ronda</label>
                <app-duration-input label="Descanso" [(ngModel)]="hiitRestSec" />
                <span class="form-hint">Ej. 20 segundos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Rondas por serie</label>
                <div class="counter-input">
                  <button type="button" class="btn btn-secondary counter-btn" (click)="hiitRounds = Math.max(1, hiitRounds - 1)">-</button>
                  <input type="number" class="form-input num-field" [(ngModel)]="hiitRounds" min="1" max="99" />
                  <button type="button" class="btn btn-secondary counter-btn" (click)="hiitRounds = hiitRounds + 1">+</button>
                </div>
              </div>

              <div class="form-field">
                <label class="form-label">Series totales</label>
                <div class="counter-input">
                  <button type="button" class="btn btn-secondary counter-btn" (click)="hiitSeries = Math.max(1, hiitSeries - 1)">-</button>
                  <input type="number" class="form-input num-field" [(ngModel)]="hiitSeries" min="1" max="10" />
                  <button type="button" class="btn btn-secondary counter-btn" (click)="hiitSeries = hiitSeries + 1">+</button>
                </div>
              </div>

              @if (hiitSeries > 1) {
                <div class="form-field">
                  <label class="form-label">Descanso entre series</label>
                  <app-duration-input label="Descanso series" [(ngModel)]="hiitRestBetweenSeriesSec" />
                  <span class="form-hint">Recuperación larga entre series (ej. 1 min)</span>
                </div>
              }

              <div class="form-field">
                <label class="form-label">Calentamiento inicial (opcional)</label>
                <app-duration-input label="Calentamiento" [(ngModel)]="warmupSec" />
              </div>

              <div class="form-field">
                <label class="form-label">Vuelta a la calma (opcional)</label>
                <app-duration-input label="Vuelta a la calma" [(ngModel)]="cooldownSec" />
              </div>
            </div>
          </div>
        }

        <!-- 3. PLANTILLA: EMOM -->
        @if (editorMode() === 'emom') {
          <div class="guided-form card">
            <h2 class="form-section-title">⏱️ Configuración EMOM (Every Minute on the Minute)</h2>
            <p class="form-section-desc">Realiza el ejercicio al inicio de cada minuto. El resto del minuto es tu descanso automático.</p>

            <div class="form-grid">
              <div class="form-field full-width">
                <label class="form-label" for="emom-name">Nombre de la rutina <span aria-hidden="true">*</span></label>
                <input id="emom-name" type="text" class="form-input" [(ngModel)]="routineName" placeholder="Ej. EMOM Fuerza 10 min" />
              </div>

              <div class="form-field">
                <label class="form-label">Minutos totales (rondas)</label>
                <div class="counter-input">
                  <button type="button" class="btn btn-secondary counter-btn" (click)="emomMinutes = Math.max(1, emomMinutes - 1)">-</button>
                  <input type="number" class="form-input num-field" [(ngModel)]="emomMinutes" min="1" max="60" />
                  <button type="button" class="btn btn-secondary counter-btn" (click)="emomMinutes = emomMinutes + 1">+</button>
                </div>
                <span class="form-hint">1 ronda por cada minuto</span>
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo objetivo de trabajo</label>
                <app-duration-input label="Trabajo" [(ngModel)]="emomWorkSec" />
                <span class="form-hint">Ej. 40 segundos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Descanso calculado automáticamente</label>
                <div class="readonly-badge">
                  <span>{{ Math.max(0, 60 - emomWorkSec) }} segundos de descanso</span>
                </div>
                <span class="form-hint">Completará los 60s de cada minuto</span>
              </div>

              <div class="form-field">
                <label class="form-label">Calentamiento inicial (opcional)</label>
                <app-duration-input label="Calentamiento" [(ngModel)]="warmupSec" />
              </div>
            </div>
          </div>
        }

        <!-- 4. PLANTILLA: POMODORO -->
        @if (editorMode() === 'pomodoro') {
          <div class="guided-form card">
            <h2 class="form-section-title">🍅 Configuración Pomodoro / Concentración</h2>
            <p class="form-section-desc">Intervalos de estudio, programación o foco mental con pausas estructuradas.</p>

            <div class="form-grid">
              <div class="form-field full-width">
                <label class="form-label" for="pomodoro-name">Nombre de la rutina <span aria-hidden="true">*</span></label>
                <input id="pomodoro-name" type="text" class="form-input" [(ngModel)]="routineName" placeholder="Ej. Pomodoro Sesión de Estudio" />
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de concentración / foco</label>
                <app-duration-input label="Foco" [(ngModel)]="pomodoroWorkSec" />
                <span class="form-hint">Estándar: 25 minutos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Tiempo de descanso corto</label>
                <app-duration-input label="Descanso corto" [(ngModel)]="pomodoroRestSec" />
                <span class="form-hint">Estándar: 5 minutos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Ciclos (repeticiones)</label>
                <div class="counter-input">
                  <button type="button" class="btn btn-secondary counter-btn" (click)="pomodoroCycles = Math.max(1, pomodoroCycles - 1)">-</button>
                  <input type="number" class="form-input num-field" [(ngModel)]="pomodoroCycles" min="1" max="12" />
                  <button type="button" class="btn btn-secondary counter-btn" (click)="pomodoroCycles = pomodoroCycles + 1">+</button>
                </div>
                <span class="form-hint">Estándar: 4 ciclos</span>
              </div>

              <div class="form-field">
                <label class="form-label">Descanso largo final (opcional)</label>
                <app-duration-input label="Descanso largo" [(ngModel)]="pomodoroLongRestSec" />
                <span class="form-hint">Estándar: 15-30 minutos al terminar los ciclos</span>
              </div>
            </div>
          </div>
        }

        <!-- 5. MODO PERSONALIZADO / AVANZADO (Secuencia libre) -->
        @if (editorMode() === 'custom') {
          <div class="custom-mode-layout">
            <!-- Columna lateral: Metadatos -->
            <section class="editor-meta card" aria-label="Datos de la rutina">
              <div class="form-field">
                <label class="form-label" for="routine-name">Nombre <span aria-hidden="true">*</span></label>
                <input id="routine-name" type="text" class="form-input"
                       [(ngModel)]="routineName" placeholder="Ej. Mi HIIT personalizado"
                       maxlength="80" required aria-required="true" />
              </div>

              <div class="form-field">
                <label class="form-label" for="routine-desc">Descripción</label>
                <textarea id="routine-desc" class="form-input" style="height:70px; resize:vertical;"
                          [(ngModel)]="routineDescription" placeholder="Opcional..."
                          maxlength="300"></textarea>
              </div>

              <div class="form-field">
                <label class="form-label">Categoría</label>
                <div class="category-select">
                  @for (cat of categories; track cat) {
                    <button type="button" class="chip" [class.active]="routineCategory === cat"
                            (click)="routineCategory = cat" [attr.aria-pressed]="routineCategory === cat">
                      {{ categoryLabel(cat) }}
                    </button>
                  }
                </div>
              </div>

              <div class="form-field">
                <label class="form-label">Color identificador</label>
                <div class="color-palette" role="group" aria-label="Seleccionar color">
                  @for (color of paletteColors; track color) {
                    <button type="button" class="color-swatch" [style.background]="color"
                            [class.selected]="routineColor === color"
                            (click)="routineColor = color"
                            [attr.aria-label]="'Color ' + color"
                            [attr.aria-pressed]="routineColor === color">
                    </button>
                  }
                </div>
              </div>
            </section>

            <!-- Columna principal: Bloques y Etapas -->
            <section class="editor-blocks" aria-label="Bloques y etapas">
              <div class="blocks-header">
                <h3 class="blocks-title">Secuencia de Bloques y Etapas</h3>
                <span class="blocks-hint">Crea o reordena tantas etapas y repeticiones como desees:</span>
              </div>

              @for (block of blocks; track block.id; let bi = $index) {
                <div class="block-card card">
                  <div class="block-top-row">
                    <input type="text" class="block-name-input"
                           [(ngModel)]="block.name" placeholder="Nombre del bloque (opcional)"
                           [attr.aria-label]="'Nombre del bloque ' + (bi + 1)" />

                    <div class="block-actions">
                      <button type="button" class="btn btn-ghost" (click)="moveBlock(bi, -1)" [disabled]="bi === 0" aria-label="Subir bloque">↑</button>
                      <button type="button" class="btn btn-ghost" (click)="moveBlock(bi, 1)" [disabled]="bi === blocks.length - 1" aria-label="Bajar bloque">↓</button>
                      <button type="button" class="btn btn-ghost" (click)="removeBlock(bi)" aria-label="Eliminar bloque" [disabled]="blocks.length <= 1">🗑️</button>
                    </div>
                  </div>

                  <div class="block-settings-row">
                    <label class="inline-label">
                      <span>Rondas:</span>
                      <input type="number" class="form-input num-field" [(ngModel)]="block.repetitions" min="1" max="99" />
                    </label>

                    <label class="inline-label">
                      <span>Descanso entre rondas (seg):</span>
                      <input type="number" class="form-input num-field" style="width:75px" [(ngModel)]="block.restBetweenRoundsSec" min="0" placeholder="0" />
                    </label>

                    <label class="checkbox-label">
                      <input type="checkbox" [(ngModel)]="block.restAfterLastRound" />
                      <span>Descanso tras última ronda</span>
                    </label>
                  </div>

                  <!-- Etapas -->
                  <ul class="step-list" role="list">
                    @for (step of block.steps; track step.id; let si = $index) {
                      <li class="step-item" [style.--step-color]="stepColor(step.type)">
                        <div class="step-dot" aria-hidden="true"></div>
                        <div class="step-content">
                          <div class="step-row">
                            <input type="text" class="step-name-input" [(ngModel)]="step.name" placeholder="Nombre etapa" />
                            <select class="form-input step-type-select" [(ngModel)]="step.type">
                              @for (type of stepTypes; track type) {
                                <option [value]="type">{{ stepTypeLabel(type) }}</option>
                              }
                            </select>
                          </div>

                          <div class="step-row">
                            <app-duration-input [label]="'Duración etapa ' + (si + 1)" [(ngModel)]="step.durationSeconds" [showError]="step.durationSeconds < 1" />

                            <div class="step-flags">
                              <label class="step-flag"><input type="checkbox" [(ngModel)]="step.soundOnStart" /> 🔔 Inicio</label>
                              <label class="step-flag"><input type="checkbox" [(ngModel)]="step.soundOnEnd" /> 🔔 Fin</label>
                              <label class="step-flag"><input type="checkbox" [(ngModel)]="step.voiceAnnouncement" /> 🎤 Voz</label>
                            </div>
                          </div>

                          <div class="step-actions">
                            <button type="button" class="btn btn-ghost btn-xs" (click)="moveStep(bi, si, -1)" [disabled]="si === 0">↑ Subir</button>
                            <button type="button" class="btn btn-ghost btn-xs" (click)="moveStep(bi, si, 1)" [disabled]="si === block.steps.length - 1">↓ Bajar</button>
                            <button type="button" class="btn btn-ghost btn-xs" (click)="duplicateStep(bi, si)">📋 Duplicar</button>
                            <button type="button" class="btn btn-ghost btn-xs danger-text" (click)="removeStep(bi, si)" [disabled]="block.steps.length <= 1">🗑️ Eliminar</button>
                          </div>
                        </div>
                      </li>
                    }
                  </ul>

                  <button type="button" class="btn btn-secondary add-step-btn" (click)="addStep(bi)">
                    + Añadir etapa al bloque
                  </button>
                </div>
              }

              <button type="button" class="btn btn-secondary add-block-btn" (click)="addBlock()">
                + Añadir otro bloque de etapas
              </button>
            </section>
          </div>
        }

        <!-- OPCIONES GENERALES: COLOR Y PREFERENCIAS RÁPIDAS -->
        @if (editorMode() !== 'custom') {
          <div class="extra-options card">
            <h3 class="extra-title">🎨 Color y Estilo</h3>
            <div class="color-palette" role="group" aria-label="Seleccionar color">
              @for (color of paletteColors; track color) {
                <button type="button" class="color-swatch" [style.background]="color"
                        [class.selected]="routineColor === color"
                        (click)="routineColor = color"
                        [attr.aria-label]="'Color ' + color"
                        [attr.aria-pressed]="routineColor === color">
                </button>
              }
            </div>
          </div>
        }

      </div>
    </div>

    <!-- Confirmación al salir -->
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
      margin-bottom: var(--space-4);
    }
    .header-titles { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .editor-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); }
    .editor-subtitle { font-size: var(--font-size-xs); color: var(--color-text-muted); }

    .editor-errors {
      background: rgba(239,68,68,0.1); border: 1px solid var(--color-error);
      border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4); color: var(--color-error); font-size: var(--font-size-sm);
    }

    /* SELECTOR DE PLANTILLAS */
    .template-selector {
      margin-bottom: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-3);
      border-color: var(--color-border-strong);
    }
    .selector-header { display: flex; flex-direction: column; gap: 2px; }
    .selector-title { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); }
    .selector-hint { font-size: var(--font-size-xs); color: var(--color-text-muted); }

    .template-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-2);
    }
    .template-card-btn {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: var(--space-3) var(--space-2); border-radius: var(--radius-md);
      background: var(--color-surface-2); border: 1.5px solid var(--color-border);
      cursor: pointer; transition: all var(--duration-fast);
      gap: 4px;
    }
    .template-card-btn:hover { background: var(--color-surface-3); border-color: var(--color-border-strong); }
    .template-card-btn.selected {
      background: var(--color-accent-muted);
      border-color: var(--color-accent);
      box-shadow: 0 0 0 1px var(--color-accent);
    }
    .template-icon { font-size: 1.75rem; line-height: 1; }
    .template-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
    .template-desc { font-size: 0.7rem; color: var(--color-text-muted); line-height: 1.2; }

    /* RESUMEN EN VIVO */
    .live-summary-card {
      display: flex; justify-content: space-between; align-items: center;
      gap: var(--space-4); padding: var(--space-4); margin-bottom: var(--space-4);
      border-left: 5px solid var(--accent-color, var(--color-accent));
      background: var(--color-surface-1);
    }
    .summary-left { display: flex; flex-direction: column; gap: 2px; }
    .summary-badge {
      display: inline-block; font-size: 0.7rem; text-transform: uppercase;
      font-weight: var(--font-weight-bold); letter-spacing: 0.05em; color: var(--color-accent);
    }
    .summary-total-time {
      font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);
      font-family: var(--font-mono); color: var(--color-text-primary);
    }
    .summary-label { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .summary-right { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); text-align: right; }
    .summary-description { font-size: var(--font-size-sm); color: var(--color-text-secondary); max-width: 320px; }
    .customize-btn { font-size: var(--font-size-xs); border: 1px dashed var(--color-border-strong); padding: var(--space-1) var(--space-3); }
    .custom-badge { font-size: var(--font-size-xs); color: var(--color-accent); font-weight: var(--font-weight-medium); }

    /* FORMULARIOS GUIADOS */
    .guided-form {
      display: flex; flex-direction: column; gap: var(--space-4);
      background: var(--color-bg-card);
    }
    .form-section-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }
    .form-section-desc { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: -6px; }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-4);
    }
    .full-width { grid-column: 1 / -1; }

    .counter-input { display: flex; align-items: center; gap: var(--space-1); }
    .counter-btn { width: 40px; height: var(--touch-target); font-size: 1.2rem; }
    .num-field { width: 70px; text-align: center; height: var(--touch-target); font-family: var(--font-mono); }

    .readonly-badge {
      display: flex; align-items: center; height: var(--touch-target);
      padding: 0 var(--space-3); border-radius: var(--radius-md);
      background: var(--color-surface-3); font-size: var(--font-size-sm);
      color: var(--color-text-primary); font-weight: var(--font-weight-medium);
    }

    /* MODO PERSONALIZADO */
    .custom-mode-layout { display: flex; flex-direction: column; gap: var(--space-4); }
    @media (min-width: 900px) {
      .custom-mode-layout { flex-direction: row; align-items: flex-start; }
      .editor-meta { width: 300px; flex-shrink: 0; position: sticky; top: calc(var(--header-height) + var(--space-4)); }
      .editor-blocks { flex: 1; }
    }
    .editor-meta { display: flex; flex-direction: column; gap: var(--space-3); }
    .category-select { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .color-palette { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .color-swatch {
      width: 32px; height: 32px; border-radius: var(--radius-full);
      border: 2px solid transparent; cursor: pointer; transition: transform var(--duration-fast);
    }
    .color-swatch.selected { border-color: white; transform: scale(1.2); }

    .editor-blocks { display: flex; flex-direction: column; gap: var(--space-4); }
    .blocks-header { display: flex; flex-direction: column; gap: 2px; }
    .blocks-title { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); }
    .blocks-hint { font-size: var(--font-size-xs); color: var(--color-text-muted); }

    .block-card { display: flex; flex-direction: column; gap: var(--space-3); }
    .block-top-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .block-name-input {
      font-size: var(--font-size-md); font-weight: var(--font-weight-semibold);
      background: transparent; border: none; border-bottom: 1px solid var(--color-border-strong);
      color: var(--color-text-primary); padding: var(--space-1) 0; flex: 1;
    }
    .block-actions { display: flex; gap: var(--space-1); }

    .block-settings-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4);
      background: var(--color-surface-2); padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md); font-size: var(--font-size-sm);
    }
    .inline-label { display: flex; align-items: center; gap: var(--space-2); }
    .checkbox-label { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }

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
    .step-type-select { width: 140px; height: var(--touch-target); font-size: var(--font-size-sm); }
    .step-flags { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
    .step-flag { display: flex; align-items: center; gap: var(--space-1); font-size: var(--font-size-xs); cursor: pointer; }
    .step-actions { display: flex; gap: var(--space-2); }
    .btn-xs { font-size: var(--font-size-xs); padding: 2px var(--space-2); min-height: 28px; }
    .danger-text { color: var(--color-error); }
    .add-step-btn, .add-block-btn { width: 100%; }

    .extra-options {
      margin-top: var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-2);
    }
    .extra-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); }
  `],
})
export class RoutineEditorComponent implements OnInit {
  @Input() id?: string;

  router = inject(Router);
  route = inject(ActivatedRoute);
  private routineRepo = inject(RoutineRepository);

  readonly Math = Math;

  // Modo actual
  editorMode = signal<RoutineEditorMode>('tabata');

  // Metadatos comunes
  routineName = '';
  routineDescription = '';
  routineCategory: RoutineCategory = 'hiit';
  routineColor = PALETTE_COLORS[0];
  isNew = true;
  saving = signal(false);
  errors = signal<string[]>([]);
  showCancelDialog = signal(false);

  // Parámetros guiados - Tabata
  tabataRounds = 8;
  tabataWorkSec = 20;
  tabataRestSec = 10;

  // Parámetros guiados - HIIT
  hiitWorkSec = 40;
  hiitRestSec = 20;
  hiitRounds = 6;
  hiitSeries = 1;
  hiitRestBetweenSeriesSec = 60;

  // Parámetros guiados - EMOM
  emomMinutes = 10;
  emomWorkSec = 40;

  // Parámetros guiados - Pomodoro
  pomodoroWorkSec = 25 * 60; // 25 min
  pomodoroRestSec = 5 * 60;  // 5 min
  pomodoroCycles = 4;
  pomodoroLongRestSec = 15 * 60; // 15 min

  // Calentamiento y Vuelta a la calma globales
  warmupSec = 0;
  cooldownSec = 0;

  // Bloques y etapas para modo custom (o cuando se convierte a custom)
  blocks: RoutineBlock[] = [];

  private originalRoutine?: Routine;
  paletteColors = PALETTE_COLORS;
  categories: RoutineCategory[] = ['hiit', 'strength', 'cardio', 'mobility', 'study', 'custom'];
  stepTypes: StepType[] = ['work', 'rest', 'warmup', 'cooldown', 'recovery', 'custom'];

  templateOptions: TemplateOption[] = [
    { key: 'tabata', icon: '⚡', name: 'Tabata', tagline: '20s trabajo / 10s descanso' },
    { key: 'hiit', icon: '🔥', name: 'HIIT / Intervalos', tagline: 'Trabajo y descanso con series' },
    { key: 'emom', icon: '⏱️', name: 'EMOM', tagline: 'Cada minuto en el minuto' },
    { key: 'pomodoro', icon: '🍅', name: 'Pomodoro', tagline: '25m estudio / 5m descanso' },
    { key: 'custom', icon: '🛠️', name: 'Personalizada', tagline: 'Secuencia libre avanzada' },
  ];

  estimatedDuration = computed(() => {
    const routine = this.buildRoutine();
    return calcRoutineDurationSec(routine);
  });

  quickSummaryText = computed(() => {
    const mode = this.editorMode();
    switch (mode) {
      case 'tabata':
        return `${this.tabataRounds} rondas de ${this.tabataWorkSec}s trabajo y ${this.tabataRestSec}s descanso.`;
      case 'hiit':
        const seriesText = this.hiitSeries > 1 ? ` (${this.hiitSeries} series)` : '';
        return `${this.hiitRounds} rondas de ${this.hiitWorkSec}s trabajo / ${this.hiitRestSec}s descanso${seriesText}.`;
      case 'emom':
        return `${this.emomMinutes} rondas de 1 minuto (${this.emomWorkSec}s trabajo + ${Math.max(0, 60 - this.emomWorkSec)}s descanso).`;
      case 'pomodoro':
        return `${this.pomodoroCycles} ciclos de ${Math.round(this.pomodoroWorkSec / 60)}m concentración y ${Math.round(this.pomodoroRestSec / 60)}m descanso.`;
      case 'custom':
        const totalSteps = this.blocks.reduce((acc, b) => acc + b.steps.length * b.repetitions, 0);
        return `${this.blocks.length} bloque(s) con ${totalSteps} etapas totales.`;
    }
  });

  async ngOnInit(): Promise<void> {
    // Si viene por query param ?tipo=hiit etc.
    const queryTipo = this.route.snapshot.queryParamMap.get('tipo') as RoutineEditorMode | null;

    if (this.id) {
      this.isNew = false;
      const routine = await this.routineRepo.getById(this.id);
      if (routine) {
        this.originalRoutine = routine;
        this.loadExistingRoutine(routine);
      } else {
        this.router.navigate(['/biblioteca']);
      }
    } else {
      if (queryTipo && this.templateOptions.some(t => t.key === queryTipo)) {
        this.selectMode(queryTipo);
      } else {
        this.selectMode('tabata');
      }
    }
  }

  selectMode(mode: RoutineEditorMode): void {
    this.editorMode.set(mode);
    switch (mode) {
      case 'tabata':
        this.routineName = this.routineName || 'Tabata clásico';
        this.routineCategory = 'hiit';
        this.routineColor = '#EF4444';
        break;
      case 'hiit':
        this.routineName = this.routineName || 'Intervalos HIIT';
        this.routineCategory = 'hiit';
        this.routineColor = '#F97316';
        break;
      case 'emom':
        this.routineName = this.routineName || 'EMOM 10 minutos';
        this.routineCategory = 'strength';
        this.routineColor = '#8B5CF6';
        break;
      case 'pomodoro':
        this.routineName = this.routineName || 'Pomodoro Foco';
        this.routineCategory = 'study';
        this.routineColor = '#10B981';
        break;
      case 'custom':
        this.routineName = this.routineName || 'Rutina personalizada';
        this.routineCategory = 'custom';
        this.routineColor = PALETTE_COLORS[0];
        if (!this.blocks.length) {
          this.blocks = this.generateBlocksFromCurrentPreset();
        }
        break;
    }
  }

  switchToCustomMode(): void {
    // Convierte los parámetros de la plantilla actual a bloques y abre el modo avanzado
    this.blocks = this.generateBlocksFromCurrentPreset();
    this.editorMode.set('custom');
  }

  private loadExistingRoutine(routine: Routine): void {
    this.routineName = routine.name;
    this.routineDescription = routine.description ?? '';
    this.routineCategory = routine.category;
    this.routineColor = routine.color;
    this.blocks = JSON.parse(JSON.stringify(routine.blocks)) as RoutineBlock[];
    // Al editar una existente con bloques completos, se abre en modo custom para control total
    this.editorMode.set('custom');
  }

  currentTemplateName(): string {
    const tpl = this.templateOptions.find(t => t.key === this.editorMode());
    return tpl ? tpl.name : 'Personalizada';
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
    return map[type] || 'var(--color-step-custom)';
  }

  // ── Modificadores de Bloques en modo custom ────────────────
  addBlock(): void {
    this.blocks.push({
      id: generateId(),
      name: '',
      steps: [this.newCustomStep('Trabajo', 'work', 30)],
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
    this.blocks[bi].steps.push(this.newCustomStep('Trabajo', 'work', 30));
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

  private newCustomStep(name: string, type: StepType, durationSeconds: number): RoutineStep {
    return {
      id: generateId(),
      name,
      type,
      durationSeconds,
      soundOnStart: true,
      soundOnEnd: true,
      voiceAnnouncement: true,
    };
  }

  // ── Generador de bloques a partir de los datos simplificados ──
  private generateBlocksFromCurrentPreset(): RoutineBlock[] {
    const mode = this.editorMode();
    const result: RoutineBlock[] = [];

    // Calentamiento inicial opcional si está configurado
    if (this.warmupSec > 0) {
      result.push({
        id: generateId(),
        name: 'Calentamiento',
        repetitions: 1,
        restAfterLastRound: false,
        steps: [
          {
            id: generateId(),
            name: 'Calentamiento',
            type: 'warmup',
            durationSeconds: this.warmupSec,
            soundOnStart: true,
            soundOnEnd: true,
            voiceAnnouncement: true,
          }
        ]
      });
    }

    if (mode === 'tabata') {
      result.push({
        id: generateId(),
        name: 'Tabata',
        repetitions: Math.max(1, this.tabataRounds),
        restBetweenRoundsSec: Math.max(0, this.tabataRestSec),
        restAfterLastRound: false,
        steps: [
          {
            id: generateId(),
            name: 'Trabajo',
            type: 'work',
            durationSeconds: Math.max(1, this.tabataWorkSec),
            soundOnStart: true,
            soundOnEnd: true,
            voiceAnnouncement: true,
          }
        ]
      });
    } else if (mode === 'hiit') {
      const series = Math.max(1, this.hiitSeries);
      for (let s = 0; s < series; s++) {
        result.push({
          id: generateId(),
          name: series > 1 ? `Serie ${s + 1}` : 'Intervalos',
          repetitions: Math.max(1, this.hiitRounds),
          restBetweenRoundsSec: Math.max(0, this.hiitRestSec),
          restAfterLastRound: false,
          steps: [
            {
              id: generateId(),
              name: 'Trabajo',
              type: 'work',
              durationSeconds: Math.max(1, this.hiitWorkSec),
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            }
          ]
        });

        // Descanso entre series
        if (s < series - 1 && this.hiitRestBetweenSeriesSec > 0) {
          result.push({
            id: generateId(),
            name: `Descanso entre series`,
            repetitions: 1,
            restAfterLastRound: false,
            steps: [
              {
                id: generateId(),
                name: 'Recuperación',
                type: 'recovery',
                durationSeconds: this.hiitRestBetweenSeriesSec,
                soundOnStart: true,
                soundOnEnd: true,
                voiceAnnouncement: true,
              }
            ]
          });
        }
      }
    } else if (mode === 'emom') {
      const rest = Math.max(0, 60 - this.emomWorkSec);
      const steps: RoutineStep[] = [
        {
          id: generateId(),
          name: 'Trabajo',
          type: 'work',
          durationSeconds: Math.max(1, this.emomWorkSec),
          soundOnStart: true,
          soundOnEnd: true,
          voiceAnnouncement: true,
        }
      ];
      if (rest > 0) {
        steps.push({
          id: generateId(),
          name: 'Descanso del minuto',
          type: 'rest',
          durationSeconds: rest,
          soundOnStart: false,
          soundOnEnd: true,
          voiceAnnouncement: false,
        });
      }
      result.push({
        id: generateId(),
        name: 'EMOM',
        repetitions: Math.max(1, this.emomMinutes),
        restAfterLastRound: false,
        steps,
      });
    } else if (mode === 'pomodoro') {
      result.push({
        id: generateId(),
        name: 'Ciclos Pomodoro',
        repetitions: Math.max(1, this.pomodoroCycles),
        restBetweenRoundsSec: Math.max(0, this.pomodoroRestSec),
        restAfterLastRound: false,
        steps: [
          {
            id: generateId(),
            name: 'Concentración',
            type: 'work',
            durationSeconds: Math.max(1, this.pomodoroWorkSec),
            soundOnStart: true,
            soundOnEnd: true,
            voiceAnnouncement: true,
          }
        ]
      });

      if (this.pomodoroLongRestSec > 0) {
        result.push({
          id: generateId(),
          name: 'Descanso largo',
          repetitions: 1,
          restAfterLastRound: false,
          steps: [
            {
              id: generateId(),
              name: 'Descanso largo',
              type: 'rest',
              durationSeconds: this.pomodoroLongRestSec,
              soundOnStart: true,
              soundOnEnd: true,
              voiceAnnouncement: true,
            }
          ]
        });
      }
    } else {
      // Modo custom pero sin bloques aún
      result.push({
        id: generateId(),
        name: 'Bloque 1',
        repetitions: 1,
        restAfterLastRound: false,
        steps: [this.newCustomStep('Trabajo', 'work', 30)]
      });
    }

    // Vuelta a la calma opcional
    if (this.cooldownSec > 0) {
      result.push({
        id: generateId(),
        name: 'Vuelta a la calma',
        repetitions: 1,
        restAfterLastRound: false,
        steps: [
          {
            id: generateId(),
            name: 'Enfriamiento',
            type: 'cooldown',
            durationSeconds: this.cooldownSec,
            soundOnStart: true,
            soundOnEnd: true,
            voiceAnnouncement: true,
          }
        ]
      });
    }

    return result;
  }

  private buildRoutine(): Routine {
    const now = Date.now();
    const finalBlocks = this.editorMode() === 'custom'
      ? (this.blocks.length ? this.blocks : [this.newCustomStep('Trabajo', 'work', 30)].map(s => ({
          id: generateId(), repetitions: 1, restAfterLastRound: false, steps: [s]
        })))
      : this.generateBlocksFromCurrentPreset();

    return {
      id: this.id ?? generateId(),
      name: this.routineName.trim() || 'Mi rutina',
      description: this.routineDescription.trim() || undefined,
      category: this.routineCategory,
      color: this.routineColor,
      tags: [this.editorMode()],
      isFavorite: this.originalRoutine?.isFavorite ?? false,
      blocks: finalBlocks,
      preferences: this.originalRoutine?.preferences ?? defaultRoutinePreferences(),
      createdAt: this.originalRoutine?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
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
    } catch {
      this.errors.set(['Error al guardar la rutina. Inténtalo de nuevo.']);
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    const hasChanges = this.routineName !== (this.originalRoutine?.name ?? '');
    if (hasChanges || (!this.isNew && this.originalRoutine)) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/biblioteca']);
    }
  }
}
