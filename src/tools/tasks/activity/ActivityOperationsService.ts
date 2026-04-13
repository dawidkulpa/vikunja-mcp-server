import type { VikunjaDirectClient } from '../../../client/direct-client';
import type { Activity } from '../../../types/vikunja';
import { MCPError, ErrorCode } from '../../../types/errors';

export class ActivityOperationsService {
  constructor(private readonly directClient: VikunjaDirectClient) {}

  async list(taskId: number, page: number): Promise<{ activities: Activity[]; notAvailable: boolean }> {
    try {
      const query = page > 1 ? `?page=${page}` : '';
      const activities = await this.directClient.get<Activity[]>(`/tasks/${taskId}/activities${query}`);
      return { activities, notAvailable: false };
    } catch (error) {
      // Gracefully handle 404 when activities endpoint is not available
      if (error instanceof MCPError && error.details && (error.details as { statusCode?: number }).statusCode === 404) {
        return { activities: [], notAvailable: true };
      }
      throw error;
    }
  }
}
