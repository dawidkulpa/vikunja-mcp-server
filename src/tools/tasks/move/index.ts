import type { VikunjaDirectClient } from '../../../client/direct-client';
import { MoveOperationsService } from './MoveOperationsService';
import { MoveResponseFormatter } from './MoveResponseFormatter';
import { MoveValidationService, type MoveInput } from './MoveValidationService';

export async function handleMove(
  args: MoveInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new MoveValidationService();
  const operationsService = new MoveOperationsService(directClient);
  const responseFormatter = new MoveResponseFormatter();

  const { projectId, viewId, bucketId, taskId, position } =
    validationService.validateMoveInput(args);
  const result = await operationsService.move(projectId, viewId, bucketId, taskId, position);

  return responseFormatter.formatMove(result, taskId, bucketId);
}
