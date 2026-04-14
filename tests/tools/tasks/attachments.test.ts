import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  handleUploadAttachment,
  handleListAttachments,
  handleDownloadAttachment,
  handleDeleteAttachment,
} from '../../../src/tools/tasks/attachments';
import { registerTaskAttachmentsTool } from '../../../src/tools/task-attachments';
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

jest.mock('../../../src/tools/tasks/attachments', () => ({
  handleUploadAttachment: jest.fn(),
  handleListAttachments: jest.fn(),
  handleDownloadAttachment: jest.fn(),
  handleDeleteAttachment: jest.fn(),
}));

jest.mock('../../../src/utils/logger');

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
type AttachmentToolServer = { tool: jest.Mock };

function getRegisteredHandler(server: AttachmentToolServer): ToolHandler {
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

describe('Task attachments operations', () => {
  let mockDirectClient: any;
  let mockServer: AttachmentToolServer;
  let mockAuthManager: ReturnType<typeof createMockTestableAuthManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDirectClient = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
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

  describe('upload operation', () => {
    it('should route upload operation to handleUploadAttachment', async () => {
      const mockResponse = {
        content: [{ type: 'text' as const, text: 'Upload successful' }],
      };
      (handleUploadAttachment as jest.Mock).mockResolvedValue(mockResponse);

      registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
      const handler = getRegisteredHandler(mockServer);

      const result = await handler({ operation: 'upload', taskId: 123, filePath: '/path/to/file' });

      expect(handleUploadAttachment).toHaveBeenCalledWith(
        { taskId: 123, filePath: '/path/to/file' },
        mockDirectClient,
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('list operation', () => {
    it('should route list operation to handleListAttachments', async () => {
      const mockResponse = {
        content: [{ type: 'text' as const, text: 'Attachments listed' }],
      };
      (handleListAttachments as jest.Mock).mockResolvedValue(mockResponse);

      registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
      const handler = getRegisteredHandler(mockServer);

      const result = await handler({ operation: 'list', taskId: 123 });

      expect(handleListAttachments).toHaveBeenCalledWith({ taskId: 123 }, mockDirectClient);
      expect(result).toBe(mockResponse);
    });
  });

  describe('download operation', () => {
    it('should route download operation to handleDownloadAttachment', async () => {
      const mockResponse = {
        content: [{ type: 'text' as const, text: 'Download successful' }],
      };
      (handleDownloadAttachment as jest.Mock).mockResolvedValue(mockResponse);

      registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
      const handler = getRegisteredHandler(mockServer);

      const result = await handler({
        operation: 'download',
        taskId: 123,
        attachmentId: 456,
        outputPath: '/path/to/output',
      });

      expect(handleDownloadAttachment).toHaveBeenCalledWith(
        { taskId: 123, attachmentId: 456, outputPath: '/path/to/output' },
        mockDirectClient,
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('delete operation', () => {
    it('should route delete operation to handleDeleteAttachment', async () => {
      const mockResponse = {
        content: [{ type: 'text' as const, text: 'Delete successful' }],
      };
      (handleDeleteAttachment as jest.Mock).mockResolvedValue(mockResponse);

      registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
      const handler = getRegisteredHandler(mockServer);

      const result = await handler({ operation: 'delete', taskId: 123, attachmentId: 456 });

      expect(handleDeleteAttachment).toHaveBeenCalledWith(
        { taskId: 123, attachmentId: 456 },
        mockDirectClient,
      );
      expect(result).toBe(mockResponse);
    });
  });

  it('throws an auth error when the user is not authenticated', async () => {
    mockAuthManager.isAuthenticated.mockReturnValue(false);

    registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', taskId: 123 })).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
    });

    expect(getClientFromContext).not.toHaveBeenCalled();
    expect(createDirectClient).not.toHaveBeenCalled();
  });

  it('throws a validation error for unknown operation', async () => {
    registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'unknown', taskId: 123 })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      message: expect.stringContaining('Unknown operation'),
    });
  });

  it('registers the tool with correct name and description', async () => {
    registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);

    const registrationCall = mockServer.tool.mock.calls[0];
    expect(registrationCall?.[0]).toBe('vikunja_task_attachments');
    expect(registrationCall?.[1]).toContain('Manage file attachments');
    expect(registrationCall?.[2]).toEqual(expect.any(Object));
    expect(registrationCall?.[3]).toEqual(expect.any(Function));
  });

  it('sets up client factory when provided', async () => {
    const mockClientFactory = { name: 'factory' };
    (handleListAttachments as jest.Mock).mockResolvedValue({
      content: [{ type: 'text' as const, text: 'Success' }],
    });

    registerTaskAttachmentsTool(
      mockServer as unknown as McpServer,
      mockAuthManager as never,
      mockClientFactory as never,
    );
    const handler = getRegisteredHandler(mockServer);

    await handler({ operation: 'list', taskId: 123 });

    expect((setGlobalClientFactory as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(
      mockClientFactory,
    );
    expect(getClientFromContext).toHaveBeenCalled();
    expect((createDirectClient as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(mockAuthManager);
  });

  it('propagates MCP errors unchanged', async () => {
    const apiError = new MCPError(
      ErrorCode.API_ERROR,
      'Request failed with status 500: Internal Server Error',
    );
    (handleListAttachments as jest.Mock).mockRejectedValue(apiError);

    registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', taskId: 123 })).rejects.toBe(apiError);
  });

  it('wraps non-MCP errors in INTERNAL_ERROR', async () => {
    const originalError = new Error('Unexpected error');
    (handleListAttachments as jest.Mock).mockRejectedValue(originalError);

    registerTaskAttachmentsTool(mockServer as unknown as McpServer, mockAuthManager as never);
    const handler = getRegisteredHandler(mockServer);

    await expect(handler({ operation: 'list', taskId: 123 })).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: expect.stringContaining('Task attachments operation error'),
    });
  });
});
