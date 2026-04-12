import type { VikunjaDirectClient } from '../../../client/direct-client';
import { BucketOperationsService } from './BucketOperationsService';
import { BucketResponseFormatter } from './BucketResponseFormatter';
import {
  BucketValidationService,
  type ListBucketsInput,
  type ListViewsInput,
} from './BucketValidationService';

export async function handleListViews(
  args: ListViewsInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new BucketValidationService();
  const operationsService = new BucketOperationsService(directClient);
  const responseFormatter = new BucketResponseFormatter();

  const { projectId } = validationService.validateListViewsInput(args);
  const views = await operationsService.listViews(projectId);

  return responseFormatter.formatViews(views);
}

export async function handleListBuckets(
  args: ListBucketsInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new BucketValidationService();
  const operationsService = new BucketOperationsService(directClient);
  const responseFormatter = new BucketResponseFormatter();

  const { projectId, viewId } = validationService.validateListBucketsInput(args);
  const buckets = await operationsService.listBuckets(projectId, viewId);

  return responseFormatter.formatBuckets(buckets);
}
