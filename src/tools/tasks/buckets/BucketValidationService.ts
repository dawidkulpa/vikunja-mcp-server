import { MCPError, ErrorCode } from '../../../types';
import { validateId } from '../../../utils/validation';

export interface ListViewsInput {
  projectId?: number;
}

export interface ListBucketsInput extends ListViewsInput {
  viewId?: number;
}

export interface ListBucketTasksInput extends ListBucketsInput {
  bucketId?: number;
}

export class BucketValidationService {
  validateProjectId(projectId?: number): number {
    if (projectId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'projectId is required');
    }

    validateId(projectId, 'projectId');
    return projectId;
  }

  validateListViewsInput(args: ListViewsInput): { projectId: number } {
    return {
      projectId: this.validateProjectId(args.projectId),
    };
  }

  validateListBucketsInput(args: ListBucketsInput): { projectId: number; viewId: number } {
    const projectId = this.validateProjectId(args.projectId);

    if (args.viewId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'viewId is required for list-buckets operation');
    }

    validateId(args.viewId, 'viewId');

    return {
      projectId,
      viewId: args.viewId,
    };
  }

  validateListBucketTasksInput(args: ListBucketTasksInput): { projectId: number; viewId: number; bucketId?: number } {
    const projectId = this.validateProjectId(args.projectId);

    if (args.viewId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'viewId is required for list-bucket-tasks operation');
    }

    validateId(args.viewId, 'viewId');
    const viewId = args.viewId;

    if (args.bucketId !== undefined) {
      validateId(args.bucketId, 'bucketId');
    }

    return args.bucketId === undefined
      ? { projectId, viewId }
      : { projectId, viewId, bucketId: args.bucketId };
  }
}
