import { describe, expect, it } from '@jest/globals';
import { AttachmentResponseFormatter } from '../../../../src/tools/tasks/attachments/AttachmentResponseFormatter';
import type { Attachment } from '../../../../src/types/vikunja';

function createAttachment(id: number, name: string, size: number): Attachment {
  return {
    id,
    task_id: 1,
    created_by: { id: 1, username: 'tester' },
    created: '2026-01-01T00:00:00Z',
    file: {
      id: id + 10,
      name,
      mime: 'application/pdf',
      size,
      created: '2026-01-01T00:00:00Z',
    },
  };
}

function getText(result: { content: Array<{ type: 'text'; text: string }> }): string {
  return result.content.map((entry) => entry.text).join('\n');
}

describe('AttachmentResponseFormatter', () => {
  const formatter = new AttachmentResponseFormatter();

  it('formatUpload returns text with attachment id filename and size', () => {
    const result = formatter.formatUpload(createAttachment(7, 'file.pdf', 1024));
    const text = getText(result);

    expect(text).toContain('Attachment uploaded successfully');
    expect(text).toContain('7');
    expect(text).toContain('file.pdf');
    expect(text).toContain('1024');
  });

  it('formatList returns text with count and attachment summaries', () => {
    const result = formatter.formatList([
      createAttachment(7, 'file.pdf', 1024),
      createAttachment(8, 'notes.txt', 256),
    ]);
    const text = getText(result);

    expect(text).toContain('Found 2 attachment');
    expect(text).toContain('7');
    expect(text).toContain('file.pdf');
    expect(text).toContain('8');
    expect(text).toContain('notes.txt');
  });

  it('formatList returns no attachments message for empty list', () => {
    const result = formatter.formatList([]);
    expect(getText(result)).toContain('No attachments found');
  });

  it('formatDownload returns text with saved path and size', () => {
    const result = formatter.formatDownload('/tmp/out.pdf', 2048);
    const text = getText(result);

    expect(text).toContain('Attachment downloaded successfully');
    expect(text).toContain('/tmp/out.pdf');
    expect(text).toContain('2048');
  });

  it('formatDelete returns text confirming deletion of given id', () => {
    const result = formatter.formatDelete(7);
    const text = getText(result);

    expect(text).toContain('Attachment deleted successfully');
    expect(text).toContain('7');
  });
});
