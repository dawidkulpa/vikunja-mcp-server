// @ts-nocheck
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  handleAddComment,
  handleComment,
  handleDeleteComment,
  handleListComments,
  handleUpdateComment,
} from '../../../src/tools/tasks/comments';
import { registerTaskCommentsTool } from '../../../src/tools/task-comments';
import { getClientFromContext, setGlobalClientFactory } from '../../../src/client';
import { ErrorCode } from '../../../src/types';
import { createMockTestableAuthManager } from '../../utils/test-utils';

jest.mock('../../../src/client', () => ({
  getClientFromContext: jest.fn(),
  setGlobalClientFactory: jest.fn(),
}));

jest.mock('../../../src/utils/logger');

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
type CommentToolServer = { tool: jest.Mock };

function getRegisteredHandler(server: CommentToolServer): ToolHandler {
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

describe('Comment operations', () => {
  const mockClient = {
    tasks: {
      createTaskComment: jest.fn(),
      getTaskComments: jest.fn(),
      updateTaskComment: jest.fn(),
      deleteTaskComment: jest.fn(),
    },
  };

  let mockServer: CommentToolServer;
  let mockAuthManager: ReturnType<typeof createMockTestableAuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    (getClientFromContext as jest.Mock).mockResolvedValue(mockClient);

    mockServer = {
      tool: jest.fn(),
    };

    mockAuthManager = createMockTestableAuthManager();
    mockAuthManager.isAuthenticated.mockReturnValue(true);
  });

  it('lists comments and calls client.tasks.getTaskComments(taskId)', async () => {
    mockClient.tasks.getTaskComments.mockResolvedValue([
      { id: 1, task_id: 123, comment: 'First comment', created: '2024-01-01' },
    ]);

    const result = await handleListComments({ id: 123 });

    expect(mockClient.tasks.getTaskComments).toHaveBeenCalledWith(123);
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Found 1 comments') }],
    });
  });

  it('adds a comment and calls client.tasks.createTaskComment(taskId, payload)', async () => {
    mockClient.tasks.createTaskComment.mockResolvedValue({
      id: 1,
      task_id: 123,
      comment: 'Test comment',
      created: new Date().toISOString(),
    });

    const result = await handleAddComment({
      id: 123,
      comment: 'Test comment',
    });

    expect(mockClient.tasks.createTaskComment).toHaveBeenCalledWith(123, {
      comment: 'Test comment',
      task_id: 123,
    });
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Comment added successfully') }],
    });
  });

  it('updates a comment and calls client.tasks.updateTaskComment(taskId, commentId, payload)', async () => {
    mockClient.tasks.updateTaskComment.mockResolvedValue({
      id: 9,
      task_id: 123,
      comment: 'Updated comment',
      updated: new Date().toISOString(),
    });

    const result = await handleUpdateComment({
      id: 123,
      commentId: 9,
      comment: 'Updated comment',
    });

    expect(mockClient.tasks.updateTaskComment).toHaveBeenCalledWith(123, 9, {
      comment: 'Updated comment',
    });
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Comment updated successfully') }],
    });
  });

  it('deletes a comment and calls client.tasks.deleteTaskComment(taskId, commentId)', async () => {
    mockClient.tasks.deleteTaskComment.mockResolvedValue(undefined);

    const result = await handleDeleteComment({
      id: 123,
      commentId: 9,
    });

    expect(mockClient.tasks.deleteTaskComment).toHaveBeenCalledWith(123, 9);
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('Comment deleted successfully') }],
    });
  });

  it('preserves legacy handleComment add behavior', async () => {
    mockClient.tasks.createTaskComment.mockResolvedValue({
      id: 1,
      task_id: 123,
      comment: 'Legacy comment',
    });

    await handleComment({ id: 123, comment: 'Legacy comment' });

    expect(mockClient.tasks.createTaskComment).toHaveBeenCalledWith(123, {
      comment: 'Legacy comment',
      task_id: 123,
    });
  });

  it('throws a validation error for add without comment text', async () => {
    await expect(handleAddComment({ id: 123 })).rejects.toThrow(
      'Comment text is required for add operation',
    );
  });

  it('throws a validation error for update without commentId', async () => {
    await expect(
      handleUpdateComment({ id: 123, comment: 'Updated comment' }),
    ).rejects.toThrow('Comment id is required for update operation');
  });

  it('throws a validation error for delete without commentId', async () => {
    await expect(handleDeleteComment({ id: 123 })).rejects.toThrow(
      'Comment id is required for delete operation',
    );
  });

  it('registers the tool and routes list/add/update/delete operations', async () => {
    const mockClientFactory = { name: 'factory' } as any;
    mockClient.tasks.getTaskComments.mockResolvedValue([]);
    mockClient.tasks.createTaskComment.mockResolvedValue({ id: 1, task_id: 5, comment: 'hello' });
    mockClient.tasks.updateTaskComment.mockResolvedValue({ id: 2, task_id: 5, comment: 'updated' });
    mockClient.tasks.deleteTaskComment.mockResolvedValue(undefined);

    registerTaskCommentsTool(
      mockServer as unknown as McpServer,
      mockAuthManager as any,
      mockClientFactory,
    );

    const registrationCall = mockServer.tool.mock.calls[0];
    expect(registrationCall?.[0]).toBe('vikunja_task_comments');
    expect(registrationCall?.[1]).toBe('Manage task comments: list, add, update, and delete');

    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'list', id: 5 });
    await handler({ operation: 'add', id: 5, comment: 'hello' });
    await handler({ operation: 'update', id: 5, commentId: 2, comment: 'updated' });
    await handler({ operation: 'delete', id: 5, commentId: 2 });

    expect((setGlobalClientFactory as jest.Mock).mock.calls[0]?.[0]).toBe(mockClientFactory);
    expect(mockClient.tasks.getTaskComments).toHaveBeenCalledWith(5);
    expect(mockClient.tasks.createTaskComment).toHaveBeenCalledWith(5, {
      task_id: 5,
      comment: 'hello',
    });
    expect(mockClient.tasks.updateTaskComment).toHaveBeenCalledWith(5, 2, {
      comment: 'updated',
    });
    expect(mockClient.tasks.deleteTaskComment).toHaveBeenCalledWith(5, 2);
  });

  it('throws an auth error when not authenticated', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);

    registerTaskCommentsTool(mockServer as unknown as McpServer, mockAuthManager as any);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', id: 123 })).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });

    expect(getClientFromContext).not.toHaveBeenCalled();
  });
});
