import { ExportImportService } from './export-import.service';
import { Routine, SCHEMA_VERSION } from '../timer-engine/timer-engine.types';

describe('ExportImportService', () => {
  let service: ExportImportService;
  let mockRoutineRepo: any;
  let mockSessionRepo: any;
  let mockSettingsRepo: any;

  beforeAll(() => {
    if (typeof File.prototype.text !== 'function') {
      File.prototype.text = function (this: File) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(this);
        });
      };
    }
  });

  const validRoutine: Routine = {
    id: 'routine-1',
    name: 'Rutina Base',
    category: 'hiit',
    color: '#ff6b35',
    tags: [],
    isFavorite: false,
    createdAt: 100,
    updatedAt: 100,
    schemaVersion: SCHEMA_VERSION,
    preferences: { soundEnabled: true, voiceEnabled: false, countdownBeforeStartSec: 0, warningBeforeEndSec: 3 },
    blocks: [
      {
        id: 'b1',
        repetitions: 1,
        restAfterLastRound: false,
        steps: [
          { id: 's1', name: 'Etapa 1', type: 'work', durationSeconds: 30, soundOnStart: true, soundOnEnd: false, voiceAnnouncement: false }
        ]
      }
    ]
  };

  beforeEach(() => {
    mockRoutineRepo = {
      getAll: jest.fn().mockResolvedValue([validRoutine]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockSessionRepo = {
      getHistory: jest.fn().mockResolvedValue([]),
    };
    mockSettingsRepo = {
      get: jest.fn().mockResolvedValue({}),
    };

    service = new ExportImportService(mockRoutineRepo, mockSessionRepo, mockSettingsRepo);
  });

  it('rejects invalid JSON structure', async () => {
    const invalidFile = new File(['invalid json string {('], 'bad.json', { type: 'application/json' });
    const result = await service.importFromFile(invalidFile, 'skip');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects JSON missing schemaVersion or routines array', async () => {
    const badPayload = JSON.stringify({ someField: 123 });
    const file = new File([badPayload], 'missing.json', { type: 'application/json' });
    const result = await service.importFromFile(file, 'skip');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('schemaVersion');
  });

  it('imports new routines successfully with skip strategy', async () => {
    const newRoutine: Routine = {
      ...validRoutine,
      id: 'routine-2',
      name: 'Rutina Nueva',
    };
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      appVersion: '1.0.0',
      routines: [validRoutine, newRoutine],
    });
    const file = new File([payload], 'backup.json', { type: 'application/json' });

    const result = await service.importFromFile(file, 'skip');

    expect(result.success).toBe(true);
    expect(result.routinesImported).toBe(1); // newRoutine
    expect(result.routinesSkipped).toBe(1);  // validRoutine already exists
    expect(mockRoutineRepo.save).toHaveBeenCalledWith(newRoutine);
  });

  it('replaces existing routines when strategy is "replace"', async () => {
    const updatedRoutine: Routine = {
      ...validRoutine,
      name: 'Rutina Modificada en Backup',
    };
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      appVersion: '1.0.0',
      routines: [updatedRoutine],
    });
    const file = new File([payload], 'backup.json', { type: 'application/json' });

    const result = await service.importFromFile(file, 'replace');

    expect(result.success).toBe(true);
    expect(result.routinesImported).toBe(1);
    expect(mockRoutineRepo.save).toHaveBeenCalledWith(updatedRoutine);
  });

  it('copies existing routines with a new ID when strategy is "copy"', async () => {
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: Date.now(),
      appVersion: '1.0.0',
      routines: [validRoutine],
    });
    const file = new File([payload], 'backup.json', { type: 'application/json' });

    const result = await service.importFromFile(file, 'copy');

    expect(result.success).toBe(true);
    expect(result.routinesImported).toBe(1);
    expect(mockRoutineRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: `${validRoutine.name} (importada)`
      })
    );
  });
});
