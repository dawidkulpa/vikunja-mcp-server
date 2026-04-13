import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '../../src/utils/logger';
import { FilterStorageManager, SimpleFilterStorage } from '../../src/storage/SimpleFilterStorage';

describe('SimpleFilterStorage', () => {
  let storage: SimpleFilterStorage;

  beforeEach(() => {
    storage = new SimpleFilterStorage('session-1', 'user-1', 'https://api.vikunja.test');
  });

  it('throws when updating a missing filter', async () => {
    await expect(storage.update('missing-filter', { name: 'Updated' })).rejects.toThrow(
      'Filter with id missing-filter not found',
    );
  });

  it('throws when deleting a missing filter', async () => {
    await expect(storage.delete('missing-filter')).rejects.toThrow(
      'Filter with id missing-filter not found',
    );
  });

  it('returns null when a filter name does not exist', async () => {
    await storage.create({
      name: 'Existing Filter',
      filter: 'done = false',
      isGlobal: false,
    });

    await expect(storage.findByName('Missing Filter')).resolves.toBeNull();
  });

  it('returns only project filters sorted by most recently updated first', async () => {
    const older = await storage.create({
      name: 'Older Project Filter',
      filter: 'priority > 1',
      isGlobal: false,
      projectId: 42,
    });

    const newer = await storage.create({
      name: 'Newer Project Filter',
      filter: 'done = false',
      isGlobal: false,
      projectId: 42,
    });

    await storage.create({
      name: 'Different Project Filter',
      filter: 'done = true',
      isGlobal: false,
      projectId: 7,
    });

    await storage.update(older.id, { description: 'refresh timestamp' });

    await expect(storage.getByProject(42)).resolves.toMatchObject([
      { id: older.id, name: 'Older Project Filter' },
      { id: newer.id, name: 'Newer Project Filter' },
    ]);
  });

  it('returns a defensive session copy', () => {
    const session = storage.getSession();
    session.id = 'mutated-session';
    session.userId = 'mutated-user';
    session.apiUrl = 'https://mutated.example';

    expect(storage.getSession()).toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      apiUrl: 'https://api.vikunja.test',
    });
  });

  it('reports health details and clears filters on close', async () => {
    await storage.create({
      name: 'Closable Filter',
      filter: 'done = false',
      isGlobal: true,
    });

    expect(storage.healthCheck()).toEqual({
      healthy: true,
      details: {
        storageType: 'memory',
        filterCount: 1,
        sessionId: 'session-1',
      },
    });

    await storage.close();

    await expect(storage.list()).resolves.toEqual([]);
  });
});

describe('FilterStorageManager', () => {
  let manager: FilterStorageManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    manager = new FilterStorageManager();
  });

  afterEach(async () => {
    await manager.destroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('refreshes session access time when an existing storage is requested again', async () => {
    const storage = await manager.getStorage('repeat-session');
    (storage as any).session.lastAccessAt = new Date(0);

    await manager.getStorage('repeat-session');

    expect(storage.getSession().lastAccessAt.getTime()).toBeGreaterThan(0);
  });

  it('aggregates statistics across active sessions', async () => {
    const first = await manager.getStorage('stats-1');
    const second = await manager.getStorage('stats-2');

    await first.create({
      name: 'First Session Filter',
      filter: 'done = false',
      isGlobal: false,
    });

    await second.create({
      name: 'Second Session Filter',
      filter: 'done = true',
      isGlobal: true,
    });

    await expect(manager.getAllStats()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: 'stats-1', filterCount: 1, memoryUsageKb: 0 }),
        expect.objectContaining({ sessionId: 'stats-2', filterCount: 1, memoryUsageKb: 0 }),
      ]),
    );
  });

  it('cleans up inactive sessions while keeping active ones', async () => {
    const expired = await manager.getStorage('expired-session');
    const active = await manager.getStorage('active-session');

    (expired as any).session.lastAccessAt = new Date(Date.now() - (2 * 60 * 60 * 1000));
    (active as any).session.lastAccessAt = new Date();

    await (manager as any).cleanupInactiveSessions();

    await expect(manager.getAllStats()).resolves.toEqual([
      expect.objectContaining({ sessionId: 'active-session', filterCount: 0 }),
    ]);
  });

  it('logs cleanup errors raised by the cleanup timer callback', async () => {
    const cleanupSpy = jest
      .spyOn(manager as any, 'cleanupInactiveSessions')
      .mockRejectedValueOnce(new Error('cleanup failed'));

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith('Failed to cleanup inactive sessions', {
      error: 'cleanup failed',
    });

    cleanupSpy.mockRestore();
  });

  it('destroys managed storage instances and clears their data', async () => {
    const storage = await manager.getStorage('destroy-session');
    await storage.create({
      name: 'Destroy Me',
      filter: 'done = false',
      isGlobal: false,
    });

    await manager.destroy();

    await expect(manager.getAllStats()).resolves.toEqual([]);
  });

  it('stops the cleanup timer safely more than once', () => {
    manager.stopCleanupTimer();
    manager.stopCleanupTimer();

    expect(true).toBe(true);
  });
});

describe('SimpleFilterStorage process handlers', () => {
  async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function loadIsolatedModule() {
    const handlers: Partial<Record<'exit' | 'SIGINT' | 'SIGTERM', () => void>> = {};

    const onSpy = jest
      .spyOn(process, 'on')
      .mockImplementation(((event: string, handler: () => void) => {
        if (event === 'exit' || event === 'SIGINT' || event === 'SIGTERM') {
          handlers[event] = handler;
        }
        return process;
      }) as typeof process.on);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((_code?: number) => undefined as never) as typeof process.exit);

    let isolatedModule: typeof import('../../src/storage/SimpleFilterStorage');
    jest.isolateModules(() => {
      isolatedModule = require('../../src/storage/SimpleFilterStorage');
    });

    return {
      handlers,
      exitSpy,
      onSpy,
      isolatedModule: isolatedModule!,
    };
  }

  function setDestroyResult(
    isolatedModule: typeof import('../../src/storage/SimpleFilterStorage'),
    outcome: 'resolve' | 'reject',
  ): jest.MockedFunction<() => Promise<void>> {
    if (outcome === 'resolve') {
      const destroyMock = jest.fn<() => Promise<void>>(async () => undefined);
      isolatedModule.storageManager.destroy = destroyMock;
      return destroyMock;
    }

    const destroyMock = jest.fn<() => Promise<void>>(async () => {
      throw new Error('shutdown failed');
    });
    isolatedModule.storageManager.destroy = destroyMock;
    return destroyMock;
  }

  it('registers an exit handler that destroys storage', async () => {
    const { handlers, isolatedModule, onSpy } = loadIsolatedModule();
    const destroyMock = setDestroyResult(isolatedModule, 'resolve');

    handlers.exit?.();
    await flushPromises();

    expect(onSpy).toHaveBeenCalled();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('exits successfully for SIGINT and SIGTERM when destroy resolves', async () => {
    const { handlers, isolatedModule, exitSpy } = loadIsolatedModule();
    setDestroyResult(isolatedModule, 'resolve');

    handlers.SIGINT?.();
    await flushPromises();

    handlers.SIGTERM?.();
    await flushPromises();

    expect(exitSpy).toHaveBeenNthCalledWith(1, 0);
    expect(exitSpy).toHaveBeenNthCalledWith(2, 0);
  });

  it('exits with failure for SIGINT and SIGTERM when destroy rejects', async () => {
    const { handlers, isolatedModule, exitSpy } = loadIsolatedModule();
    setDestroyResult(isolatedModule, 'reject');

    handlers.SIGINT?.();
    await flushPromises();

    handlers.SIGTERM?.();
    await flushPromises();

    expect(exitSpy).toHaveBeenNthCalledWith(1, 1);
    expect(exitSpy).toHaveBeenNthCalledWith(2, 1);
  });
});
