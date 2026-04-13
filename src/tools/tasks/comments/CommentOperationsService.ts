/**
 * Comment operations service
 * Handles core business logic for task comment management
 */

import type { TaskComment } from '../../../types/vikunja';
import { getClientFromContext } from '../../../client';

/**
 * Service for managing task comment operations
 */
export const CommentOperationsService = {
  /**
   * Create a new comment on a task
   */
  async createComment(taskId: number, commentText: string): Promise<TaskComment> {
    const client = await getClientFromContext();
    return await client.tasks.createTaskComment(taskId, {
      task_id: taskId,
      comment: commentText,
    });
  },

  /**
   * Fetch all comments for a task
   */
  async fetchTaskComments(taskId: number): Promise<TaskComment[]> {
    const client = await getClientFromContext();
    return await client.tasks.getTaskComments(taskId);
  },

  /**
   * List comments for a task
   */
  async listComments(taskId: number): Promise<TaskComment[]> {
    const client = await getClientFromContext();
    return await client.tasks.getTaskComments(taskId);
  },

  /**
   * Add a new comment to a task
   */
  async addComment(taskId: number, comment: string): Promise<TaskComment> {
    const client = await getClientFromContext();
    return await client.tasks.createTaskComment(taskId, {
      task_id: taskId,
      comment,
    });
  },

  /**
   * Update an existing task comment
   */
  async updateComment(taskId: number, commentId: number, comment: string): Promise<TaskComment> {
    const client = await getClientFromContext();
    return await client.tasks.updateTaskComment(taskId, commentId, {
      task_id: taskId,
      comment,
    });
  },

  /**
   * Delete a task comment
   */
  async deleteComment(taskId: number, commentId: number): Promise<void> {
    const client = await getClientFromContext();
    await client.tasks.deleteTaskComment(taskId, commentId);
  },

  /**
   * Get comment count from comments array
   */
  getCommentCount(comments: TaskComment[]): number {
    return comments.length;
  },
};
