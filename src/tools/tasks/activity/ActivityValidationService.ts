import { MCPError, ErrorCode } from '../../../types';
import { validateId } from '../../../utils/validation';

export interface ListActivityInput {
  taskId?: number;
  page?: number;
}

export class ActivityValidationService {
  validateListInput(args: ListActivityInput): { taskId: number; page: number } {
    if (args.taskId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'taskId is required');
    }

    validateId(args.taskId, 'taskId');

    const page = args.page ?? 1;
    validateId(page, 'page');

    return {
      taskId: args.taskId,
      page,
    };
  }
}
