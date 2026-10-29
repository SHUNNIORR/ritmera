import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-duration-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DurationInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="duration-input" [attr.aria-label]="label">
      <div class="duration-group">
        <label class="duration-label" [for]="'min-' + uid">
          <input
            type="number"
            [id]="'min-' + uid"
            class="duration-field"
            [value]="minutes"
            min="0"
            max="99"
            step="1"
            [attr.aria-label]="label + ' minutos'"
            [disabled]="disabled"
            (input)="onMinutesInput($event)"
            (blur)="onTouched()"
          />
          <span class="duration-unit">min</span>
        </label>
        <span class="duration-sep" aria-hidden="true">:</span>
        <label class="duration-label" [for]="'sec-' + uid">
          <input
            type="number"
            [id]="'sec-' + uid"
            class="duration-field"
            [value]="seconds"
            min="0"
            max="59"
            step="1"
            [attr.aria-label]="label + ' segundos'"
            [disabled]="disabled"
            (input)="onSecondsInput($event)"
            (blur)="onTouched()"
          />
          <span class="duration-unit">seg</span>
        </label>
      </div>
      @if (showError) {
        <span class="form-error" role="alert">La duración debe ser al menos 1 segundo.</span>
      }
    </div>
  `,
  styles: [`
    .duration-input { display: flex; flex-direction: column; gap: var(--space-1); }
    .duration-group { display: flex; align-items: center; gap: var(--space-2); }
    .duration-label { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .duration-field {
      width: 64px;
      height: var(--touch-target);
      text-align: center;
      font-size: var(--font-size-lg);
      font-family: var(--font-mono);
      font-weight: var(--font-weight-medium);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      -moz-appearance: textfield;
    }
    .duration-field::-webkit-inner-spin-button,
    .duration-field::-webkit-outer-spin-button { -webkit-appearance: none; }
    .duration-field:focus { outline: none; border-color: var(--color-accent); }
    .duration-unit { font-size: var(--font-size-xs); color: var(--color-text-muted); }
    .duration-sep { font-size: var(--font-size-xl); color: var(--color-text-muted); margin-bottom: 16px; }
  `],
})
export class DurationInputComponent implements ControlValueAccessor {
  @Input() label = 'Duración';
  @Input() showError = false;

  uid = Math.random().toString(36).slice(2, 8);
  minutes = 0;
  seconds = 0;
  disabled = false;

  private onChange: (val: number) => void = () => {};
  onTouched: () => void = () => {};

  /** Valor total en segundos */
  get totalSeconds(): number {
    return this.minutes * 60 + this.seconds;
  }

  writeValue(totalSec: number): void {
    const secs = Math.max(0, Math.floor(totalSec ?? 0));
    this.minutes = Math.floor(secs / 60);
    this.seconds = secs % 60;
  }

  registerOnChange(fn: (val: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onMinutesInput(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    this.minutes = isNaN(v) ? 0 : Math.min(99, Math.max(0, v));
    this.onChange(this.totalSeconds);
  }

  onSecondsInput(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    this.seconds = isNaN(v) ? 0 : Math.min(59, Math.max(0, v));
    this.onChange(this.totalSeconds);
  }
}
