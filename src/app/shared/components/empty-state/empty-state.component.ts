import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state" role="status">
      @if (icon) {
        <div class="empty-icon" aria-hidden="true">{{ icon }}</div>
      }
      <h3 class="empty-title">{{ title }}</h3>
      @if (message) {
        <p class="empty-message">{{ message }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-6);
      text-align: center;
    }
    .empty-icon {
      font-size: 3rem;
      line-height: 1;
      opacity: 0.5;
    }
    .empty-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .empty-message {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      max-width: 320px;
      line-height: var(--line-height-relaxed);
    }
  `],
})
export class EmptyStateComponent {
  @Input() title = 'Sin contenido';
  @Input() message?: string;
  @Input() icon?: string;
}
