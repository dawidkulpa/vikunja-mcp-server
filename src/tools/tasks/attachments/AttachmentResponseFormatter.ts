import { createSuccessResponse, formatMcpResponse } from '../../../types';
import type { Attachment } from '../../../types/vikunja';

function formatAttachmentSummary(attachment: Attachment, index: number): string {
  return `${index + 1}. Attachment #${attachment.id} | Filename: ${attachment.file?.name ?? 'Unknown'} | Size: ${attachment.file?.size ?? 'Unknown'}`;
}

export class AttachmentResponseFormatter {
  formatUpload(attachment: Attachment): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'upload',
      'Attachment uploaded successfully',
      {
        id: attachment.id,
        filename: attachment.file?.name ?? 'Unknown',
        size: attachment.file?.size ?? 'Unknown',
      },
      { timestamp: new Date().toISOString() },
    );

    return { content: formatMcpResponse(response) };
  }

  formatList(attachments: Attachment[]): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'list',
      attachments.length > 0 ? `Found ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}` : 'No attachments found for this task',
      attachments.length > 0
        ? {
            summary: attachments.map((attachment, index) => formatAttachmentSummary(attachment, index)).join('\n'),
          }
        : undefined,
      {
        timestamp: new Date().toISOString(),
        count: attachments.length,
      },
    );

    return { content: formatMcpResponse(response) };
  }

  formatDownload(outputPath: string, size: number): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'download',
      'Attachment downloaded successfully',
      {
        outputPath,
        size,
      },
      { timestamp: new Date().toISOString() },
    );

    return { content: formatMcpResponse(response) };
  }

  formatDelete(attachmentId: number): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'delete',
      'Attachment deleted successfully',
      { attachmentId },
      { timestamp: new Date().toISOString() },
    );

    return { content: formatMcpResponse(response) };
  }
}
