import type { VikunjaDirectClient } from '../../../client/direct-client';
import type { Activity } from '../../../types/vikunja';

export class ActivityOperationsService {
  constructor(private readonly directClient: VikunjaDirectClient) {}

  async list(taskId: number, page: number): Promise<Activity[]> {
    const query = page > 1 ? `?page=${page}` : '';
    return this.directClient.get<Activity[]>(`/tasks/${taskId}/activities${query}`);
  }
}
