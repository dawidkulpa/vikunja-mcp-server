/**
 * Comment operations for tasks
 * Refactored to use modular service architecture
 */

import { MCPError, ErrorCode } from '../../../types';
import { CommentOperationsService } from './CommentOperationsService';
import { commentValidationService } from './CommentValidationService';
import { commentResponseFormatter } from './CommentResponseFormatter';

type McpTextResponse = Promise<{ content: Array<{ type: 'text'; text: string }> }>;

/**
 * Backward-compatible add comment handler
 */
export async function handleComment(args: { id?: number; comment?: string }): McpTextResponse {
  try {
    const { taskId, commentText } = commentValidationService.validateCommentInput(args);

    if (args.comment === undefined) {
      const comments = await CommentOperationsService.listComments(taskId);
      const response = commentResponseFormatter.formatListCommentsResponse(comments);
      return commentResponseFormatter.formatMcpResponse(response);
    }

    if (!commentValidationService.shouldCreateComment(commentText)) {
      const comments = await CommentOperationsService.listComments(taskId);
      const response = commentResponseFormatter.formatListCommentsResponse(comments);
      return commentResponseFormatter.formatMcpResponse(response);
    }

    if (!commentText) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Comment text is required for comment creation');
    }

    const newComment = await CommentOperationsService.addComment(taskId, commentText);
    const response = commentResponseFormatter.formatAddCommentResponse(newComment);
    return commentResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to handle comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * List all comments for a task
 */
export async function handleListComments(args: { id?: number }): McpTextResponse {
  try {
    const { taskId } = commentValidationService.validateListInput(args);
    const comments = await CommentOperationsService.listComments(taskId);
    const response = commentResponseFormatter.formatListCommentsResponse(comments);
    return commentResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to list comments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Add a comment to a task
 */
export async function handleAddComment(args: { id?: number; comment?: string }): McpTextResponse {
  try {
    const { taskId, commentText } = commentValidationService.validateAddInput(args);
    const newComment = await CommentOperationsService.addComment(taskId, commentText);
    const response = commentResponseFormatter.formatAddCommentResponse(newComment);
    return commentResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to add comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Update a task comment
 */
export async function handleUpdateComment(args: {
  id?: number;
  commentId?: number;
  comment?: string;
}): McpTextResponse {
  try {
    const { taskId, commentId, commentText } = commentValidationService.validateUpdateInput(args);
    const updatedComment = await CommentOperationsService.updateComment(taskId, commentId, commentText);
    const response = commentResponseFormatter.formatUpdateCommentResponse(updatedComment);
    return commentResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to update comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Delete a task comment
 */
export async function handleDeleteComment(args: {
  id?: number;
  commentId?: number;
}): McpTextResponse {
  try {
    const { taskId, commentId } = commentValidationService.validateDeleteInput(args);
    await CommentOperationsService.deleteComment(taskId, commentId);
    const response = commentResponseFormatter.formatDeleteCommentResponse(commentId);
    return commentResponseFormatter.formatMcpResponse(response);
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError(
      ErrorCode.API_ERROR,
      `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Backward-compatible alias for list operation
 */
export async function listComments(args: { id?: number }): McpTextResponse {
  return handleListComments(args);
}

/**
 * Backward-compatible alias for delete operation
 */
export async function removeComment(args: { id?: number; commentId?: number }): McpTextResponse {
  return handleDeleteComment(args);
}
