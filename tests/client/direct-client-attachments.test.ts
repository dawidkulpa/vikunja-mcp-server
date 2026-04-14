import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthManager } from '../../src/auth/AuthManager';
import { VikunjaDirectClient } from '../../src/client/direct-client';
import { ErrorCode, MCPError } from '../../src/types';

describe('VikunjaDirectClient - attachment methods', () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let mockAuthManager: jest.Mocked<Pick<AuthManager, 'getSession'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    mockFetch = jest.fn<typeof fetch>();
    global.fetch = mockFetch;
    mockAuthManager = {
      getSession: jest.fn().mockReturnValue({
        apiUrl: 'https://test.example.com/api/v1',
        apiToken: 'tk_test123',
        authType: 'api-token',
      }),
    } as jest.Mocked<Pick<AuthManager, 'getSession'>>;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('uploadFormData', () => {
    it('sends a PUT request with the FormData body and auth header', async () => {
      const responsePayload = { id: 1, file: { name: 'test.pdf', size: 1024 } };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(responsePayload), { status: 200 })
      );
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);
      const formData = new FormData();
      formData.append('files', new Blob(['file content']), 'test.pdf');

      const result = await client.uploadFormData<typeof responsePayload>('/tasks/1/attachments', formData);

      expect(result).toEqual(responsePayload);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/api/v1/tasks/1/attachments',
        expect.objectContaining({
          method: 'PUT',
          body: formData,
          headers: expect.objectContaining({
            Authorization: 'Bearer tk_test123',
          }),
        })
      );
    });

    it('does NOT set Content-Type header (so fetch sets multipart boundary)', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      await client.uploadFormData('/tasks/1/attachments', new FormData());

      const [, callOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = callOptions.headers as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('throws MCPError on non-2xx responses', async () => {
      mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      await expect(
        client.uploadFormData('/tasks/999/attachments', new FormData())
      ).rejects.toMatchObject({
        code: ErrorCode.API_ERROR,
        details: expect.objectContaining({ statusCode: 404 }),
      });
    });

    it('wraps network errors in MCPError', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'));
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      await expect(
        client.uploadFormData('/tasks/1/attachments', new FormData())
      ).rejects.toBeInstanceOf(MCPError);
    });
  });

  describe('getBuffer', () => {
    it('sends a GET request and returns the raw ArrayBuffer', async () => {
      const arrayBuffer = new TextEncoder().encode('binary content').buffer;
      mockFetch.mockResolvedValue(
        new Response(arrayBuffer, { status: 200 })
      );
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      const result = await client.getBuffer('/tasks/1/attachments/7');

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/api/v1/tasks/1/attachments/7',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer tk_test123',
          }),
        })
      );
    });

    it('throws MCPError on non-2xx responses', async () => {
      mockFetch.mockResolvedValue(new Response('Forbidden', { status: 403 }));
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      await expect(
        client.getBuffer('/tasks/1/attachments/7')
      ).rejects.toMatchObject({
        code: ErrorCode.API_ERROR,
        details: expect.objectContaining({ statusCode: 403 }),
      });
    });

    it('wraps network errors in MCPError', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));
      const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

      await expect(
        client.getBuffer('/tasks/1/attachments/7')
      ).rejects.toBeInstanceOf(MCPError);
    });
  });
});
