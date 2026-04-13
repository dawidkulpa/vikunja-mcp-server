/**
 * Task Buckets Tool
 * Handles project view and bucket listing for board workflows
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { MCPError, ErrorCode } from '../types';
import { getClientFromContext, setGlobalClientFactory } from '../client';
import { logger } from '../utils/logger';
import { createAuthRequiredError } from '../utils/error-handler';
import { createDirectClient } from '../client/direct-client';
import {
  handleListBucketTasks,
  handleListBuckets,
  handleListViews,
} from '../tools/tasks/buckets/index';

export function registerTaskBucketsTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory,
): void {
  server.tool(
    'vikunja_buckets',
    'List project views and buckets for kanban board management',
    {
      operation: z.enum(['list-views', 'list-buckets', 'list-bucket-tasks']),
      projectId: z.number(),
      viewId: z.number().optional(),
      bucketId: z.number().optional(),
    },
    async (args) => {
      try {
        logger.debug('Executing task buckets tool', { operation: args.operation });

        if (!authManager.isAuthenticated()) {
          throw createAuthRequiredError('access bucket operations');
        }

        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        await getClientFromContext();

        const directClient = createDirectClient(authManager);

        switch (args.operation) {
          case 'list-views':
            return await handleListViews({ projectId: args.projectId }, directClient);

          case 'list-buckets':
            if (args.viewId === undefined) {
              return await handleListBuckets({ projectId: args.projectId }, directClient);
            }

            return await handleListBuckets(
              {
                projectId: args.projectId,
                viewId: args.viewId,
              },
              directClient,
            );

          case 'list-bucket-tasks':
            if (args.viewId === undefined) {
              return await handleListBucketTasks({ projectId: args.projectId }, directClient);
            }

            return await handleListBucketTasks(
              args.bucketId === undefined
                ? {
                    projectId: args.projectId,
                    viewId: args.viewId,
                  }
                : {
                    projectId: args.projectId,
                    viewId: args.viewId,
                    bucketId: args.bucketId,
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
          `Bucket operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
