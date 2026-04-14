import type { VikunjaDirectClient } from '../../../client/direct-client';
import * as fileIO from '../../../utils/file-io';
import { AttachmentOperationsService } from './AttachmentOperationsService';
import { AttachmentResponseFormatter } from './AttachmentResponseFormatter';
import {
  AttachmentValidationService,
  type DeleteInput,
  type DownloadInput,
  type ListInput,
  type UploadInput,
} from './AttachmentValidationService';

export async function handleUploadAttachment(
  args: UploadInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new AttachmentValidationService();
  const operationsService = new AttachmentOperationsService(directClient, fileIO);
  const responseFormatter = new AttachmentResponseFormatter();

  const { taskId, filePath } = validationService.validateUploadInput(args);
  const attachment = await operationsService.upload(taskId, filePath);

  return responseFormatter.formatUpload(attachment);
}

export async function handleListAttachments(
  args: ListInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new AttachmentValidationService();
  const operationsService = new AttachmentOperationsService(directClient, fileIO);
  const responseFormatter = new AttachmentResponseFormatter();

  const { taskId } = validationService.validateListInput(args);
  const attachments = await operationsService.list(taskId);

  return responseFormatter.formatList(attachments);
}

export async function handleDownloadAttachment(
  args: DownloadInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new AttachmentValidationService();
  const operationsService = new AttachmentOperationsService(directClient, fileIO);
  const responseFormatter = new AttachmentResponseFormatter();

  const { taskId, attachmentId, outputPath } = validationService.validateDownloadInput(args);
  await operationsService.download(taskId, attachmentId, outputPath);

  return responseFormatter.formatDownload(outputPath, 0);
}

export async function handleDeleteAttachment(
  args: DeleteInput,
  directClient: VikunjaDirectClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const validationService = new AttachmentValidationService();
  const operationsService = new AttachmentOperationsService(directClient, fileIO);
  const responseFormatter = new AttachmentResponseFormatter();

  const { taskId, attachmentId } = validationService.validateDeleteInput(args);
  await operationsService.delete(taskId, attachmentId);

  return responseFormatter.formatDelete(attachmentId);
}
