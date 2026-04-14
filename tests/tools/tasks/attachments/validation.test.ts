import { beforeEach, describe, expect, it } from '@jest/globals';
import { AttachmentValidationService } from '../../../../src/tools/tasks/attachments/AttachmentValidationService';
import { MCPError } from '../../../../src/types';

describe('AttachmentValidationService', () => {
  let service: AttachmentValidationService;

  beforeEach(() => {
    service = new AttachmentValidationService();
  });

  describe('validateUploadInput', () => {
    it('returns valid upload input', () => {
      expect(service.validateUploadInput({ taskId: 1, filePath: '/tmp/file.pdf' }))
        .toEqual({ taskId: 1, filePath: '/tmp/file.pdf' });
    });

    it('throws when taskId is missing', () => {
      expect(() => service.validateUploadInput({ filePath: '/tmp/file.pdf' }))
        .toThrow(MCPError);
    });

    it('throws when filePath is missing', () => {
      expect(() => service.validateUploadInput({ taskId: 1 }))
        .toThrow(MCPError);
    });
  });

  describe('validateListInput', () => {
    it('returns valid list input', () => {
      expect(service.validateListInput({ taskId: 5 })).toEqual({ taskId: 5 });
    });

    it('throws when taskId is missing', () => {
      expect(() => service.validateListInput({}))
        .toThrow(MCPError);
    });
  });

  describe('validateDownloadInput', () => {
    it('returns valid download input', () => {
      expect(service.validateDownloadInput({ taskId: 1, attachmentId: 7, outputPath: '/tmp/out.pdf' }))
        .toEqual({ taskId: 1, attachmentId: 7, outputPath: '/tmp/out.pdf' });
    });

    it('throws when taskId is missing', () => {
      expect(() => service.validateDownloadInput({ attachmentId: 7, outputPath: '/tmp/out' }))
        .toThrow(MCPError);
    });

    it('throws when attachmentId is missing', () => {
      expect(() => service.validateDownloadInput({ taskId: 1, outputPath: '/tmp/out' }))
        .toThrow(MCPError);
    });

    it('throws when outputPath is missing', () => {
      expect(() => service.validateDownloadInput({ taskId: 1, attachmentId: 7 }))
        .toThrow(MCPError);
    });
  });

  describe('validateDeleteInput', () => {
    it('returns valid delete input', () => {
      expect(service.validateDeleteInput({ taskId: 1, attachmentId: 7 }))
        .toEqual({ taskId: 1, attachmentId: 7 });
    });

    it('throws when taskId is missing', () => {
      expect(() => service.validateDeleteInput({ attachmentId: 7 }))
        .toThrow(MCPError);
    });

    it('throws when attachmentId is missing', () => {
      expect(() => service.validateDeleteInput({ taskId: 1 }))
        .toThrow(MCPError);
    });
  });
});
