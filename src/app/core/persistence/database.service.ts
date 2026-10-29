// ============================================================
// Intervala – Database Service (Dexie / IndexedDB)
// ============================================================

import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Routine, SessionHistoryEntry, TimerSession, AppSettings } from '../timer-engine/timer-engine.types';

export class IntervalaDB extends Dexie {
  routines!: Table<Routine, string>;
  history!: Table<SessionHistoryEntry, string>;
  activeSessions!: Table<TimerSession, string>;
  settings!: Table<AppSettings & { _key: string }, string>;

  constructor() {
    super('intervala-db');

    this.version(1).stores({
      routines: 'id, name, category, isFavorite, createdAt, updatedAt, lastUsedAt',
      history: 'id, sessionId, routineId, startedAt, status',
      activeSessions: 'id, routineId, state',
      settings: '_key',
    });
  }
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private db: IntervalaDB;
  private _available = true;

  constructor() {
    try {
      this.db = new IntervalaDB();
    } catch {
      // IndexedDB no disponible (modo privado, etc.)
      this._available = false;
      this.db = new IntervalaDB(); // fallback silencioso, Dexie manejará los errores
    }
  }

  get isAvailable(): boolean {
    return this._available;
  }

  get routines(): Table<Routine, string> {
    return this.db.routines;
  }

  get history(): Table<SessionHistoryEntry, string> {
    return this.db.history;
  }

  get activeSessions(): Table<TimerSession, string> {
    return this.db.activeSessions;
  }

  get settingsTable(): Table<AppSettings & { _key: string }, string> {
    return this.db.settings;
  }

  async transaction<T>(
    mode: 'r' | 'rw',
    tables: Dexie.Table[],
    fn: () => Promise<T>
  ): Promise<T> {
    return this.db.transaction(mode, tables, fn);
  }
}
