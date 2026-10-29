import {
  Component, OnInit, signal, computed, inject, DestroyRef, HostListener
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoutineRepository } from '../../core/persistence/routine.repository';
import { Routine, RoutineCategory } from '../../core/timer-engine/timer-engine.types';
import { calcRoutineDurationSec } from '../../core/timer-engine/timer-engine.utils';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { LibrarySearchService } from '../../core/ui/library-search.service';

type SortMode = 'recent' | 'name' | 'created';

interface SortOption {
  value: SortMode;
  label: string;
}

const CATEGORY_LABELS: Record<RoutineCategory | 'all', string> = {
  all: 'Todas',
  hiit: 'HIIT',
  strength: 'Fuerza',
  cardio: 'Cardio',
  mobility: 'Movilidad',
  study: 'Estudio',
  custom: 'Personalizada',
};

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [RouterLink, DurationPipe, EmptyStateComponent, ConfirmDialogComponent],
  template: `
    <div class="library-page">
      <!-- Encabezado de la biblioteca -->
      <header class="library-header">
        <div class="library-heading">
          <div class="library-title-group">
            <span class="library-eyebrow">Biblioteca</span>
            <h1 class="library-title">Tus rutinas</h1>
            <p class="library-subtitle">{{ resultSummary() }}</p>
          </div>

          <!-- Orden en móvil -->
          <div class="sort-control sort-control--mobile">
            <span class="sort-label" aria-hidden="true">Ordenar</span>
            <span class="select-wrap">
              <select class="sort-select" [value]="sortMode()" (change)="onSortChange($event)" aria-label="Ordenar rutinas">
                @for (option of sortOptions; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              <svg class="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </span>
          </div>
        </div>

        <!-- Acciones principales (escritorio) -->
        <div class="library-actions">
          <a routerLink="/temporizador-rapido" class="btn btn-secondary">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
            Temporizador rápido
          </a>
          <a routerLink="/rutina/nueva" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Crear rutina
          </a>
        </div>
      </header>

      <!-- Filtros y ordenamiento -->
      <div class="library-toolbar">
        <div class="filter-chips" role="group" aria-label="Filtrar por categoría">
          @for (cat of categories; track cat) {
            <button
              class="chip"
              [class.active]="activeCategory() === cat"
              (click)="setCategory(cat)"
              [attr.aria-pressed]="activeCategory() === cat">
              {{ categoryLabel(cat) }}
            </button>
          }
        </div>

        <div class="sort-control sort-control--desktop">
          <span class="sort-label" aria-hidden="true">Ordenar</span>
          <span class="select-wrap">
            <select class="sort-select" [value]="sortMode()" (change)="onSortChange($event)" aria-label="Ordenar rutinas">
              @for (option of sortOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <svg class="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </div>
      </div>

      <!-- Plantillas guiadas (escritorio) -->
      <div class="quick-creators" aria-label="Crear según plantilla">
        <span class="quick-label">Creación guiada</span>
        <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'tabata' }" class="chip chip-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
          </svg>
          Tabata
        </a>
        <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'hiit' }" class="chip chip-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22c4 0 7-2.7 7-7 0-3-1.8-5.4-3.4-7.2C14.2 6.2 13 4.4 13 2c-1.5 1.7-2 3.8-2 5.5 0 2 .8 3.3.8 3.3S10 9.4 8.9 7.7C7.6 9 5 12.3 5 15c0 4.3 3 7 7 7z"/>
          </svg>
          HIIT
        </a>
        <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'emom' }" class="chip chip-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 2 21 6M7 2 3 6M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0zM12 7v5l3 2"/>
          </svg>
          EMOM
        </a>
        <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'pomodoro' }" class="chip chip-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v2M10 2v2M14 2v2"/>
          </svg>
          Pomodoro
        </a>
      </div>

      <!-- Lista de rutinas -->
      <main class="library-content" aria-label="Lista de rutinas" aria-live="polite">
        @if (loading()) {
          <div class="loading-state" aria-busy="true" aria-label="Cargando rutinas...">
            <div class="loading-spinner"></div>
          </div>
        } @else if (filteredRoutines().length === 0) {
          <app-empty-state
            icon="🏋️"
            title="Sin rutinas"
            [message]="emptyMessage()">
            @if (search.query()) {
              <button class="btn btn-secondary empty-action" (click)="search.clear()">
                Limpiar búsqueda
              </button>
            } @else if (activeCategory() !== 'all') {
              <button class="btn btn-secondary empty-action" (click)="setCategory('all')">
                Ver todas las rutinas
              </button>
            } @else {
              <a routerLink="/rutina/nueva" class="btn btn-primary empty-action">
                Crear primera rutina
              </a>
            }
          </app-empty-state>
        } @else {
          <ul class="routine-list" role="list">
            @for (routine of filteredRoutines(); track routine.id) {
              <li class="routine-card" [style.--routine-color]="routine.color">
                <div class="routine-stripe" aria-hidden="true"></div>

                <div class="routine-info">
                  <div class="routine-top">
                    <span class="routine-category">{{ categoryLabel(routine.category) }}</span>
                    @if (routine.isFavorite) {
                      <span class="routine-fav" aria-label="Favorita">★</span>
                    }
                    <button class="btn btn-ghost btn-icon routine-menu-btn"
                            [attr.aria-label]="'Opciones para ' + routine.name"
                            (click)="openRoutineMenu(routine, $event)">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                        <circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>
                  </div>
                  <h3 class="routine-name">{{ routine.name }}</h3>
                  @if (routine.description) {
                    <p class="routine-desc">{{ routine.description }}</p>
                  }
                  <div class="routine-meta">
                    <span class="routine-meta-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                      </svg>
                      {{ calcDuration(routine) | duration }}
                    </span>
                    <span class="routine-meta-sep" aria-hidden="true">·</span>
                    <span class="routine-meta-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>
                      </svg>
                      {{ countSteps(routine) }} etapas
                    </span>
                  </div>
                </div>

                <div class="routine-actions">
                  <a [routerLink]="['/temporizador', routine.id]"
                     class="btn btn-primary routine-start-btn"
                     [attr.aria-label]="'Iniciar ' + routine.name">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span class="routine-start-label">Iniciar</span>
                  </a>
                </div>
              </li>
            }
          </ul>
        }
      </main>
    </div>

    <!-- Botón flotante de acciones (móvil) -->
    <button
      type="button"
      class="fab"
      aria-label="Crear o iniciar entrenamiento"
      aria-haspopup="dialog"
      [attr.aria-expanded]="createMenuOpen()"
      (click)="toggleCreateMenu($event)">
      <svg class="fab-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>

    <!-- Hoja de creación (móvil) -->
    @if (createMenuOpen()) {
      <div class="action-sheet-backdrop" (click)="closeCreateMenu()" role="presentation">
        <div class="action-sheet-modal create-sheet"
             (click)="$event.stopPropagation()"
             role="dialog" aria-modal="true" aria-label="Crear o iniciar entrenamiento">
          <div class="sheet-grabber" aria-hidden="true"></div>

          <div class="action-sheet-header">
            <div class="action-sheet-title-group">
              <span class="action-sheet-category">Nueva sesión</span>
              <h3 class="action-sheet-name">¿Qué quieres hacer?</h3>
            </div>
            <button class="btn btn-ghost btn-icon btn-close-sheet" (click)="closeCreateMenu()" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div class="create-options">
            <a routerLink="/rutina/nueva" class="create-option create-option-primary" (click)="closeCreateMenu()">
              <span class="create-option-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </span>
              <span class="create-option-text">
                <strong>Crear rutina</strong>
                <small>Diseña tu entrenamiento paso a paso</small>
              </span>
              <svg class="create-option-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </a>

            <a routerLink="/temporizador-rapido" class="create-option" (click)="closeCreateMenu()">
              <span class="create-option-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
                </svg>
              </span>
              <span class="create-option-text">
                <strong>Temporizador rápido</strong>
                <small>Empieza sin configurar nada</small>
              </span>
              <svg class="create-option-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </a>
          </div>

          <p class="sheet-section-label">Creación guiada</p>
          <div class="template-grid">
            <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'tabata' }"
               class="template-tile" style="--template-color: #ff6b35" (click)="closeCreateMenu()">
              <span class="template-name">Tabata</span>
              <span class="template-meta">20/10 · 4 min</span>
            </a>
            <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'hiit' }"
               class="template-tile" style="--template-color: #ef4444" (click)="closeCreateMenu()">
              <span class="template-name">HIIT</span>
              <span class="template-meta">40/20 · 8 rondas</span>
            </a>
            <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'emom' }"
               class="template-tile" style="--template-color: #a855f7" (click)="closeCreateMenu()">
              <span class="template-name">EMOM</span>
              <span class="template-meta">10 min</span>
            </a>
            <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'pomodoro' }"
               class="template-tile" style="--template-color: #22c55e" (click)="closeCreateMenu()">
              <span class="template-name">Pomodoro</span>
              <span class="template-meta">25/5 · 4 ciclos</span>
            </a>
          </div>
        </div>
      </div>
    }

    <!-- Menú flotante / Action Sheet sobre la aplicación -->
    @if (activeMenuRoutine()) {
      <div class="action-sheet-backdrop" (click)="closeMenu()" role="presentation">
        <div class="action-sheet-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-label]="'Opciones de ' + activeMenuRoutine()!.name">
          <div class="sheet-grabber" aria-hidden="true"></div>

          <div class="action-sheet-header">
            <div class="action-sheet-title-group">
              <span class="action-sheet-category">{{ categoryLabel(activeMenuRoutine()!.category) }}</span>
              <h3 class="action-sheet-name">{{ activeMenuRoutine()!.name }}</h3>
            </div>
            <button class="btn btn-ghost btn-icon btn-close-sheet" (click)="closeMenu()" aria-label="Cerrar opciones">✕</button>
          </div>

          <div class="action-sheet-options">
            <a [routerLink]="['/rutina', activeMenuRoutine()!.id, 'editar']"
               class="action-sheet-btn" (click)="closeMenu()">
              <span class="sheet-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </span>
              <div class="sheet-texts">
                <span class="sheet-primary">Editar rutina</span>
                <span class="sheet-secondary">Modificar etapas, tiempos y descansos</span>
              </div>
            </a>

            <button type="button" class="action-sheet-btn" (click)="duplicate(activeMenuRoutine()!); closeMenu()">
              <span class="sheet-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </span>
              <div class="sheet-texts">
                <span class="sheet-primary">Duplicar</span>
                <span class="sheet-secondary">Crear una copia exacta para personalizar</span>
              </div>
            </button>

            <button type="button" class="action-sheet-btn" (click)="toggleFavorite(activeMenuRoutine()!); closeMenu()">
              <span class="sheet-icon sheet-icon--fav" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24"
                     [attr.fill]="activeMenuRoutine()!.isFavorite ? 'currentColor' : 'none'"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </span>
              <div class="sheet-texts">
                <span class="sheet-primary">{{ activeMenuRoutine()!.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita' }}</span>
                <span class="sheet-secondary">{{ activeMenuRoutine()!.isFavorite ? 'Desmarcar de favoritos' : 'Fijar en destacados' }}</span>
              </div>
            </button>

            <hr class="action-sheet-divider" />

            <button type="button" class="action-sheet-btn danger" (click)="confirmDelete(activeMenuRoutine()!); closeMenu()">
              <span class="sheet-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>
                </svg>
              </span>
              <div class="sheet-texts">
                <span class="sheet-primary">Eliminar rutina</span>
                <span class="sheet-secondary">Borrar permanentemente de este dispositivo</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Diálogo de confirmación -->
    @if (deletingRoutine()) {
      <app-confirm-dialog
        title="Eliminar rutina"
        [message]="'¿Eliminar «' + deletingRoutine()!.name + '»? Esta acción no se puede deshacer.'"
        confirmLabel="Eliminar"
        [isDanger]="true"
        (confirmed)="deleteConfirmed()"
        (cancelled)="deletingRoutine.set(null)" />
    }
  `,
  styles: [`
    .library-page {
      max-width: 1180px;
      margin: 0 auto;
      padding: var(--space-4);
    }

    /* ── Encabezado ─────────────────────────────── */
    .library-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }
    .library-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .library-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .library-eyebrow {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    .library-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      letter-spacing: -0.035em;
      line-height: 1.1;
    }
    .library-subtitle {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    /* Selector de orden */
    .sort-control {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: none;
    }
    .sort-control--desktop { display: none; }
    .sort-label {
      display: none;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      white-space: nowrap;
    }
    .select-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .sort-select {
      appearance: none;
      -webkit-appearance: none;
      height: 38px;
      padding: 0 34px 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-surface-2);
      color: var(--color-text-secondary);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      font-family: inherit;
      cursor: pointer;
      transition:
        border-color var(--duration-fast),
        color var(--duration-fast);
    }
    .sort-select:hover {
      border-color: var(--color-border-strong);
      color: var(--color-text-primary);
    }
    .sort-select:focus-visible {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: var(--focus-ring);
    }
    .select-chevron {
      position: absolute;
      right: 11px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .library-actions {
      display: none;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    /* ── Filtros ────────────────────────────────── */
    .library-toolbar {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .filter-chips {
      display: flex;
      gap: var(--space-2);
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding-bottom: 2px;
    }
    .filter-chips::-webkit-scrollbar { display: none; }
    .filter-chips .chip {
      flex: none;
      min-height: 38px;
      padding-inline: var(--space-4);
    }

    /* ── Plantillas guiadas ─────────────────────── */
    .quick-creators {
      display: none;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
      margin-bottom: var(--space-5);
    }
    .quick-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
      letter-spacing: 0.02em;
    }
    .chip-action {
      background: var(--color-surface-2);
      border-color: var(--color-border);
      text-decoration: none;
    }
    .chip-action:hover {
      background: var(--color-surface-3);
      color: var(--color-text-primary);
      text-decoration: none;
      border-color: var(--color-accent);
    }

    /* ── Lista ──────────────────────────────────── */
    .library-content {
      padding-bottom: calc(var(--space-16) + var(--space-4));
    }
    .routine-list {
      list-style: none;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-3);
    }

    .routine-card {
      display: flex;
      gap: var(--space-3);
      align-items: stretch;
      min-width: 0;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      position: relative;
      box-shadow: var(--shadow-sm);
      transition:
        box-shadow var(--duration-normal) var(--easing-default),
        border-color var(--duration-normal) var(--easing-default),
        transform var(--duration-normal) var(--easing-default);
    }
    .routine-card:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--color-border-strong);
    }

    .routine-stripe {
      width: 4px;
      flex-shrink: 0;
      background: var(--routine-color, var(--color-accent));
      border-top-left-radius: var(--radius-lg);
      border-bottom-left-radius: var(--radius-lg);
    }

    .routine-info {
      flex: 1;
      min-width: 0;
      padding: var(--space-3) 0 var(--space-3) var(--space-1);
    }
    .routine-top {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: 2px;
    }
    .routine-menu-btn {
      margin-left: auto;
      width: 34px;
      height: 34px;
      flex: none;
      color: var(--color-text-muted);
    }
    .routine-category {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .routine-fav { color: #f59e0b; font-size: var(--font-size-sm); }

    .routine-name {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .routine-desc {
      display: none;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: var(--space-2);
    }
    .routine-meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .routine-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .routine-meta-sep { opacity: 0.5; }

    .routine-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-3) var(--space-2) 0;
    }

    .routine-start-btn {
      width: 48px;
      height: 48px;
      min-height: 48px;
      padding: 0;
      border-radius: var(--radius-full);
      background: var(--color-accent-muted);
      color: var(--color-accent);
      border: 1px solid rgba(255, 107, 53, 0.35);
      border: 1px solid color-mix(in srgb, var(--color-accent) 38%, transparent);
      box-shadow: none;
    }
    .routine-start-btn:hover {
      background: var(--color-accent);
      color: var(--color-text-on-accent);
    }
    .routine-start-label { display: none; }

    /* ── FAB (móvil) ────────────────────────────── */
    .fab {
      position: fixed;
      right: var(--space-4);
      bottom: calc(var(--nav-height) + env(safe-area-inset-bottom) + var(--space-4));
      z-index: 60;
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: var(--radius-full);
      background: var(--color-accent);
      color: var(--color-text-on-accent);
      box-shadow: 0 8px 22px rgb(255 107 53 / 42%);
      transition:
        transform var(--duration-fast) var(--easing-default),
        box-shadow var(--duration-normal) var(--easing-default);
    }
    .fab:hover { box-shadow: 0 10px 26px rgb(255 107 53 / 52%); }
    .fab:active { transform: scale(0.94); }

    /* ── Hojas inferiores ───────────────────────── */
    .action-sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn var(--duration-fast) var(--easing-default);
    }

    .action-sheet-modal {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      width: 100%;
      max-width: 480px;
      max-height: calc(100dvh - var(--space-6));
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--space-3) var(--space-4);
      padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
      box-shadow: var(--shadow-lg);
      animation: slideUpSheet var(--duration-normal) var(--easing-default);
    }
    .sheet-grabber {
      width: 36px;
      height: 4px;
      margin: 0 auto var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-border-strong);
    }

    @keyframes slideUpSheet {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    @media (min-width: 640px) {
      .action-sheet-backdrop {
        align-items: center;
        padding: var(--space-4);
      }
      .action-sheet-modal {
        border-radius: var(--radius-xl);
        padding: var(--space-4);
        padding-bottom: var(--space-4);
        animation: scaleSheet var(--duration-fast) var(--easing-default);
      }
      .sheet-grabber { display: none; }
      @keyframes scaleSheet {
        from { transform: scale(0.94); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
    }

    .action-sheet-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-2);
    }
    .action-sheet-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }
    .action-sheet-category {
      font-size: var(--font-size-xs);
      color: var(--color-accent);
      text-transform: uppercase;
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.05em;
    }
    .action-sheet-name {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .btn-close-sheet {
      font-size: 1.1rem;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .action-sheet-options {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .action-sheet-btn {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      text-align: left;
      padding: var(--space-3);
      border-radius: var(--radius-md);
      background: none;
      border: none;
      color: var(--color-text-primary);
      text-decoration: none;
      cursor: pointer;
      transition: background var(--duration-fast);
      font-family: inherit;
      min-height: 48px;
    }
    .action-sheet-btn:hover,
    .action-sheet-btn:active {
      background: var(--color-surface-2);
      text-decoration: none;
    }
    .sheet-icon {
      display: grid;
      place-items: center;
      width: 28px;
      flex-shrink: 0;
      color: var(--color-text-secondary);
    }
    .sheet-icon--fav { color: var(--color-warning); }
    .action-sheet-btn.danger .sheet-icon { color: var(--color-error); }
    .sheet-texts {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .sheet-primary {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .sheet-secondary {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .action-sheet-btn.danger .sheet-primary {
      color: var(--color-error);
    }
    .action-sheet-divider {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: var(--space-1) 0;
    }

    /* ── Hoja de creación ───────────────────────── */
    .create-options {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .create-option {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      text-decoration: none;
      min-height: 60px;
      transition:
        background var(--duration-fast),
        border-color var(--duration-fast);
    }
    .create-option:hover {
      background: var(--color-surface-3);
      border-color: var(--color-border-strong);
      text-decoration: none;
    }
    .create-option-primary {
      background: var(--color-accent-muted);
      border-color: var(--color-accent);
    }
    .create-option-primary:hover {
      background: var(--color-accent-muted);
      border-color: var(--color-accent-hover);
    }
    .create-option-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex: none;
      border-radius: var(--radius-md);
      background: var(--color-accent);
      color: var(--color-text-on-accent);
    }
    .create-option:not(.create-option-primary) .create-option-icon {
      background: var(--color-surface-3);
      color: var(--color-accent);
    }
    .create-option-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }
    .create-option-text strong {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
    }
    .create-option-text small {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .create-option-chevron {
      color: var(--color-text-muted);
      flex: none;
    }

    .sheet-section-label {
      margin: var(--space-4) 0 var(--space-2);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
    }
    .template-tile {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--template-color, var(--color-accent));
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      text-decoration: none;
      transition: background var(--duration-fast);
    }
    .template-tile:hover {
      background: var(--color-surface-3);
      text-decoration: none;
    }
    .template-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
    }
    .template-meta {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }

    /* ── Estados ────────────────────────────────── */
    .empty-action { margin-top: var(--space-4); }

    .loading-state {
      display: flex; justify-content: center; padding: var(--space-12);
    }
    .loading-spinner {
      width: 40px; height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Responsive ─────────────────────────────── */
    @media (min-width: 640px) and (max-width: 1023px) {
      .library-page { padding: var(--space-6); }
      .routine-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4);
      }
    }

    @media (min-width: 1024px) {
      .library-page {
        padding: var(--space-6);
      }
      .library-header {
        flex-direction: row;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-6);
        margin-bottom: var(--space-5);
      }
      .library-title { font-size: var(--font-size-3xl); }
      .library-actions { display: flex; }

      .sort-control--mobile { display: none; }
      .sort-control--desktop { display: flex; padding-top: 1px; }
      .sort-label { display: inline; }
      .library-toolbar {
        flex-direction: row;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
      }
      .filter-chips {
        flex-wrap: wrap;
        overflow: visible;
        padding-bottom: 0;
      }
      .quick-creators { display: flex; }

      .routine-list {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
        gap: var(--space-4);
      }

      .routine-card:hover { transform: translateY(-1px); }

      .routine-info {
        padding: var(--space-4) 0 var(--space-4) var(--space-1);
      }
      .routine-name { font-size: var(--font-size-lg); }
      .routine-desc {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        white-space: normal;
        line-height: 1.4;
        overflow: hidden;
      }
      .routine-meta { gap: var(--space-2); font-size: var(--font-size-sm); }

      .routine-actions {
        flex-direction: row;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-4) var(--space-2) var(--space-4) 0;
      }
      .routine-start-btn {
        width: auto;
        height: auto;
        min-height: 42px;
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--color-accent);
        color: var(--color-text-on-accent);
        border-color: transparent;
        box-shadow: none;
      }
      .routine-start-btn:hover {
        background: var(--color-accent-hover);
        color: var(--color-text-on-accent);
      }
      .routine-start-label { display: inline; }

      .fab { display: none; }
      .library-content { padding-bottom: 0; }
    }

    @media (min-width: 1024px) and (max-width: 1279px) {
      .filter-chips { gap: 4px; }
      .filter-chips .chip { padding-inline: 14px; }
    }

    @media (min-width: 1280px) {
      .library-page { padding: var(--space-8); }
    }

    @media (prefers-reduced-motion: reduce) {
      .routine-card,
      .fab {
        transition: none;
      }
      .routine-card:hover { transform: none; }
      .action-sheet-backdrop,
      .action-sheet-modal {
        animation: none;
      }
    }
  `],
})
export class LibraryComponent implements OnInit {
  private routineRepo = inject(RoutineRepository);
  private destroyRef = inject(DestroyRef);
  readonly search = inject(LibrarySearchService);

  routines = signal<Routine[]>([]);
  loading = signal(true);
  activeCategory = signal<RoutineCategory | 'all'>('all');
  sortMode = signal<SortMode>('recent');
  activeMenuRoutine = signal<Routine | null>(null);
  deletingRoutine = signal<Routine | null>(null);
  createMenuOpen = signal(false);

  categories: (RoutineCategory | 'all')[] = ['all', 'hiit', 'strength', 'cardio', 'mobility', 'study', 'custom'];

  sortOptions: SortOption[] = [
    { value: 'recent', label: 'Recientes' },
    { value: 'name', label: 'Nombre' },
    { value: 'created', label: 'Creadas' },
  ];

  filteredRoutines = computed(() => {
    let list = this.routines();
    const cat = this.activeCategory();
    const query = this.search.query().trim().toLowerCase();

    if (cat !== 'all') {
      list = list.filter(r => r.category === cat);
    }
    if (query) {
      list = list.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    return this.sort(list);
  });

  resultSummary = computed(() => {
    const total = this.routines().length;
    const shown = this.filteredRoutines().length;
    const query = this.search.query().trim();
    const category = this.activeCategory();

    if (query) {
      return `${shown} de ${total} rutinas · “${query}”`;
    }
    if (category !== 'all') {
      return `${shown} de ${total} rutinas · ${this.categoryLabel(category)}`;
    }
    return `${total} ${total === 1 ? 'rutina' : 'rutinas'}`;
  });

  emptyMessage = computed(() => {
    if (this.search.query().trim()) return 'No hay rutinas que coincidan con tu búsqueda.';
    if (this.activeCategory() !== 'all') return 'No hay rutinas en esta categoría.';
    return 'Crea tu primera rutina para empezar.';
  });

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeAllMenus();
  }

  async ngOnInit(): Promise<void> {
    // Cerrar hojas al hacer clic fuera de ellas (registrado antes del await
    // para que no se filtre si el componente se destruye durante la carga).
    const closeMenusOnClick = () => this.closeAllMenus();
    document.addEventListener('click', closeMenusOnClick);
    this.destroyRef.onDestroy(() => document.removeEventListener('click', closeMenusOnClick));
    await this.loadRoutines();
  }


  async loadRoutines(): Promise<void> {
    this.loading.set(true);
    await this.routineRepo.seedDefaultTemplates();
    this.routines.set(await this.routineRepo.getAll());
    this.loading.set(false);
  }

  categoryLabel(cat: RoutineCategory | 'all'): string {
    return CATEGORY_LABELS[cat] ?? cat;
  }

  setCategory(cat: RoutineCategory | 'all'): void {
    this.activeCategory.set(cat);
  }

  onSortChange(event: Event): void {
    this.sortMode.set((event.target as HTMLSelectElement).value as SortMode);
    this.closeAllMenus();
  }

  calcDuration(routine: Routine): number {
    return calcRoutineDurationSec(routine);
  }

  countSteps(routine: Routine): number {
    return routine.blocks.reduce((acc, b) => acc + b.steps.length * b.repetitions, 0);
  }

  openRoutineMenu(routine: Routine, e: MouseEvent): void {
    e.stopPropagation();
    this.createMenuOpen.set(false);
    this.activeMenuRoutine.set(routine);
  }

  closeMenu(): void {
    this.activeMenuRoutine.set(null);
  }

  toggleCreateMenu(event: Event): void {
    event.stopPropagation();
    const shouldOpen = !this.createMenuOpen();
    this.closeAllMenus();
    this.createMenuOpen.set(shouldOpen);
  }

  closeCreateMenu(): void {
    this.createMenuOpen.set(false);
  }

  async duplicate(routine: Routine): Promise<void> {
    await this.routineRepo.duplicate(routine.id);
    await this.loadRoutines();
  }

  async toggleFavorite(routine: Routine): Promise<void> {
    await this.routineRepo.toggleFavorite(routine.id);
    await this.loadRoutines();
  }

  confirmDelete(routine: Routine): void {
    this.deletingRoutine.set(routine);
  }

  async deleteConfirmed(): Promise<void> {
    const routine = this.deletingRoutine();
    if (!routine) return;
    await this.routineRepo.delete(routine.id);
    this.deletingRoutine.set(null);
    await this.loadRoutines();
  }

  private closeAllMenus(): void {
    this.activeMenuRoutine.set(null);
    this.createMenuOpen.set(false);
  }

  private sort(list: Routine[]): Routine[] {
    const mode = this.sortMode();
    return [...list].sort((a, b) => {
      if (mode === 'name') return a.name.localeCompare(b.name, 'es');
      if (mode === 'created') return b.createdAt - a.createdAt;
      // recent: lastUsedAt descending, fallback to updatedAt
      const ta = a.lastUsedAt ?? a.updatedAt;
      const tb = b.lastUsedAt ?? b.updatedAt;
      return tb - ta;
    });
  }
}
