/**
 * Task Comments Tool
 * Handles task comment operations: comment
 * Replaces monolithic tasks tool with focused individual tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthManager } from '../auth/AuthManager';
import type { VikunjaClientFactory } from '../client/VikunjaClientFactory';
import { MCPError, ErrorCode } from '../types';
import { getClientFromContext, setGlobalClientFactory } from '../client';
import { logger } from '../utils/logger';
import { createAuthRequiredError } from '../utils/error-handler';
import {
  handleAddComment,
  handleDeleteComment,
  handleListComments,
  handleUpdateComment,
} from '../tools/tasks/comments/index';

/**
 * Register task comments tool
 */
export function registerTaskCommentsTool(
  server: McpServer,
  authManager: AuthManager,
  clientFactory?: VikunjaClientFactory
): void {
  server.tool(
    'vikunja_task_comments',
    'Manage task comments: list, add, update, and delete',
    {
      operation: z.enum(['list', 'add', 'update', 'delete']),
      // Task and comment identification
      id: z.number(),
      comment: z.string().optional().describe('Comment text. Use HTML for rich text (e.g. <p>, <strong>, <em>, <h1>-<h6>, <ul>/<li>, <code>, <pre>, <blockquote>). Raw markdown will NOT render — Vikunja uses an HTML-based editor.'),
      commentId: z.number().optional(),
    },
    async (args) => {
      try {
        logger.debug('Executing task comments tool', { operation: args.operation, taskId: args.id });

        // Check authentication
        if (!authManager.isAuthenticated()) {
          throw createAuthRequiredError('access task comment operations');
        }

        // Set the client factory for this request if provided
        if (clientFactory) {
          await setGlobalClientFactory(clientFactory);
        }

        // Test client connection
        await getClientFromContext();

        const baseArgs = { id: args.id };
        const argsWithComment = {
          ...baseArgs,
          ...(args.comment !== undefined ? { comment: args.comment } : {}),
        };
        const argsWithCommentId = {
          ...baseArgs,
          ...(args.commentId !== undefined ? { commentId: args.commentId } : {}),
        };
        const argsWithCommentIdAndComment = {
          ...argsWithCommentId,
          ...(args.comment !== undefined ? { comment: args.comment } : {}),
        };

        switch (args.operation) {
          case 'list':
            return await handleListComments(baseArgs);

          case 'add':
            return await handleAddComment(argsWithComment);

          case 'update':
            return await handleUpdateComment(argsWithCommentIdAndComment);

          case 'delete':
            return await handleDeleteComment(argsWithCommentId);

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
          `Task comment operation error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
