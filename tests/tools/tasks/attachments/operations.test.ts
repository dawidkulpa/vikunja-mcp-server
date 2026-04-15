import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { VikunjaDirectClient } from '../../../../src/client/direct-client';
import * as fileIo from '../../../../src/utils/file-io';
import { AttachmentOperationsService } from '../../../../src/tools/tasks/attachments/AttachmentOperationsService';
import { MCPError, ErrorCode } from '../../../../src/types';
import type { Attachment } from '../../../../src/types/vikunja';

jest.mock('../../../../src/utils/file-io');

const mockedFileIo = fileIo as jest.Mocked<typeof fileIo>;

function makeMockClient(): jest.Mocked<Pick<VikunjaDirectClient, 'uploadFormData' | 'get' | 'getBuffer' | 'delete'>> {
  return {
    uploadFormData: jest.fn(),
    get: jest.fn(),
    getBuffer: jest.fn(),
    delete: jest.fn(),
  };
}

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

describe('AttachmentOperationsService', () => {
  let mockClient: ReturnType<typeof makeMockClient>;
  let service: AttachmentOperationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = makeMockClient();
    service = new AttachmentOperationsService(mockClient as unknown as VikunjaDirectClient, fileIo);
  });

  describe('upload', () => {
    it('uploads a file and returns the first attachment', async () => {
      const attachment = createAttachment();
      const buffer = Buffer.from('file-content');

      mockedFileIo.readFileBuffer.mockResolvedValue(buffer);
      mockedFileIo.getFileStats.mockResolvedValue({ name: 'file.pdf', size: 1024 });
      mockClient.uploadFormData.mockResolvedValue([attachment]);

      const result = await service.upload(1, '/tmp/file.pdf');

      expect(mockedFileIo.readFileBuffer).toHaveBeenCalledWith('/tmp/file.pdf');
      expect(mockedFileIo.getFileStats).toHaveBeenCalledWith('/tmp/file.pdf');
      expect(mockClient.uploadFormData).toHaveBeenCalledTimes(1);
      expect(mockClient.uploadFormData.mock.calls[0]?.[0]).toBe('/tasks/1/attachments');

      const formData = mockClient.uploadFormData.mock.calls[0]?.[1];
      expect(formData).toBeInstanceOf(FormData);
      const uploadedFile = formData?.get('files');
      expect(uploadedFile).toBeInstanceOf(File);
      expect((uploadedFile as File).name).toBe('file.pdf');
      expect(result).toBe(attachment);
    });

    it('converts file not found errors to MCPError', async () => {
      const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
      mockedFileIo.readFileBuffer.mockRejectedValue(error);

      await expect(service.upload(1, '/tmp/missing.pdf')).rejects.toMatchObject({
        name: 'MCPError',
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('propagates api errors such as 404', async () => {
      const attachment = createAttachment();
      mockedFileIo.readFileBuffer.mockResolvedValue(Buffer.from('file-content'));
      mockedFileIo.getFileStats.mockResolvedValue({ name: 'file.pdf', size: 1024 });
      mockClient.uploadFormData.mockRejectedValue(
        new MCPError(ErrorCode.API_ERROR, 'not found', { statusCode: 404, endpoint: '/tasks/1/attachments' }),
      );

      await expect(service.upload(1, '/tmp/file.pdf')).rejects.toBeInstanceOf(MCPError);
      expect(attachment.id).toBe(7);
    });
  });

  describe('list', () => {
    it('lists attachments', async () => {
      const attachments = [createAttachment()];
      mockClient.get.mockResolvedValue(attachments);

      const result = await service.list(1);

      expect(mockClient.get).toHaveBeenCalledWith('/tasks/1/attachments');
      expect(result).toEqual(attachments);
    });
  });

  describe('download', () => {
    it('downloads an attachment and writes it to disk', async () => {
      const arrayBuffer = Uint8Array.from([1, 2, 3]).buffer;
      mockClient.getBuffer.mockResolvedValue(arrayBuffer);
      mockedFileIo.writeFileBuffer.mockResolvedValue();

      await service.download(1, 7, '/tmp/out.pdf');

      expect(mockClient.getBuffer).toHaveBeenCalledWith('/tasks/1/attachments/7');
      expect(mockedFileIo.writeFileBuffer).toHaveBeenCalledWith('/tmp/out.pdf', Buffer.from(arrayBuffer));
    });
  });

  describe('delete', () => {
    it('deletes an attachment', async () => {
      mockClient.delete.mockResolvedValue(undefined);

      await expect(service.delete(1, 7)).resolves.toBeUndefined();
      expect(mockClient.delete).toHaveBeenCalledWith('/tasks/1/attachments/7');
    });
  });

  describe('upload', () => {
    it('handles single-object API response (real Vikunja behavior)', async () => {
      const attachment = createAttachment();
      mockedFileIo.readFileBuffer.mockResolvedValue(Buffer.from('file-content'));
      mockedFileIo.getFileStats.mockResolvedValue({ name: 'file.pdf', size: 1024 });
      // Real Vikunja API returns single object, NOT array
      mockClient.uploadFormData.mockResolvedValue(attachment);

      const result = await service.upload(1, '/tmp/file.pdf');
      expect(result).toBe(attachment);
      expect(result.id).toBe(7);
    });

    it('throws MCPError when API returns empty response', async () => {
      mockedFileIo.readFileBuffer.mockResolvedValue(Buffer.from('file-content'));
      mockedFileIo.getFileStats.mockResolvedValue({ name: 'file.pdf', size: 1024 });
      mockClient.uploadFormData.mockResolvedValue(undefined);

      await expect(service.upload(1, '/tmp/file.pdf')).rejects.toMatchObject({
        name: 'MCPError',
        code: ErrorCode.INTERNAL_ERROR,
      });
    });

    it('throws MCPError when API returns empty array', async () => {
      mockedFileIo.readFileBuffer.mockResolvedValue(Buffer.from('file-content'));
      mockedFileIo.getFileStats.mockResolvedValue({ name: 'file.pdf', size: 1024 });
      mockClient.uploadFormData.mockResolvedValue([]);

      await expect(service.upload(1, '/tmp/file.pdf')).rejects.toMatchObject({
        name: 'MCPError',
        code: ErrorCode.INTERNAL_ERROR,
      });
    });
  });
});
