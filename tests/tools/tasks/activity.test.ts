import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { handleListActivity } from '../../../src/tools/tasks/activity';
import { registerTaskActivityTool } from '../../../src/tools/task-activity';
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
type ActivityToolServer = { tool: jest.Mock };

function getRegisteredHandler(server: ActivityToolServer): ToolHandler {
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

describe('Activity operations', () => {
  let mockDirectClient: any;
  let mockServer: ActivityToolServer;
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

    (getClientFromContext as unknown as jest.Mock).mockResolvedValue({} as never);
    (createDirectClient as unknown as jest.Mock).mockReturnValue(
      mockDirectClient as unknown as VikunjaDirectClient,
    );
  });

  it('lists task activity successfully', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 12,
        task_id: 5,
        user_id: 44,
        type: 2,
        data: { field: 'done', oldValue: false, newValue: true },
        created: '2026-04-12T10:00:00Z',
      },
    ]);

    const result = await handleListActivity(
      { taskId: 5, page: 1 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/tasks/5/activities');

    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('## ✅ Success');
    expect(markdown).toContain('Found 1 activity entr');
    expect(markdown).toContain('Activity #12');
    expect(markdown).toContain('"field":"done"');
  });

  it('returns a no activity response when the activity list is empty', async () => {
    mockDirectClient.get.mockResolvedValue([]);

    const result = await handleListActivity(
      { taskId: 5, page: 1 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/tasks/5/activities');
    expect(result.content[0]?.text ?? '').toContain('No activity found for this task');
  });

  it('throws a validation error when taskId is missing', async () => {
    await expect(
      handleListActivity({}, mockDirectClient as unknown as VikunjaDirectClient),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'taskId is required',
    });

    expect(mockDirectClient.get).not.toHaveBeenCalled();
  });

  it('gracefully handles 404 endpoint error with friendly message', async () => {
    const apiError = new MCPError(
      ErrorCode.API_ERROR,
      'Request failed with status 404: Not Found',
      {
        statusCode: 404,
        endpoint: '/tasks/5/activities',
      },
    );
    mockDirectClient.get.mockRejectedValue(apiError);

    const result = await handleListActivity(
      { taskId: 5, page: 1 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/tasks/5/activities');
    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('Activity history is not available on this Vikunja instance');
    expect(markdown).toContain('endpoint not found');
    expect(markdown).toContain('/tasks/{id}/activities');
  });

  it('propagates non-404 MCP errors unchanged', async () => {
    const apiError = new MCPError(
      ErrorCode.API_ERROR,
      'Request failed with status 500: Internal Server Error',
      {
        statusCode: 500,
        endpoint: '/tasks/5/activities',
      },
    );
    mockDirectClient.get.mockRejectedValue(apiError);

    registerTaskActivityTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', taskId: 5 })).rejects.toBe(apiError);
  });

  it('throws an auth error when the user is not authenticated', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);

    registerTaskActivityTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', taskId: 5 })).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });

    expect(getClientFromContext).not.toHaveBeenCalled();
    expect(createDirectClient).not.toHaveBeenCalled();
  });

  it('handles null and undefined activity data without crashing', async () => {
    mockDirectClient.get.mockResolvedValue([
      {
        id: 22,
        task_id: 5,
        type: 1,
        data: null,
      },
      {
        id: 23,
        task_id: 5,
        type: 3,
      },
    ]);

    const result = await handleListActivity(
      { taskId: 5, page: 2 },
      mockDirectClient as unknown as VikunjaDirectClient,
    );

    expect(mockDirectClient.get).toHaveBeenCalledWith('/tasks/5/activities?page=2');
    const markdown = result.content[0]?.text ?? '';
    expect(markdown).toContain('Activity #22');
    expect(markdown).toContain('Data: No activity data');
    expect(markdown).toContain('Activity #23');
  });

  it('registers the tool and routes list successfully', async () => {
    const mockClientFactory = { name: 'factory' };
    mockDirectClient.get.mockResolvedValue([
      {
        id: 99,
        task_id: 7,
        user_id: 8,
        type: 4,
        data: { comment: 'Moved to done' },
      },
    ]);

    registerTaskActivityTool(
      mockServer as unknown as McpServer,
      mockAuthManager as never,
      mockClientFactory as never,
    );

    const registrationCall = mockServer.tool.mock.calls[0];
    expect(registrationCall?.[0]).toBe('vikunja_task_activity');
    expect(registrationCall?.[1]).toBe(
      'Get activity history for a task (field changes, status transitions, comments)',
    );
    expect(registrationCall?.[2]).toEqual(expect.any(Object));
    expect(registrationCall?.[3]).toEqual(expect.any(Function));

    const handler = getRegisteredHandler(mockServer);
    const result = await handler({ operation: 'list', taskId: 7, page: 1 });

    expect((setGlobalClientFactory as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(
      mockClientFactory,
    );
    expect(getClientFromContext).toHaveBeenCalled();
    expect((createDirectClient as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockAuthManager);
    expect(mockDirectClient.get).toHaveBeenCalledWith('/tasks/7/activities');
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Activity #99') }],
    });
  });
});
