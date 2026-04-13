import type { Bucket, BucketWithTasks, ProjectView } from '../../../types/vikunja';
import type { VikunjaDirectClient } from '../../../client/direct-client';

export class BucketOperationsService {
  constructor(private readonly directClient: VikunjaDirectClient) {}

  async listViews(projectId: number): Promise<ProjectView[]> {
    return this.directClient.get<ProjectView[]>(`/projects/${projectId}/views`);
  }

  async listBuckets(projectId: number, viewId: number): Promise<Bucket[]> {
    return this.directClient.get<Bucket[]>(`/projects/${projectId}/views/${viewId}/buckets`);
  }

  async listBucketTasks(projectId: number, viewId: number): Promise<BucketWithTasks[]> {
    return this.directClient.get<BucketWithTasks[]>(`/projects/${projectId}/views/${viewId}/tasks`);
  }
}
