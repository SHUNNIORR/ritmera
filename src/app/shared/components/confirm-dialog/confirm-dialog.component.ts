import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dialog-overlay" role="dialog" aria-modal="true"
         [attr.aria-labelledby]="'dialog-title-' + uid"
         [attr.aria-describedby]="'dialog-desc-' + uid"
         (click)="onOverlayClick($event)">
      <div class="dialog-panel" #panel>
        <h2 [id]="'dialog-title-' + uid" class="dialog-title">{{ title }}</h2>
        @if (message) {
          <p [id]="'dialog-desc-' + uid" class="dialog-message">{{ message }}</p>
        }
        <div class="dialog-actions">
          <button class="btn btn-ghost" (click)="onCancel()" [attr.aria-label]="cancelLabel">
            {{ cancelLabel }}
          </button>
          <button class="btn" [class.btn-danger]="isDanger" [class.btn-primary]="!isDanger"
                  (click)="onConfirm()" [attr.aria-label]="confirmLabel" cdkFocusInitial>
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: var(--space-4);
      animation: fadeIn var(--duration-normal) var(--easing-default);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .dialog-panel {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-xl);
      padding: var(--space-6);
      max-width: 400px;
      width: 100%;
      box-shadow: var(--shadow-lg);
      animation: slideIn var(--duration-normal) var(--easing-default);
    }
    @keyframes slideIn {
      from { transform: scale(0.95) translateY(8px); opacity: 0; }
      to   { transform: scale(1) translateY(0); opacity: 1; }
    }
    .dialog-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      margin-bottom: var(--space-2);
    }
    .dialog-message {
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-6);
      line-height: var(--line-height-relaxed);
    }
    .dialog-actions {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
    }
  `],
})
export class ConfirmDialogComponent {
  @Input() title = '¿Estás seguro?';
  @Input() message?: string;
  @Input() confirmLabel = 'Confirmar';
  @Input() cancelLabel = 'Cancelar';
  @Input() isDanger = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  uid = Math.random().toString(36).slice(2, 8);

  @HostListener('keydown.escape')
  onCancel(): void {
    this.cancelled.emit();
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.onCancel();
    }
  }
}
