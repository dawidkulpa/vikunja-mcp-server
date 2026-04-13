import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCPError, ErrorCode } from '../../src/types';
import { createMockTestableAuthManager } from '../utils/test-utils';
import type { MockServer } from '../types/mocks';
import { registerTaskCrudTool } from '../../src/tools/task-crud';
import { registerTaskBulkTool } from '../../src/tools/task-bulk';
import { registerTaskAssigneesTool } from '../../src/tools/task-assignees';
import { registerTaskLabelsTool } from '../../src/tools/task-labels';
import { registerTaskRelationsTool } from '../../src/tools/task-relations';
import { registerTaskRemindersTool } from '../../src/tools/task-reminders';
import { registerTaskCommentsTool } from '../../src/tools/task-comments';
import { getClientFromContext, setGlobalClientFactory } from '../../src/client';
import { createAuthRequiredError, handleFetchError } from '../../src/utils/error-handler';
import { createSuccessResponse, formatMcpResponse } from '../../src/utils/simple-response';
import { storageManager } from '../../src/storage/index';
import { TaskFilteringOrchestrator } from '../../src/tools/tasks/filtering/index';
import { createTask, getTask, updateTask, deleteTask } from '../../src/tools/tasks/crud/index';
import { bulkCreateTasks, bulkDeleteTasks, bulkUpdateTasks } from '../../src/tools/tasks/bulk-operations';
import { assignUsers, listAssignees, unassignUsers } from '../../src/tools/tasks/assignees/index';
import { applyLabels, listTaskLabels, removeLabels } from '../../src/tools/tasks/labels';
import { handleRelationSubcommands } from '../../src/tools/tasks-relations';
import { addReminder, listReminders, removeReminder } from '../../src/tools/tasks/reminders';
import {
  handleAddComment,
  handleDeleteComment,
  handleListComments,
  handleUpdateComment,
} from '../../src/tools/tasks/comments/index';

jest.mock('../../src/client', () => ({
  getClientFromContext: jest.fn(),
  setGlobalClientFactory: jest.fn(),
}));

jest.mock('../../src/utils/error-handler', () => ({
  createAuthRequiredError: jest.fn((action: string) => new (require('../../src/types').MCPError)(require('../../src/types').ErrorCode.AUTH_REQUIRED, `Authentication required to ${action}`)),
  handleFetchError: jest.fn((_error: unknown, operation: string) => new (require('../../src/types').MCPError)(require('../../src/types').ErrorCode.INTERNAL_ERROR, `Failed to ${operation}`)),
}));

jest.mock('../../src/utils/simple-response', () => ({
  createSuccessResponse: jest.fn((operation: string, message: string, data: unknown, metadata: unknown) => ({ operation, message, data, metadata })),
  formatMcpResponse: jest.fn((response: unknown) => [{ type: 'text', text: JSON.stringify(response) }]),
}));

jest.mock('../../src/storage/index', () => ({
  storageManager: {
    getStorage: jest.fn(),
  },
}));

jest.mock('../../src/tools/tasks/filtering/index', () => ({
  TaskFilteringOrchestrator: {
    executeTaskFiltering: jest.fn(),
  },
}));

jest.mock('../../src/tools/tasks/crud/index', () => ({
  createTask: jest.fn(),
  getTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock('../../src/tools/tasks/bulk-operations', () => ({
  bulkCreateTasks: jest.fn(),
  bulkUpdateTasks: jest.fn(),
  bulkDeleteTasks: jest.fn(),
}));

jest.mock('../../src/tools/tasks/assignees/index', () => ({
  assignUsers: jest.fn(),
  unassignUsers: jest.fn(),
  listAssignees: jest.fn(),
}));

jest.mock('../../src/tools/tasks/labels', () => ({
  applyLabels: jest.fn(),
  removeLabels: jest.fn(),
  listTaskLabels: jest.fn(),
}));

jest.mock('../../src/tools/tasks-relations', () => ({
  handleRelationSubcommands: jest.fn(),
}));

jest.mock('../../src/tools/tasks/reminders', () => ({
  addReminder: jest.fn(),
  removeReminder: jest.fn(),
  listReminders: jest.fn(),
}));

jest.mock('../../src/tools/tasks/comments/index', () => ({
  handleAddComment: jest.fn(),
  handleDeleteComment: jest.fn(),
  handleListComments: jest.fn(),
  handleUpdateComment: jest.fn(),
}));

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

function getRegisteredHandler(server: MockServer): ToolHandler {
  const lastCall = server.tool.mock.calls[0];
  if (!lastCall || lastCall.length < 4) {
    throw new Error('Tool handler not registered');
  }
  return lastCall[3] as ToolHandler;
}

describe('individual task wrapper tools', () => {
  const mockClientFactory = { name: 'factory' } as any;
  const mockStorage = { name: 'storage' } as any;

  let mockServer: MockServer;
  let mockAuthManager: ReturnType<typeof createMockTestableAuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      tool: jest.fn(),
    } as unknown as MockServer;

    mockAuthManager = createMockTestableAuthManager();
    mockAuthManager.isAuthenticated.mockReturnValue(true);
    mockAuthManager.getSession = jest.fn().mockReturnValue({
      apiUrl: 'https://vikunja.example',
      apiToken: 'test-token-123456',
      authType: 'api_token',
      userId: 'user-1',
    });

    (getClientFromContext as jest.Mock).mockResolvedValue({});
    (storageManager.getStorage as jest.Mock).mockResolvedValue(mockStorage);
    (TaskFilteringOrchestrator.executeTaskFiltering as jest.Mock).mockResolvedValue({
      tasks: [{ id: 1, title: 'A' }],
      metadata: { serverSideFilteringUsed: true },
    });
    (createTask as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'created' }] });
    (getTask as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'got' }] });
    (updateTask as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'updated' }] });
    (deleteTask as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'deleted' }] });
    (bulkCreateTasks as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'bulk-created' }] });
    (bulkUpdateTasks as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'bulk-updated' }] });
    (bulkDeleteTasks as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'bulk-deleted' }] });
    (assignUsers as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'assigned' }] });
    (unassignUsers as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'unassigned' }] });
    (listAssignees as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'listed assignees' }] });
    (applyLabels as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'applied labels' }] });
    (removeLabels as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'removed labels' }] });
    (listTaskLabels as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'listed labels' }] });
    (handleRelationSubcommands as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'related' }] });
    (addReminder as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'added reminder' }] });
    (removeReminder as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'removed reminder' }] });
    (listReminders as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'listed reminders' }] });
    (handleAddComment as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'commented' }] });
    (handleListComments as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'listed comments' }] });
    (handleUpdateComment as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'updated comment' }] });
    (handleDeleteComment as jest.Mock).mockResolvedValue({ content: [{ type: 'text', text: 'deleted comment' }] });
  });

  it('registers the CRUD wrapper and routes list operations through the orchestrator', async () => {
    registerTaskCrudTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    expect(mockServer.tool).toHaveBeenCalledWith(
      'vikunja_task_crud',
      'Manage individual tasks: create, get, update, delete, list',
      expect.any(Object),
      expect.any(Function),
    );

    const handler = getRegisteredHandler(mockServer);
    const result = await handler({ operation: 'list', filter: 'done = false' });

    expect(setGlobalClientFactory).toHaveBeenCalledWith(mockClientFactory);
    expect(getClientFromContext).toHaveBeenCalled();
    expect(storageManager.getStorage).toHaveBeenCalledWith('https://vikunja.example:test-tok', 'user-1', 'https://vikunja.example');
    expect(TaskFilteringOrchestrator.executeTaskFiltering).toHaveBeenCalledWith({ operation: 'list', filter: 'done = false' }, mockStorage);
    expect(createSuccessResponse).toHaveBeenCalled();
    expect(formatMcpResponse).toHaveBeenCalled();
    expect(result).toMatchObject({ content: [{ type: 'text', text: expect.any(String) }] });
  });

  it('routes CRUD create/get/update/delete operations and validates required fields', async () => {
    registerTaskCrudTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'create', title: 'Missing project' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(handler({ operation: 'get' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(handler({ operation: 'update', title: 'No id' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(handler({ operation: 'delete' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await handler({ operation: 'create', projectId: 5, title: 'Task' });
    await handler({ operation: 'get', id: 10 });
    await handler({ operation: 'update', id: 11, title: 'Updated' });
    await handler({ operation: 'delete', id: 12 });

    expect(createTask).toHaveBeenCalledWith({ operation: 'create', projectId: 5, title: 'Task' });
    expect(getTask).toHaveBeenCalledWith({ operation: 'get', id: 10 });
    expect(updateTask).toHaveBeenCalledWith({ operation: 'update', id: 11, title: 'Updated' });
    expect(deleteTask).toHaveBeenCalledWith({ operation: 'delete', id: 12 });
  });

  it('wraps unexpected CRUD errors but preserves MCP errors', async () => {
    registerTaskCrudTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    (createTask as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(handler({ operation: 'create', projectId: 1, title: 'Task' })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task CRUD operation error: boom',
    });

    const passthrough = new MCPError(ErrorCode.API_ERROR, 'api failed');
    (getTask as jest.Mock).mockRejectedValueOnce(passthrough);
    await expect(handler({ operation: 'get', id: 1 })).rejects.toBe(passthrough);

    (TaskFilteringOrchestrator.executeTaskFiltering as jest.Mock).mockRejectedValueOnce(new Error('list failed'));
    await expect(handler({ operation: 'list' })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to list tasks',
    });
    expect(handleFetchError).toHaveBeenCalledWith(expect.any(Error), 'list tasks');
  });

  it('rejects CRUD access when unauthenticated and rejects unknown operations', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);
    registerTaskCrudTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list' })).rejects.toMatchObject({ code: ErrorCode.AUTH_REQUIRED });
    expect(createAuthRequiredError).toHaveBeenCalledWith('access task CRUD operations');

    mockAuthManager.isAuthenticated.mockReturnValue(true);
    await expect(handler({ operation: 'unknown' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('routes bulk operations and normalizes payloads', async () => {
    registerTaskBulkTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    expect(mockServer.tool).toHaveBeenCalledWith(
      'vikunja_task_bulk',
      'Manage bulk task operations: create, update, delete multiple tasks',
      expect.any(Object),
      expect.any(Function),
    );

    const handler = getRegisteredHandler(mockServer);

    await handler({
      operation: 'bulk-create',
      projectId: 2,
      tasks: [{ title: 'A', description: 'B', dueDate: '2026-01-01', priority: 3, labels: [1], assignees: [2], repeatAfter: 4, repeatMode: 'week' }],
    });
    expect(bulkCreateTasks).toHaveBeenCalledWith({
      projectId: 2,
      tasks: [{ title: 'A', description: 'B', due_date: '2026-01-01', priority: 3, labels: [1], assignees: [2], repeat_after: 4, repeat_mode: 'week' }],
    });

    await handler({ operation: 'bulk-update', taskIds: [1, 2], field: 'priority', value: 5 });
    expect(bulkUpdateTasks).toHaveBeenCalledWith({ taskIds: [1, 2], field: 'priority', value: 5 });

    await handler({ operation: 'bulk-delete' });
    expect(bulkDeleteTasks).toHaveBeenCalledWith({ taskIds: [] });
  });

  it('validates bulk operations and wraps unexpected errors', async () => {
    registerTaskBulkTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'bulk-create', tasks: [] })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(handler({ operation: 'bulk-update', taskIds: [1] })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    await expect(handler({ operation: 'mystery' })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    (bulkUpdateTasks as jest.Mock).mockRejectedValueOnce(new Error('bulk boom'));
    await expect(handler({ operation: 'bulk-update', taskIds: [1], field: 'priority', value: 1 })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task bulk operation error: bulk boom',
    });
  });

  it('routes assignee operations and handles auth plus wrapper errors', async () => {
    registerTaskAssigneesTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'assign', id: 1 });
    await handler({ operation: 'unassign', id: 1, assignees: [7] });
    await handler({ operation: 'list-assignees', id: 1, assignees: [8] });

    expect(assignUsers).toHaveBeenCalledWith({ id: 1, assignees: [] });
    expect(unassignUsers).toHaveBeenCalledWith({ id: 1, assignees: [7] });
    expect(listAssignees).toHaveBeenCalledWith({ operation: 'list-assignees', id: 1, assignees: [8] });

    (assignUsers as jest.Mock).mockRejectedValueOnce(new Error('assign boom'));
    await expect(handler({ operation: 'assign', id: 1, assignees: [1] })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task assignee operation error: assign boom',
    });

    mockAuthManager.isAuthenticated.mockReturnValue(false);
    await expect(handler({ operation: 'assign', id: 1 })).rejects.toMatchObject({ code: ErrorCode.AUTH_REQUIRED });
  });

  it('routes label operations and wraps non-MCP errors', async () => {
    registerTaskLabelsTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'apply-label', id: 2 });
    await handler({ operation: 'remove-label', id: 2, labels: [4] });
    await handler({ operation: 'list-labels', id: 2 });

    expect(applyLabels).toHaveBeenCalledWith({ id: 2, labels: [] });
    expect(removeLabels).toHaveBeenCalledWith({ id: 2, labels: [4] });
    expect(listTaskLabels).toHaveBeenCalledWith({ operation: 'list-labels', id: 2 });

    (removeLabels as jest.Mock).mockRejectedValueOnce(new Error('label boom'));
    await expect(handler({ operation: 'remove-label', id: 2, labels: [4] })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task label operation error: label boom',
    });
  });

  it('routes relation operations through the shared handler', async () => {
    registerTaskRelationsTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'relate', id: 3, otherTaskId: 9, relationKind: 'related' });
    expect(handleRelationSubcommands).toHaveBeenCalledWith({
      subcommand: 'relate',
      id: 3,
      otherTaskId: 9,
      relationKind: 'related',
    });

    (handleRelationSubcommands as jest.Mock).mockRejectedValueOnce(new Error('relation boom'));
    await expect(handler({ operation: 'relations', id: 3 })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task relation operation error: relation boom',
    });
  });

  it('routes reminder operations with default fallback values', async () => {
    registerTaskRemindersTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'add-reminder', id: 4 });
    await handler({ operation: 'remove-reminder', id: 4 });
    await handler({ operation: 'list-reminders', id: 4 });

    expect(addReminder).toHaveBeenCalledWith({ id: 4, reminderDate: '' });
    expect(removeReminder).toHaveBeenCalledWith({ id: 4, reminderId: 0 });
    expect(listReminders).toHaveBeenCalledWith({ operation: 'list-reminders', id: 4 });

    (addReminder as jest.Mock).mockRejectedValueOnce(new Error('reminder boom'));
    await expect(handler({ operation: 'add-reminder', id: 4, reminderDate: '2026-01-01' })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task reminder operation error: reminder boom',
    });
  });

  it('routes comment operations and preserves MCP errors', async () => {
    registerTaskCommentsTool(mockServer as unknown as McpServer, mockAuthManager as any, mockClientFactory);
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'list', id: 5 });
    await handler({ operation: 'add', id: 5, comment: 'hello' });
    await handler({ operation: 'update', id: 5, commentId: 8, comment: 'updated' });
    await handler({ operation: 'delete', id: 5, commentId: 8 });

    expect(handleListComments).toHaveBeenCalledWith({ id: 5 });
    expect(handleAddComment).toHaveBeenCalledWith({ id: 5, comment: 'hello' });
    expect(handleUpdateComment).toHaveBeenCalledWith({ id: 5, commentId: 8, comment: 'updated' });
    expect(handleDeleteComment).toHaveBeenCalledWith({ id: 5, commentId: 8 });

    const passthrough = new MCPError(ErrorCode.API_ERROR, 'comment failed');
    (handleAddComment as jest.Mock).mockRejectedValueOnce(passthrough);
    await expect(handler({ operation: 'add', id: 5, comment: 'hello' })).rejects.toBe(passthrough);
  });
});
