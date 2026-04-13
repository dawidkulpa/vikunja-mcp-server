import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { handleMove } from '../../../src/tools/tasks/move';
import { registerTaskMoveTool } from '../../../src/tools/task-move';
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
type MoveToolServer = { tool: jest.Mock };

function getRegisteredHandler(server: MoveToolServer): ToolHandler {
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

describe('Move operations', () => {
  let mockDirectClient: any;
  let mockServer: MoveToolServer;
  let mockAuthManager: ReturnType<typeof createMockTestableAuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDirectClient = {
      post: jest.fn(),
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

  it('moves a task successfully', async () => {
    mockDirectClient.post.mockResolvedValue({
      task_id: 55,
      position: 3.5,
    });

    const result = await handleMove(
      {
        projectId: 5,
        viewId: 11,
        bucketId: 21,
        taskId: 55,
        position: 3.5,
      },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.post).toHaveBeenCalledWith(
      '/projects/5/views/11/buckets/21/tasks',
      { task_id: 55, position: 3.5 },
    );

    const markdown = (result as { content: Array<{ text: string }> }).content[0]?.text ?? '';
    expect(markdown).toContain('## ✅ Success');
    expect(markdown).toContain('Moved task 55 to bucket 21');
  });

  it('throws a validation error when move is called without bucketId', async () => {
    await expect(
      handleMove(
        { projectId: 5, viewId: 11, taskId: 55 },
        mockDirectClient as unknown as VikunjaDirectClient,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'bucketId is required',
    });

    expect(mockDirectClient.post).not.toHaveBeenCalled();
  });

  it('throws a validation error when move is called without taskId', async () => {
    await expect(
      handleMove(
        { projectId: 5, viewId: 11, bucketId: 21 },
        mockDirectClient as unknown as VikunjaDirectClient,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'taskId is required',
    });

    expect(mockDirectClient.post).not.toHaveBeenCalled();
  });

  it('throws a validation error when move is called without viewId', async () => {
    await expect(
      handleMove(
        { projectId: 5, bucketId: 21, taskId: 55 },
        mockDirectClient as unknown as VikunjaDirectClient,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'viewId is required',
    });

    expect(mockDirectClient.post).not.toHaveBeenCalled();
  });

  it('propagates direct client MCP errors unchanged', async () => {
    const apiError = new MCPError(
      ErrorCode.API_ERROR,
      'Request failed with status 404: Not Found',
      {
        statusCode: 404,
        endpoint: '/projects/5/views/11/buckets/21/tasks',
      },
    );
    mockDirectClient.post.mockRejectedValue(apiError);

    await expect(
      handleMove(
        {
          projectId: 5,
          viewId: 11,
          bucketId: 21,
          taskId: 55,
        },
        mockDirectClient as unknown as VikunjaDirectClient,
      ),
    ).rejects.toBe(apiError);
  });

  it('registers the tool and routes move successfully', async () => {
    const mockClientFactory = { name: 'factory' } as any;
    mockDirectClient.post.mockResolvedValue({
      task_id: 55,
      position: 2,
    });

    registerTaskMoveTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory as any);

    const registrationCall = mockServer.tool.mock.calls[0];
    expect(registrationCall?.[0]).toBe('vikunja_task_move');
    expect(registrationCall?.[1]).toBe('Move a task to a different bucket (column) in a kanban view');
    expect(registrationCall?.[2]).toEqual(expect.any(Object));
    expect(registrationCall?.[3]).toEqual(expect.any(Function));

    const handler = getRegisteredHandler(mockServer);
    const result = await handler({
      operation: 'move',
      projectId: 5,
      viewId: 11,
      bucketId: 21,
      taskId: 55,
      position: 2,
    });

    expect((setGlobalClientFactory as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockClientFactory);
    expect(getClientFromContext).toHaveBeenCalled();
    expect((createDirectClient as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockAuthManager);
    expect(mockDirectClient.post).toHaveBeenCalledWith(
      '/projects/5/views/11/buckets/21/tasks',
      { task_id: 55, position: 2 },
    );
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Moved task 55 to bucket 21') }],
    });
  });

  it('throws an auth error when the user is not authenticated', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);

    registerTaskMoveTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(
      handler({ operation: 'move', projectId: 5, viewId: 11, bucketId: 21, taskId: 55 }),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });

    expect(getClientFromContext).not.toHaveBeenCalled();
    expect(createDirectClient).not.toHaveBeenCalled();
  });
});
