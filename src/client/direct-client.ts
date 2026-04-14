import type { AuthManager } from '../auth/AuthManager';
import { ErrorCode, MCPError } from '../types';
import { handleFetchError } from '../utils/error-handler';

export class VikunjaDirectClient {
  constructor(private readonly authManager: AuthManager) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async uploadFormData<T>(path: string, formData: FormData): Promise<T> {
    const session = this.authManager.getSession();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.apiToken}`,
    };

    try {
      const response = await fetch(`${session.apiUrl}${path}`, {
        method: 'PUT',
        headers,
        body: formData,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new MCPError(
          ErrorCode.API_ERROR,
          `Request failed with status ${response.status}: ${responseText || response.statusText}`,
          {
            statusCode: response.status,
            endpoint: path,
          }
        );
      }

      if (!responseText) {
        return undefined as T;
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      throw handleFetchError(error, `PUT ${path}`);
    }
  }

  async getBuffer(path: string): Promise<ArrayBuffer> {
    const session = this.authManager.getSession();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.apiToken}`,
    };

    try {
      const response = await fetch(`${session.apiUrl}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new MCPError(
          ErrorCode.API_ERROR,
          `Request failed with status ${response.status}: ${responseText || response.statusText}`,
          {
            statusCode: response.status,
            endpoint: path,
          }
        );
      }

      return response.arrayBuffer();
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      throw handleFetchError(error, `GET ${path}`);
    }
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const session = this.authManager.getSession();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.apiToken}`,
    };
    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' || method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${session.apiUrl}${path}`, requestInit);

      const responseText = await response.text();

      if (!response.ok) {
        throw new MCPError(
          ErrorCode.API_ERROR,
          `Request failed with status ${response.status}: ${responseText || response.statusText}`,
          {
            statusCode: response.status,
            endpoint: path,
          }
        );
      }

      if (!responseText) {
        return undefined as T;
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      throw handleFetchError(error, `${method} ${path}`);
    }
  }
}

export function createDirectClient(authManager: AuthManager): VikunjaDirectClient {
  return new VikunjaDirectClient(authManager);
}
