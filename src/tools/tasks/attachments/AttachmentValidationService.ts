import { MCPError, ErrorCode } from '../../../types';
import { validateId } from '../../../utils/validation';

export interface UploadInput {
  taskId?: number;
  filePath?: string;
}

export interface ListInput {
  taskId?: number;
}

export interface DownloadInput {
  taskId?: number;
  attachmentId?: number;
  outputPath?: string;
}

export interface DeleteInput {
  taskId?: number;
  attachmentId?: number;
}

export class AttachmentValidationService {
  validateUploadInput(args: UploadInput): { taskId: number; filePath: string } {
    if (args.taskId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'taskId is required');
    }

    if (args.filePath === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'filePath is required');
    }

    validateId(args.taskId, 'taskId');

    return {
      taskId: args.taskId,
      filePath: args.filePath,
    };
  }

  validateListInput(args: ListInput): { taskId: number } {
    if (args.taskId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'taskId is required');
    }

    validateId(args.taskId, 'taskId');

    return { taskId: args.taskId };
  }

  validateDownloadInput(args: DownloadInput): { taskId: number; attachmentId: number; outputPath: string } {
    if (args.taskId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'taskId is required');
    }

    if (args.attachmentId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'attachmentId is required');
    }

    if (args.outputPath === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'outputPath is required');
    }

    validateId(args.taskId, 'taskId');
    validateId(args.attachmentId, 'attachmentId');

    return {
      taskId: args.taskId,
      attachmentId: args.attachmentId,
      outputPath: args.outputPath,
    };
  }

  validateDeleteInput(args: DeleteInput): { taskId: number; attachmentId: number } {
    if (args.taskId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'taskId is required');
    }

    if (args.attachmentId === undefined) {
      throw new MCPError(ErrorCode.VALIDATION_ERROR, 'attachmentId is required');
    }

    validateId(args.taskId, 'taskId');
    validateId(args.attachmentId, 'attachmentId');

    return {
      taskId: args.taskId,
      attachmentId: args.attachmentId,
    };
  }
}
