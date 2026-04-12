/**
 * Comment validation service
 * Handles input validation for comment operations
 */

import { MCPError, ErrorCode } from '../../../types';
import { validateId } from '../validation';

export interface CommentOperationInput {
  id?: number;
  comment?: string;
  commentId?: number;
}

/**
 * Service for validating comment operation inputs
 */
export const commentValidationService = {
  /**
   * Validate input for comment operations (create or list)
   */
  validateCommentInput(args: CommentOperationInput): { taskId: number; commentText?: string } {
    if (!args.id) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Task id is required for comment operation');
    }
    validateId(args.id, 'id');

    // Build return object, only including defined properties to satisfy exactOptionalPropertyTypes
    const result: { taskId: number; commentText?: string } = {
      taskId: args.id,
    };

    if (args.comment !== undefined) {
      result.commentText = args.comment;
    }

    return result;
  },

  /**
   * Validate input specifically for listing comments
   */
  validateListInput(args: { id?: number }): { taskId: number } {
    if (!args.id) {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        'Task id is required for list-comments operation',
      );
    }
    validateId(args.id, 'id');

    return {
      taskId: args.id,
    };
  },

  /**
   * Validate input specifically for adding comments
   */
  validateAddInput(args: CommentOperationInput): { taskId: number; commentText: string } {
    const { taskId, commentText } = this.validateCommentInput(args);

    if (commentText === undefined || commentText.trim() === '') {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Comment text is required for add operation');
    }

    return {
      taskId,
      commentText,
    };
  },

  /**
   * Validate input specifically for updating comments
   */
  validateUpdateInput(args: CommentOperationInput): {
    taskId: number;
    commentId: number;
    commentText: string;
  } {
    const { taskId, commentText } = this.validateCommentInput(args);

    if (args.commentId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Comment id is required for update operation');
    }
    validateId(args.commentId, 'commentId');

    if (commentText === undefined || commentText.trim() === '') {
      throw new MCPError(
        ErrorCode.VALIDATION_ERROR,
        'Comment text is required for update operation',
      );
    }

    return {
      taskId,
      commentId: args.commentId,
      commentText,
    };
  },

  /**
   * Validate input specifically for deleting comments
   */
  validateDeleteInput(args: Pick<CommentOperationInput, 'id' | 'commentId'>): {
    taskId: number;
    commentId: number;
  } {
    if (args.id === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Task id is required for delete operation');
    }
    validateId(args.id, 'id');

    if (args.commentId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'Comment id is required for delete operation');
    }
    validateId(args.commentId, 'commentId');

    return {
      taskId: args.id,
      commentId: args.commentId,
    };
  },

  /**
   * Check if operation should create a comment or list comments
   */
  shouldCreateComment(commentText?: string): boolean {
    return commentText !== undefined && commentText.trim() !== '';
  }
};
