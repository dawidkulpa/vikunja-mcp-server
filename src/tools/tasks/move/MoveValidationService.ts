import { MCPError, ErrorCode } from '../../../types';
import { validateId } from '../../../utils/validation';

export interface MoveInput {
  projectId?: number;
  viewId?: number;
  bucketId?: number;
  taskId?: number;
  position?: number | undefined;
}

export class MoveValidationService {
  private validateRequiredId(value: number | undefined, fieldName: string): number {
    if (value === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, `${fieldName} is required`);
    }

    validateId(value, fieldName);
    return value;
  }

  validateMoveInput(args: MoveInput): {
    projectId: number;
    viewId: number;
    bucketId: number;
    taskId: number;
    position?: number;
  } {
    const projectId = this.validateRequiredId(args.projectId, 'projectId');
    const viewId = this.validateRequiredId(args.viewId, 'viewId');
    const bucketId = this.validateRequiredId(args.bucketId, 'bucketId');
    const taskId = this.validateRequiredId(args.taskId, 'taskId');

    return {
      projectId,
      viewId,
      bucketId,
      taskId,
      ...(args.position !== undefined ? { position: args.position } : {}),
    };
  }
}
