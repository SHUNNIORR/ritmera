// ============================================================
// Ritmera – Settings Repository
// ============================================================

import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { AppSettings } from '../timer-engine/timer-engine.types';
import { defaultSettings } from '../timer-engine/timer-engine.utils';

const SETTINGS_KEY = 'app-settings';

@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  constructor(private db: DatabaseService) {}

  async get(): Promise<AppSettings> {
    const stored = await this.db.settingsTable.get(SETTINGS_KEY);
    if (!stored) return defaultSettings();
    const { _key, ...settings } = stored;
    return { ...defaultSettings(), ...settings };
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.settingsTable.put({ ...settings, _key: SETTINGS_KEY });
  }

  async reset(): Promise<void> {
    await this.db.settingsTable.delete(SETTINGS_KEY);
  }
}
