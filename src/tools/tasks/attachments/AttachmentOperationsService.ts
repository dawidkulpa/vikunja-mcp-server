import type { VikunjaDirectClient } from '../../../client/direct-client';
import { MCPError, ErrorCode } from '../../../types';
import type { Attachment } from '../../../types/vikunja';
import type * as fileIo from '../../../utils/file-io';

export class AttachmentOperationsService {
  constructor(
    private readonly directClient: VikunjaDirectClient,
    private readonly fileIO: typeof fileIo,
  ) {}

  async upload(taskId: number, filePath: string): Promise<Attachment> {
    try {
      const buffer = await this.fileIO.readFileBuffer(filePath);
      const { name } = await this.fileIO.getFileStats(filePath);
      const formData = new FormData();

      formData.append('files', new Blob([buffer]), name);

      const attachments = await this.directClient.uploadFormData<Attachment[]>(`/tasks/${taskId}/attachments`, formData);

      return attachments[0] as Attachment;
    } catch (error) {
      this.handleFileError(error, filePath);
      throw error;
    }
  }

  async list(taskId: number): Promise<Attachment[]> {
    return this.directClient.get<Attachment[]>(`/tasks/${taskId}/attachments`);
  }

  async download(taskId: number, attachmentId: number, outputPath: string): Promise<void> {
    const arrayBuffer = await this.directClient.getBuffer(`/tasks/${taskId}/attachments/${attachmentId}`);
    await this.fileIO.writeFileBuffer(outputPath, Buffer.from(arrayBuffer));
  }

  async delete(taskId: number, attachmentId: number): Promise<void> {
    await this.directClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
  }

  private handleFileError(error: unknown, filePath: string): void {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new MCPError(ErrorCode.NOT_FOUND, `File not found: ${filePath}`);
    }
  }
}
