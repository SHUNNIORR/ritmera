import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RoutineRepository } from '../../core/persistence/routine.repository';
import { Routine, RoutineCategory } from '../../core/timer-engine/timer-engine.types';
import { calcRoutineDurationSec } from '../../core/timer-engine/timer-engine.utils';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

type SortMode = 'recent' | 'name' | 'created';

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
  imports: [RouterLink, FormsModule, DurationPipe, EmptyStateComponent, ConfirmDialogComponent],
  template: `
    <div class="library-page">
      <!-- Encabezado de sección -->
      <div class="library-header">
        <div class="library-actions">
          <a routerLink="/rutina/nueva" class="btn btn-primary" aria-label="Crear nueva rutina">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Crear rutina
          </a>
          <a routerLink="/temporizador-rapido" class="btn btn-secondary">
            Temporizador rápido
          </a>
        </div>

        <!-- Atajos de creación rápida por tipo -->
        <div class="quick-creators" aria-label="Crear según plantilla">
          <span class="quick-label">Creación guiada:</span>
          <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'tabata' }" class="chip chip-action">⚡ Tabata</a>
          <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'hiit' }" class="chip chip-action">🔥 HIIT</a>
          <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'emom' }" class="chip chip-action">⏱️ EMOM</a>
          <a [routerLink]="['/rutina/nueva']" [queryParams]="{ tipo: 'pomodoro' }" class="chip chip-action">🍅 Pomodoro</a>
        </div>

        <!-- Buscador -->
        <div class="search-wrapper">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            class="search-input"
            [(ngModel)]="searchQuery"
            placeholder="Buscar rutinas..."
            aria-label="Buscar rutinas"
          />
        </div>

        <!-- Filtros de categoría -->
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

        <!-- Ordenamiento -->
        <div class="sort-bar">
          <span class="sort-label">Ordenar:</span>
          <button class="chip" [class.active]="sortMode() === 'recent'" (click)="setSort('recent')">Recientes</button>
          <button class="chip" [class.active]="sortMode() === 'name'" (click)="setSort('name')">Nombre</button>
          <button class="chip" [class.active]="sortMode() === 'created'" (click)="setSort('created')">Creadas</button>
        </div>
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
            @if (!searchQuery) {
              <a routerLink="/rutina/nueva" class="btn btn-primary" style="margin-top: var(--space-4)">
                Crear primera rutina
              </a>
            }
          </app-empty-state>
        } @else {
          <ul class="routine-list" role="list">
            @for (routine of filteredRoutines(); track routine.id) {
              <li class="routine-card" [style.--routine-color]="routine.color">
                <!-- Color stripe -->
                <div class="routine-stripe" aria-hidden="true"></div>

                <div class="routine-info">
                  <div class="routine-top">
                    <span class="routine-category">{{ categoryLabel(routine.category) }}</span>
                    @if (routine.isFavorite) {
                      <span class="routine-fav" aria-label="Favorita">★</span>
                    }
                  </div>
                  <h3 class="routine-name">{{ routine.name }}</h3>
                  @if (routine.description) {
                    <p class="routine-desc">{{ routine.description }}</p>
                  }
                  <div class="routine-meta">
                    <span>{{ calcDuration(routine) | duration }}</span>
                    <span>·</span>
                    <span>{{ countSteps(routine) }} etapas</span>
                  </div>
                </div>

                <div class="routine-actions">
                  <a [routerLink]="['/temporizador', routine.id]"
                     class="btn btn-primary routine-start-btn"
                     [attr.aria-label]="'Iniciar ' + routine.name">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Iniciar
                  </a>

                  <!-- Menú de opciones -->
                  <div class="routine-menu">
                    <button class="btn btn-ghost btn-icon routine-menu-btn"
                            [attr.aria-label]="'Opciones para ' + routine.name"
                            [attr.aria-expanded]="openMenuId() === routine.id"
                            (click)="toggleMenu(routine.id, $event)">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                        <circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>

                    @if (openMenuId() === routine.id) {
                      <div class="dropdown-menu" role="menu"
                           [attr.aria-label]="'Acciones para ' + routine.name">
                        <a [routerLink]="['/rutina', routine.id, 'editar']"
                           class="dropdown-item" role="menuitem" (click)="closeMenu()">
                          ✏️ Editar
                        </a>
                        <button class="dropdown-item" role="menuitem"
                                (click)="duplicate(routine); closeMenu()">
                          📋 Duplicar
                        </button>
                        <button class="dropdown-item" role="menuitem"
                                (click)="toggleFavorite(routine); closeMenu()">
                          {{ routine.isFavorite ? '★ Quitar favorita' : '☆ Marcar favorita' }}
                        </button>
                        <hr class="dropdown-divider" />
                        <button class="dropdown-item danger" role="menuitem"
                                (click)="confirmDelete(routine); closeMenu()">
                          🗑️ Eliminar
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </main>
    </div>

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
      max-width: var(--content-max-width);
      margin: 0 auto;
      padding: var(--space-4);
    }

    .library-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }

    .library-actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .quick-creators {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .quick-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
    }
    .chip-action {
      background: var(--color-surface-2);
      border-color: var(--color-border-strong);
      text-decoration: none;
    }
    .chip-action:hover {
      background: var(--color-surface-3);
      color: var(--color-text-primary);
      text-decoration: none;
      border-color: var(--color-accent);
    }

    /* Buscador */
    .search-wrapper {
      position: relative;
    }
    .search-icon {
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: var(--touch-target);
      padding: 0 var(--space-3) 0 var(--space-8);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-size: var(--font-size-base);
    }
    .search-input:focus { outline: none; border-color: var(--color-accent); }

    /* Filtros */
    .filter-chips, .sort-bar {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      align-items: center;
    }
    .sort-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }

    /* Lista */
    .routine-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }

    .routine-card {
      display: flex;
      gap: var(--space-3);
      align-items: stretch;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--duration-normal) var(--easing-default);
    }
    .routine-card:hover { box-shadow: var(--shadow-md); }

    .routine-stripe {
      width: 4px;
      flex-shrink: 0;
      background: var(--routine-color, var(--color-accent));
    }

    .routine-info {
      flex: 1;
      padding: var(--space-3) var(--space-2) var(--space-3) 0;
      min-width: 0;
    }
    .routine-top {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }
    .routine-category {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .routine-fav { color: #f59e0b; }

    .routine-name {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: var(--space-1);
    }
    .routine-desc {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: var(--space-2);
    }
    .routine-meta {
      display: flex;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    .routine-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-3);
    }

    .routine-start-btn {
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      min-height: 36px;
    }

    /* Menú desplegable */
    .routine-menu { position: relative; }
    .dropdown-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      min-width: 180px;
      box-shadow: var(--shadow-lg);
      z-index: 50;
      overflow: hidden;
      animation: fadeIn var(--duration-fast) var(--easing-default);
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .dropdown-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: var(--space-3) var(--space-4);
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
      transition: background var(--duration-fast);
      font-family: inherit;
    }
    .dropdown-item:hover { background: var(--color-surface-2); }
    .dropdown-item.danger { color: var(--color-error); }
    .dropdown-divider { border: none; border-top: 1px solid var(--color-border); margin: var(--space-1) 0; }

    /* Loading */
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

    @media (min-width: 640px) {
      .routine-list { display: grid; grid-template-columns: 1fr 1fr; }
    }
    @media (min-width: 1024px) {
      .routine-list { grid-template-columns: 1fr 1fr 1fr; }
    }
  `],
})
export class LibraryComponent implements OnInit {
  private routineRepo = inject(RoutineRepository);

  routines = signal<Routine[]>([]);
  loading = signal(true);
  activeCategory = signal<RoutineCategory | 'all'>('all');
  sortMode = signal<SortMode>('recent');
  openMenuId = signal<string | null>(null);
  deletingRoutine = signal<Routine | null>(null);
  searchQuery = '';

  categories: (RoutineCategory | 'all')[] = ['all', 'hiit', 'strength', 'cardio', 'mobility', 'study', 'custom'];

  filteredRoutines = computed(() => {
    let list = this.routines();
    const cat = this.activeCategory();
    const query = this.searchQuery.toLowerCase();

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

  emptyMessage = computed(() => {
    if (this.searchQuery) return 'No hay rutinas que coincidan con tu búsqueda.';
    if (this.activeCategory() !== 'all') return 'No hay rutinas en esta categoría.';
    return 'Crea tu primera rutina para empezar.';
  });

  async ngOnInit(): Promise<void> {
    await this.loadRoutines();
    // Cerrar menús al clic exterior
    document.addEventListener('click', () => this.closeMenu());
  }

  async loadRoutines(): Promise<void> {
    this.loading.set(true);
    this.routines.set(await this.routineRepo.getAll());
    this.loading.set(false);
  }

  categoryLabel(cat: RoutineCategory | 'all'): string {
    return CATEGORY_LABELS[cat] ?? cat;
  }

  setCategory(cat: RoutineCategory | 'all'): void {
    this.activeCategory.set(cat);
  }

  setSort(mode: SortMode): void {
    this.sortMode.set(mode);
  }

  calcDuration(routine: Routine): number {
    return calcRoutineDurationSec(routine);
  }

  countSteps(routine: Routine): number {
    return routine.blocks.reduce((acc, b) => acc + b.steps.length * b.repetitions, 0);
  }

  toggleMenu(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
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
