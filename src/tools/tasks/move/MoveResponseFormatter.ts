import { createSuccessResponse, formatMcpResponse } from '../../../types';
import type { TaskBucketAssignment } from '../../../types/vikunja';

export class MoveResponseFormatter {
  formatMove(
    result: TaskBucketAssignment,
    taskId: number,
    bucketId: number,
  ): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'move',
      `Moved task ${taskId} to bucket ${bucketId}`,
      {
        taskBucketAssignment: result,
      },
      {
        timestamp: new Date().toISOString(),
        taskId,
        bucketId,
        position: result.position,
      },
    );

    return {
      content: formatMcpResponse(response),
    };
  }
}
