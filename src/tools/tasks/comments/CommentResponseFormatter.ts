/**
 * Comment response formatter service
 * Handles response formatting for comment operations
 */

import type { ResponseMetadata } from '../../../types';
import type { TaskComment } from '../../../types/vikunja';
import { createStandardResponse } from '../../../types';
import { formatAorpAsMarkdown } from '../../../utils/response-factory';

type CommentTaskResponse = {
  success: boolean;
  operation: 'comment' | 'list' | 'update' | 'delete';
  message?: string;
  comment?: TaskComment;
  comments?: TaskComment[];
  metadata?: ResponseMetadata;
};

/**
 * Service for formatting comment operation responses
 */
export const commentResponseFormatter = {
  /**
   * Format successful comment creation response
   */
  formatCreateCommentResponse(comment: TaskComment): CommentTaskResponse {
    return {
      success: true,
      operation: 'comment',
      message: 'Comment added successfully',
      comment: comment,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Format successful add comment response
   */
  formatAddCommentResponse(comment: TaskComment): CommentTaskResponse {
    return {
      success: true,
      operation: 'comment',
      message: 'Comment added successfully',
      comment,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Format successful update comment response
   */
  formatUpdateCommentResponse(comment: TaskComment): CommentTaskResponse {
    return {
      success: true,
      operation: 'update',
      message: 'Comment updated successfully',
      comment,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Format successful delete comment response
   */
  formatDeleteCommentResponse(commentId: number): CommentTaskResponse {
    return {
      success: true,
      operation: 'delete',
      message: 'Comment deleted successfully',
      metadata: {
        timestamp: new Date().toISOString(),
        deletedCommentId: commentId,
      },
    };
  },

  /**
   * Format successful comment list response
   */
  formatListCommentsResponse(comments: TaskComment[]): CommentTaskResponse {
    return {
      success: true,
      operation: 'list',
      message: `Found ${comments.length} comments`,
      comments: comments,
      metadata: {
        timestamp: new Date().toISOString(),
        count: comments.length,
      },
    };
  },

  /**
   * Format MCP response wrapper
   */
  formatMcpResponse(response: CommentTaskResponse): { content: Array<{ type: 'text'; text: string }> } {
    // Handle metadata properly to avoid type issues
    const safeMetadata: ResponseMetadata = {
      timestamp: response.metadata?.timestamp || new Date().toISOString(),
      ...(response.metadata?.count !== undefined ? { count: response.metadata.count } : {}),
      ...(response.metadata?.affectedFields ? { affectedFields: response.metadata.affectedFields } : {}),
      // Convert previousState to proper Record<string, unknown> if it exists
      ...(response.metadata?.previousState && typeof response.metadata.previousState === 'object' && response.metadata.previousState !== null
        ? { previousState: response.metadata.previousState }
        : {})
    };

    // Create proper AORP response instead of casting StandardTaskResponse
    const aorpResponse = createStandardResponse(
      response.operation || 'unknown',
      response.message || 'Operation completed',
      response,
      safeMetadata
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: formatAorpAsMarkdown(aorpResponse), // Format AORP response as markdown
        },
      ],
    };
  }
};
