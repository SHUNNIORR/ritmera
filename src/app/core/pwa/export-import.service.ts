// ============================================================
// Intervala – Export/Import Service
// Exporta e importa un JSON versionado con validación.
// ============================================================

import { Injectable } from '@angular/core';
import {
  ExportPayload,
  Routine,
  SessionHistoryEntry,
  AppSettings,
  SCHEMA_VERSION,
} from '../timer-engine/timer-engine.types';
import { RoutineRepository } from '../persistence/routine.repository';
import { SessionRepository } from '../persistence/session.repository';
import { SettingsRepository } from '../persistence/settings.repository';

export interface ImportResult {
  success: boolean;
  routinesImported: number;
  routinesSkipped: number;
  errors: string[];
}

export type ImportStrategy = 'skip' | 'replace' | 'copy';

@Injectable({ providedIn: 'root' })
export class ExportImportService {
  private readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  private readonly APP_VERSION = '1.0.0';

  constructor(
    private routineRepo: RoutineRepository,
    private sessionRepo: SessionRepository,
    private settingsRepo: SettingsRepository
  ) {}

  async exportAll(includeHistory = false): Promise<void> {
    const [routines, settings, history] = await Promise.all([
      this.routineRepo.getAll(),
      this.settingsRepo.get(),
      includeHistory ? this.sessionRepo.getHistory(1000) : Promise.resolve(undefined),
    ]);

    const payload: ExportPayload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      appVersion: this.APP_VERSION,
      routines,
      settings,
      ...(includeHistory ? { history } : {}),
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `intervala-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File, strategy: ImportStrategy = 'skip'): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      routinesImported: 0,
      routinesSkipped: 0,
      errors: [],
    };

    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      result.errors.push('El archivo supera el tamaño máximo de 10 MB.');
      return result;
    }

    let payload: ExportPayload;
    try {
      const text = await this.readAsText(file);
      const raw = JSON.parse(text) as unknown;
      payload = this.validatePayload(raw);
    } catch (err) {
      result.errors.push(
        err instanceof Error ? err.message : 'El archivo no tiene un formato válido.'
      );
      return result;
    }

    // Importar rutinas
    const existingRoutines = await this.routineRepo.getAll();
    const existingIds = new Set(existingRoutines.map(r => r.id));

    for (const routine of payload.routines) {
      if (existingIds.has(routine.id)) {
        if (strategy === 'skip') {
          result.routinesSkipped++;
          continue;
        } else if (strategy === 'replace') {
          await this.routineRepo.save(routine);
          result.routinesImported++;
        } else if (strategy === 'copy') {
          const copy: Routine = {
            ...routine,
            id: `${routine.id}-copy-${Date.now()}`,
            name: `${routine.name} (importada)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await this.routineRepo.save(copy);
          result.routinesImported++;
        }
      } else {
        await this.routineRepo.save(routine);
        result.routinesImported++;
      }
    }

    result.success = true;
    return result;
  }

  async parsePayloadForPreview(file: File): Promise<ExportPayload | null> {
    try {
      const text = await this.readAsText(file);
      const raw = JSON.parse(text) as unknown;
      return this.validatePayload(raw);
    } catch {
      return null;
    }
  }

  private readAsText(file: File): Promise<string> {
    if (typeof file.text === 'function') {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsText(file);
    });
  }

  private validatePayload(raw: unknown): ExportPayload {
    if (!raw || typeof raw !== 'object') {
      throw new Error('El archivo no contiene un objeto JSON válido.');
    }
    const obj = raw as Record<string, unknown>;

    if (typeof obj['schemaVersion'] !== 'number') {
      throw new Error('El archivo no tiene un campo schemaVersion válido.');
    }
    if (!Array.isArray(obj['routines'])) {
      throw new Error('El campo routines debe ser un array.');
    }

    // Validar cada rutina básicamente
    for (const r of obj['routines'] as unknown[]) {
      if (!r || typeof r !== 'object') throw new Error('Una rutina tiene formato inválido.');
      const routine = r as Record<string, unknown>;
      if (typeof routine['id'] !== 'string' || !routine['id']) {
        throw new Error('Una rutina no tiene un id válido.');
      }
      if (typeof routine['name'] !== 'string' || !routine['name']) {
        throw new Error(`Una rutina no tiene nombre.`);
      }
      if (!Array.isArray(routine['blocks'])) {
        throw new Error(`La rutina "${routine['name']}" no tiene bloques válidos.`);
      }
    }

    return obj as unknown as ExportPayload;
  }
}
