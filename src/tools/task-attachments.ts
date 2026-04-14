import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { getClientFromContext, setGlobalClientFactory } from '../client';
import { createDirectClient } from '../client/direct-client';
import { MCPError, ErrorCode } from '../types';
import { createAuthRequiredError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import {
  handleUploadAttachment,
  handleListAttachments,
  handleDownloadAttachment,
  handleDeleteAttachment,
} from './tasks/attachments';

export function registerTaskAttachmentsTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_task_attachments',
    'Manage file attachments on tasks (upload from local path, list, download to local path, delete)',
    {
      operation: z.enum(['upload', 'list', 'download', 'delete']),
      taskId: z.number(),
      filePath: z.string().optional(),
      attachmentId: z.number().optional(),
      outputPath: z.string().optional(),
    },
    async (args) => {
      try {
        logger.debug('Executing task attachments tool', {
          operation: args.operation,
          taskId: args.taskId,
        });

        if (!authManager.isAuthenticated()) {
          throw createAuthRequiredError('access task attachment operations');
        }

        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        await getClientFromContext();

        const directClient = createDirectClient(authManager);

        switch (args.operation) {
          case 'upload':
            return await handleUploadAttachment(
              {
                taskId: args.taskId,
                filePath: args.filePath,
              } as never,
              directClient,
            );

          case 'list':
            return await handleListAttachments(
              {
                taskId: args.taskId,
              } as never,
              directClient,
            );

          case 'download':
            return await handleDownloadAttachment(
              {
                taskId: args.taskId,
                attachmentId: args.attachmentId,
                outputPath: args.outputPath,
              } as never,
              directClient,
            );

          case 'delete':
            return await handleDeleteAttachment(
              {
                taskId: args.taskId,
                attachmentId: args.attachmentId,
              } as never,
              directClient,
            );

          default:
            throw new MCPError(
              ErrorCode.VALIDATION_ERROR,
              `Unknown operation: ${String(args.operation)}`,
            );
        }
      } catch (error) {
        if (error instanceof MCPError) {
          throw error;
        }

        throw new MCPError(
          ErrorCode.INTERNAL_ERROR,
          `Task attachments operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
