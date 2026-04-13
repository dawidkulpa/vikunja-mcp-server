import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MCPError, ErrorCode } from '../../src/types';
import { TaskFilteringOrchestrator } from '../../src/tools/tasks/filtering/TaskFilteringOrchestrator';
import { FilterValidator } from '../../src/tools/tasks/filtering/FilterValidator';
import { FilterExecutor } from '../../src/tools/tasks/filtering/FilterExecutor';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/tools/tasks/filtering/FilterValidator', () => ({
  FilterValidator: {
    validateTaskFiltering: jest.fn(),
    validateLoadedTasks: jest.fn(),
  },
}));

jest.mock('../../src/tools/tasks/filtering/FilterExecutor', () => ({
  FilterExecutor: {
    prepareQueryParameters: jest.fn(),
    executeFiltering: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TaskFilteringOrchestrator behavior', () => {
  const storage = {} as any;
  const args = { filter: 'done = false', filterId: 'f1', projectId: 7, page: 2, perPage: 50, search: 'ab', sort: 'id' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FilterValidator.validateTaskFiltering as jest.Mock).mockResolvedValue({
      filterExpression: { groups: [] },
      filterString: 'done = false',
      validationWarnings: ['warn-1'],
      memoryValidation: { isValid: true, warnings: [], maxAllowed: 100 },
    });
    (FilterExecutor.prepareQueryParameters as jest.Mock).mockReturnValue({ page: 2 });
    (FilterExecutor.executeFiltering as jest.Mock).mockResolvedValue({
      tasks: [{ id: 1 }],
      metadata: {
        serverSideFilteringUsed: true,
        serverSideFilteringAttempted: true,
        clientSideFiltering: false,
        filteringNote: 'server side',
      },
    });
    (FilterValidator.validateLoadedTasks as jest.Mock).mockReturnValue({ isValid: true, warnings: ['warn-2'], shouldThrow: false });
  });

  it('executes validation, filtering, and warning logging on success', async () => {
    const result = await TaskFilteringOrchestrator.executeTaskFiltering(args, storage, { performanceWarningThreshold: 5 });

    expect(FilterValidator.validateTaskFiltering).toHaveBeenCalledWith(args, storage, { performanceWarningThreshold: 5 });
    expect(FilterExecutor.prepareQueryParameters).toHaveBeenCalledWith(args);
    expect(FilterExecutor.executeFiltering).toHaveBeenCalledWith(args, { groups: [] }, 'done = false', { page: 2 }, storage);
    expect(FilterValidator.validateLoadedTasks).toHaveBeenCalledWith(1);
    expect(logger.warn).toHaveBeenNthCalledWith(1, 'Task filtering validation warnings', { warnings: ['warn-1'] });
    expect(logger.warn).toHaveBeenNthCalledWith(2, 'Task filtering result warnings', { warnings: ['warn-2'] });
    expect(result.tasks).toHaveLength(1);
  });

  it('throws an internal MCPError when loaded-task validation demands it', async () => {
    (FilterValidator.validateLoadedTasks as jest.Mock).mockReturnValue({
      isValid: false,
      warnings: ['too many tasks'],
      shouldThrow: true,
    });

    await expect(TaskFilteringOrchestrator.executeTaskFiltering(args, storage)).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task filtering result validation failed: too many tasks',
    });
  });

  it('passes through MCPError failures and logs generic failures', async () => {
    const passthrough = new MCPError(ErrorCode.VALIDATION_ERROR, 'bad filter');
    (FilterValidator.validateTaskFiltering as jest.Mock).mockRejectedValueOnce(passthrough);
    await expect(TaskFilteringOrchestrator.executeTaskFiltering(args, storage)).rejects.toBe(passthrough);

    const generic = new Error('boom');
    (FilterValidator.validateTaskFiltering as jest.Mock).mockRejectedValueOnce(generic);
    await expect(TaskFilteringOrchestrator.executeTaskFiltering(args, storage)).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalledWith('Task filtering orchestration failed', {
      error: 'boom',
      args: { hasFilter: true, hasFilterId: true, projectId: 7 },
    });
  });

  it('returns validation results for success, MCPError, and generic failures', async () => {
    await expect(TaskFilteringOrchestrator.validateTaskFiltering(args, storage)).resolves.toEqual({
      isValid: true,
      warnings: ['warn-1'],
      errors: [],
      memoryValidation: { isValid: true, warnings: [], maxAllowed: 100 },
    });

    (FilterValidator.validateTaskFiltering as jest.Mock).mockRejectedValueOnce(new MCPError(ErrorCode.VALIDATION_ERROR, 'broken'));
    await expect(TaskFilteringOrchestrator.validateTaskFiltering(args, storage)).resolves.toEqual({
      isValid: false,
      warnings: [],
      errors: ['broken'],
      memoryValidation: { isValid: false, warnings: [] },
    });

    (FilterValidator.validateTaskFiltering as jest.Mock).mockRejectedValueOnce(new Error('kaboom'));
    await expect(TaskFilteringOrchestrator.validateTaskFiltering(args, storage)).resolves.toEqual({
      isValid: false,
      warnings: [],
      errors: ['Validation failed: kaboom'],
      memoryValidation: { isValid: false, warnings: [] },
    });
  });

  it('creates filtering context and analyzes performance recommendations', () => {
    const context = TaskFilteringOrchestrator.createFilteringContext(
      args,
      {
        success: true,
        tasks: [{ id: 1 }, { id: 2 }] as any,
        metadata: {
          serverSideFilteringUsed: false,
          serverSideFilteringAttempted: true,
          clientSideFiltering: true,
          filteringNote: 'fallback',
        },
        memoryInfo: { actualCount: 20, maxAllowed: 10, estimatedMemoryMB: 12 },
      },
    );

    expect(context.input).toEqual({
      hasFilter: true,
      hasFilterId: true,
      projectId: 7,
      page: 2,
      perPage: 50,
      search: 'ab',
      sort: 'id',
    });
    expect(context.output).toEqual({
      taskCount: 2,
      serverSideFilteringUsed: false,
      serverSideFilteringAttempted: true,
      clientSideFiltering: true,
      filteringNote: 'fallback',
      memoryInfo: { actualCount: 20, maxAllowed: 10, estimatedMemoryMB: 12 },
    });
    expect(context.performance.timestamp).toEqual(expect.any(String));

    const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
      { filter: 'done = false', perPage: 600, search: 'ab' } as any,
      {
        success: true,
        tasks: [] as any,
        metadata: {
          serverSideFilteringUsed: false,
          serverSideFilteringAttempted: true,
          clientSideFiltering: true,
          filteringNote: 'fallback',
        },
        memoryInfo: { actualCount: 20, maxAllowed: 10, estimatedMemoryMB: 12 },
      },
    );

    expect(analysis.isOptimal).toBe(false);
    expect(analysis.issues).toEqual(expect.arrayContaining([
      'Server-side filtering was attempted but failed, falling back to client-side',
      'Large page size may impact performance',
      'Task count exceeds recommended memory limits',
    ]));
    expect(analysis.recommendations).toEqual(expect.arrayContaining([
      'Consider simplifying the filter syntax for better server-side compatibility',
      'Consider using smaller page sizes (<= 500) for better performance',
      'Apply more specific filters or use pagination to reduce memory usage',
      'Search terms should be at least 3 characters for better results',
    ]));
  });

  it('handles the remaining performance-analysis branches', () => {
    const analysis = TaskFilteringOrchestrator.analyzeFilteringPerformance(
      { filter: 'done = false', search: 'abcd' } as any,
      {
        success: true,
        tasks: [] as any,
        metadata: {
          serverSideFilteringUsed: false,
          serverSideFilteringAttempted: false,
          clientSideFiltering: true,
          filteringNote: 'client',
        },
      } as any,
    );

    expect(analysis.isOptimal).toBe(false);
    expect(analysis.issues).toEqual([]);
    expect(analysis.recommendations).toContain('Consider enabling server-side filtering for better performance with large datasets');
  });
});
