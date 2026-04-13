import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { getClientFromContext, setGlobalClientFactory } from '../client';
import { createDirectClient } from '../client/direct-client';
import { MCPError, ErrorCode } from '../types';
import { createAuthRequiredError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { handleListActivity } from './tasks/activity';

export function registerTaskActivityTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_task_activity',
    'Get activity history for a task (field changes, status transitions, comments)',
    {
      operation: z.literal('list'),
      taskId: z.number(),
      page: z.number().optional().default(1),
    },
    async (args) => {
      try {
        logger.debug('Executing task activity tool', { operation: args.operation, taskId: args.taskId });

        if (!authManager.isAuthenticated()) {
          throw createAuthRequiredError('access task activity operations');
        }

        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        await getClientFromContext();

        const directClient = createDirectClient(authManager);

        switch (args.operation) {
          case 'list':
            return await handleListActivity(
              {
                taskId: args.taskId,
                page: args.page,
              },
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
          `Task activity operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
