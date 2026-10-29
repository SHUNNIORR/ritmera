// ============================================================
// Ritmera – Session Repository
// ============================================================

import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { TimerSession, SessionHistoryEntry, SCHEMA_VERSION } from '../timer-engine/timer-engine.types';
import { generateId } from '../timer-engine/timer-engine.utils';

@Injectable({ providedIn: 'root' })
export class SessionRepository {
  private readonly ACTIVE_KEY = 'active';

  constructor(private db: DatabaseService) {}

  // ── Sesión activa ───────────────────────────────────────────
  async saveActiveSession(session: TimerSession): Promise<void> {
    await this.db.activeSessions.put(session);
  }

  async getActiveSession(): Promise<TimerSession | undefined> {
    const sessions = await this.db.activeSessions
      .filter(s => s.state === 'running' || s.state === 'paused')
      .toArray();
    return sessions[0];
  }

  async clearActiveSession(sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.db.activeSessions.delete(sessionId);
    } else {
      await this.db.activeSessions.clear();
    }
  }

  // ── Historial ───────────────────────────────────────────────
  async addHistoryEntry(entry: Omit<SessionHistoryEntry, 'id' | 'schemaVersion'>): Promise<SessionHistoryEntry> {
    const record: SessionHistoryEntry = {
      ...entry,
      id: generateId(),
      schemaVersion: SCHEMA_VERSION,
    };
    await this.db.history.add(record);
    return record;
  }

  async getHistory(limit = 100): Promise<SessionHistoryEntry[]> {
    return this.db.history.orderBy('startedAt').reverse().limit(limit).toArray();
  }

  async getHistoryByRoutine(routineId: string): Promise<SessionHistoryEntry[]> {
    return this.db.history
      .where('routineId')
      .equals(routineId)
      .reverse()
      .sortBy('startedAt');
  }

  async deleteHistoryEntry(id: string): Promise<void> {
    await this.db.history.delete(id);
  }

  async clearAllHistory(): Promise<void> {
    await this.db.history.clear();
  }

  async historyCount(): Promise<number> {
    return this.db.history.count();
  }
}
