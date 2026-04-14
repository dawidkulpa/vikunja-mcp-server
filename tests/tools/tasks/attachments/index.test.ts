import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { VikunjaDirectClient } from '../../../../src/client/direct-client';
import type { Attachment } from '../../../../src/types/vikunja';

jest.mock('../../../../src/utils/file-io');
jest.mock('../../../../src/tools/tasks/attachments/AttachmentValidationService', () => ({
  AttachmentValidationService: jest.fn(),
}));
jest.mock('../../../../src/tools/tasks/attachments/AttachmentOperationsService', () => ({
  AttachmentOperationsService: jest.fn(),
}));
jest.mock('../../../../src/tools/tasks/attachments/AttachmentResponseFormatter', () => ({
  AttachmentResponseFormatter: jest.fn(),
}));

import { AttachmentValidationService } from '../../../../src/tools/tasks/attachments/AttachmentValidationService';
import { AttachmentOperationsService } from '../../../../src/tools/tasks/attachments/AttachmentOperationsService';
import { AttachmentResponseFormatter } from '../../../../src/tools/tasks/attachments/AttachmentResponseFormatter';
import {
  handleDeleteAttachment,
  handleDownloadAttachment,
  handleListAttachments,
  handleUploadAttachment,
} from '../../../../src/tools/tasks/attachments';

function createAttachment(): Attachment {
  return {
    id: 7,
    task_id: 1,
    created_by: { id: 2, username: 'tester' },
    created: '2026-01-01T00:00:00Z',
    file: {
      id: 9,
      name: 'file.pdf',
      mime: 'application/pdf',
      size: 1024,
      created: '2026-01-01T00:00:00Z',
    },
  };
}

describe('attachment handlers', () => {
  const mockDirectClient = {
    uploadFormData: jest.fn(),
    get: jest.fn(),
    getBuffer: jest.fn(),
    delete: jest.fn(),
  } as unknown as VikunjaDirectClient;

  const validationInstance = {
    validateUploadInput: jest.fn(),
    validateListInput: jest.fn(),
    validateDownloadInput: jest.fn(),
    validateDeleteInput: jest.fn(),
  };

  const operationsInstance = {
    upload: jest.fn(),
    list: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };

  const formatterInstance = {
    formatUpload: jest.fn(),
    formatList: jest.fn(),
    formatDownload: jest.fn(),
    formatDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AttachmentValidationService as unknown as jest.Mock).mockImplementation(() => validationInstance);
    (AttachmentOperationsService as unknown as jest.Mock).mockImplementation(() => operationsInstance);
    (AttachmentResponseFormatter as unknown as jest.Mock).mockImplementation(() => formatterInstance);
  });

  it('handleUploadAttachment calls validation operations and formatter in order', async () => {
    const attachment = createAttachment();
    const response = { content: [{ type: 'text' as const, text: 'ok' }] };
    validationInstance.validateUploadInput.mockReturnValue({ taskId: 1, filePath: '/tmp/file.pdf' });
    operationsInstance.upload.mockResolvedValue(attachment);
    formatterInstance.formatUpload.mockReturnValue(response);

    const result = await handleUploadAttachment({ taskId: 1, filePath: '/tmp/file.pdf' }, mockDirectClient);

    expect(validationInstance.validateUploadInput).toHaveBeenCalledWith({ taskId: 1, filePath: '/tmp/file.pdf' });
    expect(operationsInstance.upload).toHaveBeenCalledWith(1, '/tmp/file.pdf');
    expect(formatterInstance.formatUpload).toHaveBeenCalledWith(attachment);
    expect(result).toBe(response);
  });

  it('handleListAttachments calls validation operations and formatter in order', async () => {
    const attachments = [createAttachment()];
    const response = { content: [{ type: 'text' as const, text: 'ok' }] };
    validationInstance.validateListInput.mockReturnValue({ taskId: 1 });
    operationsInstance.list.mockResolvedValue(attachments);
    formatterInstance.formatList.mockReturnValue(response);

    const result = await handleListAttachments({ taskId: 1 }, mockDirectClient);

    expect(validationInstance.validateListInput).toHaveBeenCalledWith({ taskId: 1 });
    expect(operationsInstance.list).toHaveBeenCalledWith(1);
    expect(formatterInstance.formatList).toHaveBeenCalledWith(attachments);
    expect(result).toBe(response);
  });

  it('handleDownloadAttachment calls validation operations and formatter in order', async () => {
    const response = { content: [{ type: 'text' as const, text: 'ok' }] };
    validationInstance.validateDownloadInput.mockReturnValue({ taskId: 1, attachmentId: 7, outputPath: '/tmp/out.pdf' });
    operationsInstance.download.mockResolvedValue(undefined);
    formatterInstance.formatDownload.mockReturnValue(response);

    const result = await handleDownloadAttachment({ taskId: 1, attachmentId: 7, outputPath: '/tmp/out.pdf' }, mockDirectClient);

    expect(validationInstance.validateDownloadInput).toHaveBeenCalledWith({ taskId: 1, attachmentId: 7, outputPath: '/tmp/out.pdf' });
    expect(operationsInstance.download).toHaveBeenCalledWith(1, 7, '/tmp/out.pdf');
    expect(formatterInstance.formatDownload).toHaveBeenCalledWith('/tmp/out.pdf', expect.any(Number));
    expect(result).toBe(response);
  });

  it('handleDeleteAttachment calls validation operations and formatter in order', async () => {
    const response = { content: [{ type: 'text' as const, text: 'ok' }] };
    validationInstance.validateDeleteInput.mockReturnValue({ taskId: 1, attachmentId: 7 });
    operationsInstance.delete.mockResolvedValue(undefined);
    formatterInstance.formatDelete.mockReturnValue(response);

    const result = await handleDeleteAttachment({ taskId: 1, attachmentId: 7 }, mockDirectClient);

    expect(validationInstance.validateDeleteInput).toHaveBeenCalledWith({ taskId: 1, attachmentId: 7 });
    expect(operationsInstance.delete).toHaveBeenCalledWith(1, 7);
    expect(formatterInstance.formatDelete).toHaveBeenCalledWith(7);
    expect(result).toBe(response);
  });
});
