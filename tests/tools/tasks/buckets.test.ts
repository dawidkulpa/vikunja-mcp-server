import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  handleListBucketTasks,
  handleListBuckets,
  handleListViews,
} from '../../../src/tools/tasks/buckets';
import { registerTaskBucketsTool } from '../../../src/tools/task-buckets';
import type { VikunjaDirectClient } from '../../../src/client/direct-client';
import { createDirectClient } from '../../../src/client/direct-client';
import { getClientFromContext, setGlobalClientFactory } from '../../../src/client';
import { MCPError, ErrorCode } from '../../../src/types';
import { createMockTestableAuthManager } from '../../utils/test-utils';

jest.mock('../../../src/client', () => ({
  getClientFromContext: jest.fn(),
  setGlobalClientFactory: jest.fn(),
}));

jest.mock('../../../src/client/direct-client', () => ({
  createDirectClient: jest.fn(),
}));

jest.mock('../../../src/utils/logger');

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
type BucketToolServer = { tool: jest.Mock };

function getRegisteredHandler(server: BucketToolServer): ToolHandler {
  const lastCall = server.tool.mock.calls[0];
  if (!lastCall || lastCall.length < 4) {
    throw new Error('Tool handler not registered');
  }
  const handler = lastCall[3];
  if (typeof handler !== 'function') {
    throw new Error('Tool handler not registered');
  }
  return handler as ToolHandler;
}

describe('Bucket operations', () => {
  let mockDirectClient: any;
  let mockServer: BucketToolServer;
  let mockAuthManager: ReturnType<typeof createMockTestableAuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDirectClient = {
      get: jest.fn(),
    };

    mockServer = {
      tool: jest.fn(),
    };

    mockAuthManager = createMockTestableAuthManager();
    mockAuthManager.isAuthenticated.mockReturnValue(true);

    (getClientFromContext as any).mockResolvedValue({} as any);
    (createDirectClient as any).mockReturnValue(
      mockDirectClient as unknown as VikunjaDirectClient,
    );
  });

  it('lists project views successfully', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 11,
        project_id: 5,
        title: 'Kanban Board',
        view_kind: 'board',
      },
    ]);

    const result = await handleListViews({ projectId: 5 }, mockDirectClient as unknown as VikunjaDirectClient);

    expect(mockDirectClient.get).toHaveBeenCalledWith('/projects/5/views');

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('## ✅ Success');
    expect(markdown).toContain('Found 1 view(s)');
    expect(markdown).toContain('Kanban Board');
  });

  it('lists buckets in a view successfully', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 21,
        project_id: 5,
        view_id: 11,
        title: 'In Progress',
        position: 2,
      },
    ]);

    const result = await handleListBuckets(
      { projectId: 5, viewId: 11 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/projects/5/views/11/buckets');

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('## ✅ Success');
    expect(markdown).toContain('Found 1 bucket(s)');
    expect(markdown).toContain('In Progress');
  });

  it('throws a validation error when list-buckets is called without viewId', async () => {
    await expect(
      handleListBuckets({ projectId: 5 }, mockDirectClient as unknown as VikunjaDirectClient),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'viewId is required for list-buckets operation',
    });

    expect(mockDirectClient.get).not.toHaveBeenCalled();
  });

  it('lists bucket tasks for all buckets with task summaries', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 4,
        project_id: 5,
        view_id: 11,
        title: 'TODO',
        position: 100,
        count: 1,
        tasks: [
          {
            id: 6,
            project_id: 5,
            title: 'Write tests',
            description: 'This description should not appear in the all-buckets summary response.',
            bucket_id: 4,
            position: 1,
            created: '2026-04-13T09:00:00Z',
          },
        ],
      },
      {
        id: 7,
        project_id: 5,
        view_id: 11,
        title: 'Open',
        position: 50,
        count: 0,
        tasks: null,
      },
    ]);

    const result = await handleListBucketTasks(
      { projectId: 5, viewId: 11 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/projects/5/views/11/tasks');

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('## ✅ Success');
    expect(markdown).toContain('Found 2 bucket(s) with task summaries');
    expect(markdown).toContain('### Bucket: TODO (ID: 4)');
    expect(markdown).toContain('### Bucket: Open (ID: 7)');
    expect(markdown).toContain('1. Task #6 — Write tests (position: 1)');
    expect(markdown).toContain('- No tasks in this bucket');
    expect(markdown).not.toContain('This description should not appear');
  });

  it('filters bucket tasks by bucketId and returns detailed task information', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 4,
        project_id: 5,
        view_id: 11,
        title: 'TODO',
        position: 100,
        count: 1,
        tasks: [
          {
            id: 6,
            project_id: 5,
            title: 'Write tests',
            description:
              '0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 EXTRA',
            bucket_id: 4,
            position: 1,
            created: '2026-04-13T09:00:00Z',
          },
        ],
      },
      {
        id: 7,
        project_id: 5,
        view_id: 11,
        title: 'Done',
        position: 200,
        count: 1,
        tasks: [
          {
            id: 9,
            project_id: 5,
            title: 'Other task',
            bucket_id: 7,
            position: 2,
          },
        ],
      },
    ]);

    const result = await handleListBucketTasks(
      { projectId: 5, viewId: 11, bucketId: 4 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('Found 1 task(s) in bucket TODO');
    expect(markdown).toContain('### Bucket: TODO (ID: 4)');
    expect(markdown).toContain('- Created: 2026-04-13T09:00:00Z');
    expect(markdown).toContain(
      '- Description: 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0123456789 0...',
    );
    expect(markdown).not.toContain('Other task');
  });

  it('formats empty buckets when the API returns tasks as null and count 0', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 7,
        project_id: 5,
        view_id: 11,
        title: 'Open',
        position: 50,
        count: 0,
        tasks: null,
      },
    ]);

    const result = await handleListBucketTasks(
      { projectId: 5, viewId: 11 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('### Bucket: Open (ID: 7)');
    expect(markdown).toContain('- Task count: 0');
    expect(markdown).toContain('- No tasks in this bucket');
  });

  it('throws a validation error when list-bucket-tasks is called without viewId', async () => {
    await expect(
      handleListBucketTasks({ projectId: 5 }, mockDirectClient as unknown as VikunjaDirectClient),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'viewId is required for list-bucket-tasks operation',
    });

    expect(mockDirectClient.get).not.toHaveBeenCalled();
  });

  it('throws a validation error when list-bucket-tasks is called without projectId', async () => {
    await expect(
      handleListBucketTasks(
        { viewId: 11 } as unknown as { projectId?: number; viewId?: number; bucketId?: number },
        mockDirectClient as unknown as VikunjaDirectClient,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'projectId is required',
    });

    expect(mockDirectClient.get).not.toHaveBeenCalled();
  });

  it('registers the tool and routes list-views successfully', async () => {
    const mockClientFactory = { name: 'factory' } as any;
    mockDirectClient.get.mockResolvedValue([
      {
        id: 99,
        project_id: 7,
        title: 'All Views',
        view_kind: 'list',
      },
    ]);

    registerTaskBucketsTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory as any);

    const registrationCall = mockServer.tool.mock.calls[0];
    expect(registrationCall?.[0]).toBe('vikunja_buckets');
    expect(registrationCall?.[1]).toBe('List project views and buckets for kanban board management');
    expect(registrationCall?.[2]).toEqual(expect.any(Object));
    expect(registrationCall?.[3]).toEqual(expect.any(Function));

    const handler = getRegisteredHandler(mockServer);
    const result = await handler({ operation: 'list-views', projectId: 7 });

    expect((setGlobalClientFactory as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockClientFactory);
    expect(getClientFromContext).toHaveBeenCalled();
    expect((createDirectClient as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockAuthManager);
    expect(mockDirectClient.get).toHaveBeenCalledWith('/projects/7/views');
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('All Views') }],
    });
  });

  it('propagates direct client MCP errors unchanged', async () => {
    const apiError = new MCPError(
      ErrorCode.API_ERROR,
      'Request failed with status 404: Not Found',
      {
        statusCode: 404,
        endpoint: '/projects/5/views/42/buckets',
      },
    );
    mockDirectClient.get.mockRejectedValue(apiError);

    registerTaskBucketsTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list-buckets', projectId: 5, viewId: 42 })).rejects.toBe(apiError);
  });

  it('registers the tool and routes list-bucket-tasks successfully', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 4,
        project_id: 7,
        view_id: 11,
        title: 'TODO',
        position: 100,
        count: 1,
        tasks: [
          {
            id: 6,
            project_id: 7,
            title: 'Route task',
            bucket_id: 4,
            position: 1,
          },
        ],
      },
    ]);

    registerTaskBucketsTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    const result = await handler({
      operation: 'list-bucket-tasks',
      projectId: 7,
      viewId: 11,
      bucketId: 4,
    });

    expect(mockDirectClient.get).toHaveBeenCalledWith('/projects/7/views/11/tasks');
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Route task') }],
    });
  });

  it('throws an auth error when the user is not authenticated', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);

    registerTaskBucketsTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list-views', projectId: 5 })).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });

    expect(getClientFromContext).not.toHaveBeenCalled();
    expect(createDirectClient).not.toHaveBeenCalled();
  });
});
