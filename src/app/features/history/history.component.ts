import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionRepository } from '../../core/persistence/session.repository';
import { SessionHistoryEntry, SessionStatus } from '../../core/timer-engine/timer-engine.types';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink, DurationPipe, EmptyStateComponent, ConfirmDialogComponent],
  template: `
    <div class="history-page">
      <header class="history-header">
        <div class="title-row">
          <h1 class="history-title">Historial de entrenamientos</h1>
          <button *ngIf="entries().length > 0" class="btn btn-ghost danger-btn" (click)="confirmClearAll()">
            Borrar historial
          </button>
        </div>

        <!-- Filtros de estado -->
        <div class="filter-chips" *ngIf="entries().length > 0">
          <button class="chip" [class.active]="filter() === 'all'" (click)="setFilter('all')">
            Todos ({{ entries().length }})
          </button>
          <button class="chip" [class.active]="filter() === 'completed'" (click)="setFilter('completed')">
            Completados ({{ completedCount() }})
          </button>
          <button class="chip" [class.active]="filter() === 'interrupted'" (click)="setFilter('interrupted')">
            Interrumpidos ({{ interruptedCount() }})
          </button>
        </div>
      </header>

      <main class="history-content">
        <app-empty-state
          *ngIf="filteredEntries().length === 0"
          icon="📅"
          title="Sin registros"
          message="Los entrenamientos que realices se guardarán automáticamente aquí.">
          <a routerLink="/biblioteca" class="btn btn-primary" style="margin-top: var(--space-4)">
            Ir a mis rutinas
          </a>
        </app-empty-state>

        <ul class="history-list" *ngIf="filteredEntries().length > 0" role="list">
          <li *ngFor="let item of filteredEntries()" class="history-card card">
            <div class="status-indicator" [class.completed]="item.status === 'completed'" [class.interrupted]="item.status !== 'completed'"></div>

            <div class="history-info">
              <div class="history-meta-top">
                <span class="routine-name">{{ item.routineName }}</span>
                <span class="history-date">{{ formatDate(item.startedAt) }}</span>
              </div>

              <div class="history-stats">
                <span class="stat-pill">
                  ⏱️ {{ (item.actualDurationMs / 1000) | duration }}
                  <small *ngIf="item.plannedDurationSec" class="stat-planned">
                    (plan: {{ item.plannedDurationSec | duration }})
                  </small>
                </span>
                <span class="stat-pill">
                  🎯 {{ item.stepsCompleted }} / {{ item.totalSteps }} etapas
                </span>
                <span class="status-badge" [class.badge-completed]="item.status === 'completed'">
                  {{ item.status === 'completed' ? 'Completado' : 'Interrumpido' }}
                </span>
              </div>
            </div>

            <button class="btn btn-ghost btn-icon delete-btn" (click)="confirmDelete(item)" aria-label="Eliminar registro">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </li>
        </ul>
      </main>
    </div>

    <!-- Confirmación de borrado individual -->
    <app-confirm-dialog
      *ngIf="itemToDelete()"
      title="Eliminar registro"
      message="¿Seguro que deseas eliminar este registro del historial?"
      confirmLabel="Eliminar"
      [isDanger]="true"
      (confirmed)="deleteItem()"
      (cancelled)="itemToDelete.set(null)" />

    <!-- Confirmación de borrado completo -->
    <app-confirm-dialog
      *ngIf="showClearAllConfirm()"
      title="Borrar todo el historial"
      message="Esta acción eliminará permanentemente todos los entrenamientos guardados. No se puede deshacer."
      confirmLabel="Borrar todo"
      [isDanger]="true"
      (confirmed)="clearAllHistory()"
      (cancelled)="showClearAllConfirm.set(false)" />
  `,
  styles: [`
    .history-page {
      max-width: var(--content-max-width);
      margin: 0 auto;
      padding: var(--space-4);
    }
    .history-header {
      margin-bottom: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .history-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
    }
    .danger-btn {
      color: var(--color-error);
      font-size: var(--font-size-sm);
    }
    .filter-chips {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .history-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .history-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }
    .status-indicator {
      width: 4px;
      height: 48px;
      border-radius: var(--radius-full);
      background: var(--color-text-muted);
      flex-shrink: 0;
    }
    .status-indicator.completed {
      background: var(--color-success);
    }
    .status-indicator.interrupted {
      background: var(--color-warning);
    }
    .history-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }
    .history-meta-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-2);
    }
    .routine-name {
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-md);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .history-date {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .history-stats {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-xs);
    }
    .stat-pill {
      background: var(--color-surface-2);
      padding: 3px var(--space-2);
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-family: var(--font-mono);
    }
    .stat-planned {
      color: var(--color-text-muted);
    }
    .status-badge {
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      font-size: 0.7rem;
      background: rgba(245, 158, 11, 0.15);
      color: var(--color-warning);
      font-weight: var(--font-weight-medium);
    }
    .badge-completed {
      background: rgba(34, 197, 94, 0.15);
      color: var(--color-success);
    }
    .delete-btn {
      color: var(--color-text-muted);
    }
    .delete-btn:hover {
      color: var(--color-error);
    }
  `],
})
export class HistoryComponent implements OnInit {
  private sessionRepo = inject(SessionRepository);

  entries = signal<SessionHistoryEntry[]>([]);
  filter = signal<'all' | 'completed' | 'interrupted'>('all');
  itemToDelete = signal<SessionHistoryEntry | null>(null);
  showClearAllConfirm = signal<boolean>(false);

  completedCount = computed(() => this.entries().filter(e => e.status === 'completed').length);
  interruptedCount = computed(() => this.entries().filter(e => e.status !== 'completed').length);

  filteredEntries = computed(() => {
    const list = this.entries();
    const f = this.filter();
    if (f === 'all') return list;
    if (f === 'completed') return list.filter(e => e.status === 'completed');
    return list.filter(e => e.status !== 'completed');
  });

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const list = await this.sessionRepo.getHistory(200);
    this.entries.set(list);
  }

  setFilter(f: 'all' | 'completed' | 'interrupted'): void {
    this.filter.set(f);
  }

  formatDate(epochMs: number): string {
    const d = new Date(epochMs);
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  confirmDelete(entry: SessionHistoryEntry): void {
    this.itemToDelete.set(entry);
  }

  async deleteItem(): Promise<void> {
    const item = this.itemToDelete();
    if (!item) return;
    await this.sessionRepo.deleteHistoryEntry(item.id);
    this.itemToDelete.set(null);
    await this.loadHistory();
  }

  confirmClearAll(): void {
    this.showClearAllConfirm.set(true);
  }

  async clearAllHistory(): Promise<void> {
    await this.sessionRepo.clearAllHistory();
    this.showClearAllConfirm.set(false);
    await this.loadHistory();
  }
}
