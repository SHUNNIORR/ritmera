import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsRepository } from '../../core/persistence/settings.repository';
import { RoutineRepository } from '../../core/persistence/routine.repository';
import { SessionRepository } from '../../core/persistence/session.repository';
import { ExportImportService, ImportStrategy, ImportResult } from '../../core/pwa/export-import.service';
import { WakeLockService } from '../../core/pwa/wake-lock.service';
import { SpeechService } from '../../core/audio/speech.service';
import { AppSettings, ThemePreference, ExportPayload } from '../../core/timer-engine/timer-engine.types';
import { defaultSettings } from '../../core/timer-engine/timer-engine.utils';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="settings-page">
      <header class="settings-header">
        <h1 class="settings-title">Ajustes y Configuración</h1>
      </header>

      <!-- SECCIÓN: Apariencia -->
      <section class="card settings-card" aria-label="Apariencia">
        <h2 class="card-title">🎨 Apariencia</h2>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Tema de la interfaz</span>
            <span class="setting-desc">Ajusta el contraste a tu preferencia visual</span>
          </div>
          <div class="theme-options">
            <button class="chip" [class.active]="settings.theme === 'system'" (click)="setTheme('system')">
              Sistema
            </button>
            <button class="chip" [class.active]="settings.theme === 'light'" (click)="setTheme('light')">
              Claro
            </button>
            <button class="chip" [class.active]="settings.theme === 'dark'" (click)="setTheme('dark')">
              Oscuro
            </button>
          </div>
        </div>
      </section>

      <!-- SECCIÓN: Audio y Anuncios -->
      <section class="card settings-card" aria-label="Audio y Avisos">
        <h2 class="card-title">🔊 Audio y Guía por Voz</h2>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Sonidos de aviso</span>
            <span class="setting-desc">Tonos sintetizados con Web Audio API (offline)</span>
          </div>
          <input type="checkbox" [(ngModel)]="settings.soundEnabled" (change)="saveSettings()" class="toggle-checkbox" />
        </div>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Guía por voz (Speech)</span>
            <span class="setting-desc">
              {{ isSpeechSupported ? 'Anunciar nombres de etapas' : 'No disponible en este navegador' }}
            </span>
          </div>
          <input type="checkbox" [disabled]="!isSpeechSupported" [(ngModel)]="settings.voiceEnabled" (change)="saveSettings()" class="toggle-checkbox" />
        </div>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Aviso previo a finalizar etapa (segundos)</span>
            <span class="setting-desc">Alerta sonora antes del cambio de etapa</span>
          </div>
          <input type="number" min="0" max="10" [(ngModel)]="settings.warningBeforeEndSec" (change)="saveSettings()" class="form-input num-input" />
        </div>
      </section>

      <!-- SECCIÓN: Pantalla y Temporización -->
      <section class="card settings-card" aria-label="Pantalla y Rendimiento">
        <h2 class="card-title">📱 Pantalla y Rendimiento</h2>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Mantener pantalla encendida (Wake Lock)</span>
            <span class="setting-desc">
              {{ isWakeLockSupported ? 'Evita que la pantalla se apague durante el entrenamiento' : 'No soportado en este dispositivo/navegador (ej. iOS)' }}
            </span>
          </div>
          <input type="checkbox" [disabled]="!isWakeLockSupported" [(ngModel)]="settings.keepScreenAwake" (change)="saveSettings()" class="toggle-checkbox" />
        </div>

        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Mostrar tiempo acumulado / restante</span>
            <span class="setting-desc">Información global en la pantalla del cronómetro</span>
          </div>
          <input type="checkbox" [(ngModel)]="settings.showElapsedTime" (change)="saveSettings()" class="toggle-checkbox" />
        </div>
      </section>

      <!-- SECCIÓN: Transparencia de Plataforma -->
      <section class="card settings-card platform-card" aria-label="Límites de plataforma">
        <h2 class="card-title">ℹ️ Transparencia de la Plataforma (PWA)</h2>
        <div class="platform-info-text">
          <p><strong>Almacenamiento Local (Local-First):</strong> Tus rutinas e historial se guardan en <code>IndexedDB</code> en este dispositivo. Si borras la caché o datos del navegador, podrían perderse. Haz copias de seguridad periódicas.</p>
          <p><strong>Segundo Plano y Suspensión:</strong> Las PWAs dependen de las políticas del sistema operativo. En sistemas como <strong>iOS (Safari)</strong>, el hilo de JavaScript se suspende cuando sales de la app. Intervala recalcula el tiempo exacto mediante marcas de tiempo al reabrir la app, pero no puede garantizar alertas sonoras continuas si la pantalla se bloquea.</p>
        </div>
      </section>

      <!-- SECCIÓN: Copias de Seguridad (Exportar / Importar) -->
      <section class="card settings-card" aria-label="Copias de seguridad">
        <h2 class="card-title">💾 Copias de Seguridad (Backup JSON)</h2>

        <div class="backup-actions">
          <button class="btn btn-secondary" (click)="exportData(false)">
            Exportar Rutinas (JSON)
          </button>
          <button class="btn btn-secondary" (click)="exportData(true)">
            Exportar Todo (+ Historial)
          </button>
        </div>

        <div class="import-box">
          <span class="import-label">Importar desde archivo JSON:</span>
          <input type="file" accept=".json,application/json" (change)="onFileSelected($event)" class="file-input" />
        </div>

        <!-- Previsualización de importación -->
        <div *ngIf="pendingImportPayload" class="import-preview card">
          <h3>Confirmar Importación</h3>
          <p>El archivo contiene <strong>{{ pendingImportPayload.routines.length }}</strong> rutinas (Versión esquema: {{ pendingImportPayload.schemaVersion }}).</p>

          <div class="strategy-selector">
            <label class="strategy-option">
              <input type="radio" name="strategy" [(ngModel)]="importStrategy" value="skip" />
              <span>Omitir rutinas ya existentes</span>
            </label>
            <label class="strategy-option">
              <input type="radio" name="strategy" [(ngModel)]="importStrategy" value="replace" />
              <span>Sobrescribir existentes</span>
            </label>
            <label class="strategy-option">
              <input type="radio" name="strategy" [(ngModel)]="importStrategy" value="copy" />
              <span>Crear como copias nuevas</span>
            </label>
          </div>

          <div class="import-dialog-actions">
            <button class="btn btn-ghost" (click)="cancelImport()">Cancelar</button>
            <button class="btn btn-primary" (click)="executeImport()">Procesar Importación</button>
          </div>
        </div>

        <div *ngIf="importFeedback" class="import-feedback" [class.success]="importFeedback.success" [class.error]="!importFeedback.success">
          {{ importFeedback.message }}
        </div>
      </section>

      <!-- SECCIÓN: Zona de Peligro -->
      <section class="card settings-card danger-zone" aria-label="Zona de peligro">
        <h2 class="card-title danger-title">⚠️ Gestión de Datos</h2>
        <div class="danger-actions">
          <button class="btn btn-ghost" (click)="confirmResetSettings()">
            Restablecer ajustes por defecto
          </button>
          <button class="btn btn-danger" (click)="confirmWipeAll()">
            Borrar todos los datos locales
          </button>
        </div>
      </section>
    </div>

    <!-- Modales de confirmación -->
    <app-confirm-dialog
      *ngIf="showResetConfirm"
      title="Restablecer ajustes"
      message="¿Deseas restaurar la configuración predeterminada de la aplicación?"
      confirmLabel="Restablecer"
      (confirmed)="resetSettings()"
      (cancelled)="showResetConfirm = false" />

    <app-confirm-dialog
      *ngIf="showWipeConfirm"
      title="¡Atención! Borrar todos los datos"
      message="Esta acción eliminará todas tus rutinas, historial y configuraciones permanentemente. ¿Estás absolutamente seguro?"
      confirmLabel="Borrar todo"
      [isDanger]="true"
      (confirmed)="wipeAllData()"
      (cancelled)="showWipeConfirm = false" />
  `,
  styles: [`
    .settings-page {
      max-width: var(--content-max-width);
      margin: 0 auto;
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .settings-header {
      margin-bottom: var(--space-2);
    }
    .settings-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
    }
    .settings-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .card-title {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      border-bottom: 1px solid var(--color-border);
      padding-bottom: var(--space-2);
    }
    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) 0;
    }
    .setting-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .setting-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }
    .setting-desc {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .theme-options {
      display: flex;
      gap: var(--space-2);
    }
    .toggle-checkbox {
      width: 20px;
      height: 20px;
      accent-color: var(--color-accent);
      cursor: pointer;
    }
    .num-input {
      width: 60px;
      text-align: center;
    }
    .platform-card {
      background: var(--color-surface-2);
      border-color: var(--color-border-strong);
    }
    .platform-info-text {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      line-height: var(--line-height-relaxed);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .backup-actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .import-box {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .import-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }
    .file-input {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }
    .import-preview {
      background: var(--color-surface-2);
      border: 1px dashed var(--color-accent);
      padding: var(--space-3);
      margin-top: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .strategy-selector {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
    }
    .strategy-option {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }
    .import-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }
    .import-feedback {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      margin-top: var(--space-2);
    }
    .import-feedback.success {
      background: rgba(34, 197, 94, 0.15);
      color: var(--color-success);
    }
    .import-feedback.error {
      background: rgba(239, 68, 68, 0.15);
      color: var(--color-error);
    }
    .danger-zone {
      border-color: rgba(239, 68, 68, 0.3);
    }
    .danger-title {
      color: var(--color-error);
    }
    .danger-actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
  `],
})
export class SettingsComponent implements OnInit {
  private settingsRepo = inject(SettingsRepository);
  private routineRepo = inject(RoutineRepository);
  private sessionRepo = inject(SessionRepository);
  private exportImport = inject(ExportImportService);
  private wakeLock = inject(WakeLockService);
  private speech = inject(SpeechService);

  settings: AppSettings = defaultSettings();
  isWakeLockSupported = false;
  isSpeechSupported = false;

  showResetConfirm = false;
  showWipeConfirm = false;

  pendingFile: File | null = null;
  pendingImportPayload: ExportPayload | null = null;
  importStrategy: ImportStrategy = 'skip';
  importFeedback: { success: boolean; message: string } | null = null;

  async ngOnInit(): Promise<void> {
    this.settings = await this.settingsRepo.get();
    this.isWakeLockSupported = this.wakeLock.isSupported;
    this.isSpeechSupported = this.speech.isAvailable;
  }

  async saveSettings(): Promise<void> {
    await this.settingsRepo.save(this.settings);
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    this.settings.theme = theme;
    await this.saveSettings();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  async exportData(includeHistory: boolean): Promise<void> {
    await this.exportImport.exportAll(includeHistory);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.pendingFile = input.files[0];
    this.pendingImportPayload = await this.exportImport.parsePayloadForPreview(this.pendingFile);
    if (!this.pendingImportPayload) {
      this.importFeedback = {
        success: false,
        message: 'Archivo JSON inválido o incompatible con el esquema.'
      };
      this.pendingFile = null;
    } else {
      this.importFeedback = null;
    }
  }

  cancelImport(): void {
    this.pendingFile = null;
    this.pendingImportPayload = null;
  }

  async executeImport(): Promise<void> {
    if (!this.pendingFile) return;
    const result: ImportResult = await this.exportImport.importFromFile(this.pendingFile, this.importStrategy);
    if (result.success) {
      this.importFeedback = {
        success: true,
        message: `Importación exitosa: ${result.routinesImported} rutinas procesadas, ${result.routinesSkipped} omitidas.`
      };
    } else {
      this.importFeedback = {
        success: false,
        message: `Error al importar: ${result.errors.join(', ')}`
      };
    }
    this.cancelImport();
  }

  confirmResetSettings(): void {
    this.showResetConfirm = true;
  }

  async resetSettings(): Promise<void> {
    await this.settingsRepo.reset();
    this.settings = await this.settingsRepo.get();
    this.setTheme(this.settings.theme);
    this.showResetConfirm = false;
  }

  confirmWipeAll(): void {
    this.showWipeConfirm = true;
  }

  async wipeAllData(): Promise<void> {
    // Clear all tables
    const routines = await this.routineRepo.getAll();
    for (const r of routines) {
      await this.routineRepo.delete(r.id);
    }
    await this.sessionRepo.clearAllHistory();
    await this.sessionRepo.clearActiveSession();
    await this.settingsRepo.reset();
    this.settings = await this.settingsRepo.get();
    this.setTheme(this.settings.theme);
    this.showWipeConfirm = false;
  }
}
