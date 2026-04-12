import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthManager } from '../../src/auth/AuthManager';
import { createDirectClient, VikunjaDirectClient } from '../../src/client/direct-client';
import { ErrorCode, MCPError } from '../../src/types';

describe('VikunjaDirectClient', () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let mockAuthManager: jest.Mocked<Pick<AuthManager, 'getSession' | 'isAuthenticated'>>;

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
      isAuthenticated: jest.fn().mockReturnValue(true),
    } as jest.Mocked<Pick<AuthManager, 'getSession' | 'isAuthenticated'>>;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createJsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  it('creates a direct client from the factory helper', () => {
    const client = createDirectClient(mockAuthManager as unknown as AuthManager);

    expect(client).toBeInstanceOf(VikunjaDirectClient);
  });

  it('performs GET requests with session auth headers', async () => {
    mockFetch.mockResolvedValue(createJsonResponse({ id: 1, title: 'View' }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    const result = await client.get<{ id: number; title: string }>('/projects/1/views');

    expect(result).toEqual({ id: 1, title: 'View' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/v1/projects/1/views',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer tk_test123',
        }),
      })
    );
    expect(mockAuthManager.getSession).toHaveBeenCalledTimes(1);
  });

  it('performs POST requests with a JSON body', async () => {
    const payload = { title: 'Created view' };
    mockFetch.mockResolvedValue(createJsonResponse({ id: 2, ...payload }, 201));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    const result = await client.post<{ id: number; title: string }>('/projects/1/views', payload);

    expect(result).toEqual({ id: 2, title: 'Created view' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/v1/projects/1/views',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer tk_test123',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(mockAuthManager.getSession).toHaveBeenCalledTimes(1);
  });

  it('performs PUT requests with a JSON body', async () => {
    const payload = { title: 'Updated view' };
    mockFetch.mockResolvedValue(createJsonResponse({ id: 2, ...payload }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    const result = await client.put<{ id: number; title: string }>('/projects/1/views/2', payload);

    expect(result).toEqual({ id: 2, title: 'Updated view' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/v1/projects/1/views/2',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer tk_test123',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(mockAuthManager.getSession).toHaveBeenCalledTimes(1);
  });

  it('performs DELETE requests', async () => {
    mockFetch.mockResolvedValue(createJsonResponse({ success: true }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    const result = await client.delete<{ success: boolean }>('/projects/1/views/2');

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/v1/projects/1/views/2',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer tk_test123',
        }),
      })
    );
    expect(mockAuthManager.getSession).toHaveBeenCalledTimes(1);
  });

  it('throws an MCPError for 401 responses', async () => {
    mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    await expect(client.get('/tasks/1')).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      details: expect.objectContaining({ statusCode: 401 }),
      message: expect.stringContaining('Unauthorized'),
    });
  });

  it('throws an MCPError for 404 responses', async () => {
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    await expect(client.get('/tasks/999')).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      details: expect.objectContaining({ statusCode: 404 }),
      message: expect.stringContaining('Not Found'),
    });
  });

  it('throws an MCPError for 500 responses', async () => {
    mockFetch.mockResolvedValue(new Response('Server exploded', { status: 500, statusText: 'Internal Server Error' }));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    await expect(client.get('/tasks/1')).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      details: expect.objectContaining({ statusCode: 500 }),
      message: expect.stringContaining('Server exploded'),
    });
  });

  it('converts network failures to MCPError instances', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));
    const client = new VikunjaDirectClient(mockAuthManager as unknown as AuthManager);

    try {
      await client.get('/tasks/1');
      throw new Error('Expected request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(MCPError);
      expect(error).toMatchObject({
        code: ErrorCode.AUTH_REQUIRED,
      });
    }
  });
});
