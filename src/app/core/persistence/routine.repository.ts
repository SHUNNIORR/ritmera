// ============================================================
// Ritmera – Routine Repository
// ============================================================

import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { Routine, SCHEMA_VERSION } from '../timer-engine/timer-engine.types';
import { generateId } from '../timer-engine/timer-engine.utils';
import { defaultTemplates } from '../timer-engine/timer-engine.templates';

@Injectable({ providedIn: 'root' })
export class RoutineRepository {
  constructor(private db: DatabaseService) {}

  async getAll(): Promise<Routine[]> {
    return this.db.routines.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<Routine | undefined> {
    return this.db.routines.get(id);
  }

  async save(routine: Routine): Promise<void> {
    await this.db.routines.put(routine);
  }

  async create(partial: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Routine> {
    const now = Date.now();
    const routine: Routine = {
      ...partial,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
    await this.db.routines.add(routine);
    return routine;
  }

  async update(id: string, changes: Partial<Routine>): Promise<void> {
    await this.db.routines.update(id, { ...changes, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.db.routines.delete(id);
  }

  async duplicate(id: string): Promise<Routine | null> {
    const original = await this.getById(id);
    if (!original) return null;
    const now = Date.now();
    const copy: Routine = {
      ...original,
      id: generateId(),
      name: `${original.name} (copia)`,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
    };
    await this.db.routines.add(copy);
    return copy;
  }

  async toggleFavorite(id: string): Promise<void> {
    const routine = await this.getById(id);
    if (!routine) return;
    await this.db.routines.update(id, { isFavorite: !routine.isFavorite, updatedAt: Date.now() });
  }

  async markUsed(id: string): Promise<void> {
    await this.db.routines.update(id, { lastUsedAt: Date.now() });
  }

  async count(): Promise<number> {
    return this.db.routines.count();
  }

  private seedPromise?: Promise<void>;

  seedDefaultTemplates(): Promise<void> {
    // Comparte una sola siembra entre AppComponent y la biblioteca para
    // evitar duplicados y lecturas incompletas en el primer arranque.
    this.seedPromise ??= this.seedTemplatesOnce().catch(error => {
      this.seedPromise = undefined;
      throw error;
    });
    return this.seedPromise;
  }

  private async seedTemplatesOnce(): Promise<void> {
    const existing = await this.count();
    if (existing > 0) return;
    await this.db.routines.bulkPut(defaultTemplates());
  }
}
