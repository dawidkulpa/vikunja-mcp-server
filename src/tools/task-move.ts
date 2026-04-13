/**
 * Task Move Tool
 * Handles moving a task to a different bucket in a kanban view
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { getClientFromContext, setGlobalClientFactory } from '../client';
import { createDirectClient } from '../client/direct-client';
import { MCPError, ErrorCode } from '../types';
import { createAuthRequiredError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { handleMove } from './tasks/move';
import type { MoveInput } from './tasks/move/MoveValidationService';

export function registerTaskMoveTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_task_move',
    'Move a task to a different bucket (column) in a kanban view',
    {
      operation: z.literal('move'),
      projectId: z.number(),
      viewId: z.number(),
      bucketId: z.number(),
      taskId: z.number(),
      position: z.number().optional(),
    },
    async (args) => {
      try {
        logger.debug('Executing task move tool', { operation: args.operation, taskId: args.taskId });

        if (!authManager.isAuthenticated()) {
          throw createAuthRequiredError('access task move operations');
        }

        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        await getClientFromContext();

        const directClient = createDirectClient(authManager);

        switch (args.operation) {
          case 'move': {
            const moveArgs: MoveInput = {
              projectId: args.projectId,
              viewId: args.viewId,
              bucketId: args.bucketId,
              taskId: args.taskId,
              ...(args.position !== undefined ? { position: args.position } : {}),
            };

            return await handleMove(moveArgs, directClient);
          }

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
          `Task move operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
