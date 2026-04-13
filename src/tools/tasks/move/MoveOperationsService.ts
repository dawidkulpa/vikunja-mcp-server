import type { VikunjaDirectClient } from '../../../client/direct-client';
import type { TaskBucketAssignment } from '../../../types/vikunja';

export class MoveOperationsService {
  constructor(private readonly directClient: VikunjaDirectClient) {}

  async move(
    projectId: number,
    viewId: number,
    bucketId: number,
    taskId: number,
    position?: number,
  ): Promise<TaskBucketAssignment> {
    const body: TaskBucketAssignment = { task_id: taskId };
    if (position !== undefined) {
      body.position = position;
    }

    return this.directClient.post<TaskBucketAssignment>(
      `/projects/${projectId}/views/${viewId}/buckets/${bucketId}/tasks`,
      body,
    );
  }
}
