import type { VikunjaDirectClient } from '../../../client/direct-client';
import { ActivityOperationsService } from './ActivityOperationsService';
import { ActivityResponseFormatter } from './ActivityResponseFormatter';
import {
  ActivityValidationService,
  type ListActivityInput,
} from './ActivityValidationService';

export async function handleListActivity(
  args: ListActivityInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new ActivityValidationService();
  const operationsService = new ActivityOperationsService(directClient);
  const responseFormatter = new ActivityResponseFormatter();

  const { taskId, page } = validationService.validateListInput(args);
  const { activities, notAvailable } = await operationsService.list(taskId, page);

  return responseFormatter.formatActivities(activities, notAvailable);
}
