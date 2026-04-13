import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { applyBothMiddleware, applyPermissions, applyRateLimiting } from '../../src/middleware/direct-middleware';
import { MCPError, ErrorCode } from '../../src/types/errors';
import { Permission } from '../../src/auth/permissions';
import { withRateLimit } from '../../src/middleware/simplified-rate-limit';
import { PermissionManager } from '../../src/auth/permissions';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/middleware/simplified-rate-limit', () => ({
  withRateLimit: jest.fn((toolName: string, handler: (...args: unknown[]) => Promise<unknown>) => {
    return async (...args: unknown[]) => handler(...args);
  }),
}));

jest.mock('../../src/auth/permissions', () => ({
  Permission: {
    BASIC_AUTH: 'basic_auth',
    DATA_EXPORT: 'data_export',
  },
  PermissionManager: {
    checkToolPermission: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe('direct middleware', () => {
  const authManager = {
    isAuthenticated: jest.fn(),
    getSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authManager.isAuthenticated.mockReturnValue(true);
    authManager.getSession.mockReturnValue({ authType: 'api-token' });
    (PermissionManager.checkToolPermission as jest.Mock).mockReturnValue({
      hasPermission: true,
      missingPermissions: [],
    });
  });

  it('delegates applyRateLimiting to the shared rate limit wrapper', async () => {
    const handler = jest.fn().mockResolvedValue('ok');
    const wrapped = applyRateLimiting('vikunja_auth', handler);

    expect(withRateLimit).toHaveBeenCalledWith('vikunja_auth', handler);
    await expect(wrapped('arg')).resolves.toBe('ok');
    expect(handler).toHaveBeenCalledWith('arg');
  });

  it('rejects unauthenticated access with AUTH_REQUIRED', async () => {
    authManager.isAuthenticated.mockReturnValue(false);
    (PermissionManager.checkToolPermission as jest.Mock).mockReturnValue({
      hasPermission: false,
      missingPermissions: [Permission.BASIC_AUTH],
      errorMessage: 'login required',
    });

    const handler = jest.fn();
    const wrapped = applyPermissions('vikunja_users', authManager as any, handler);

    await expect(wrapped('arg')).rejects.toMatchObject({
      code: ErrorCode.AUTH_REQUIRED,
      message: 'login required',
    });
    expect(logger.debug).toHaveBeenCalledWith('Permission denied for tool vikunja_users:', {
      authType: undefined,
      missingPermissions: [Permission.BASIC_AUTH],
      suggestedAuthType: undefined,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects authenticated users lacking permission with PERMISSION_DENIED', async () => {
    authManager.getSession.mockReturnValue({ authType: 'api-token' });
    (PermissionManager.checkToolPermission as jest.Mock).mockReturnValue({
      hasPermission: false,
      missingPermissions: [Permission.DATA_EXPORT],
      suggestedAuthType: 'jwt',
      errorMessage: 'need jwt',
    });

    const handler = jest.fn();
    const wrapped = applyPermissions('vikunja_export', authManager as any, handler);

    await expect(wrapped()).rejects.toMatchObject({
      code: ErrorCode.PERMISSION_DENIED,
      message: 'need jwt',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the handler when permission checks succeed', async () => {
    const handler = jest.fn().mockResolvedValue('granted');
    const session = { authType: 'jwt' };
    authManager.getSession.mockReturnValue(session);
    const wrapped = applyPermissions('vikunja_tasks', authManager as any, handler);

    await expect(wrapped('a', 'b')).resolves.toBe('granted');
    expect(PermissionManager.checkToolPermission).toHaveBeenCalledWith(session, 'vikunja_tasks');
    expect(logger.debug).toHaveBeenCalledWith('Permission granted for tool vikunja_tasks', {
      authType: 'jwt',
    });
    expect(handler).toHaveBeenCalledWith('a', 'b');
  });

  it('composes permission and rate limiting middleware together', async () => {
    const handler = jest.fn().mockResolvedValue('combined');
    const wrapped = applyBothMiddleware('vikunja_tasks', authManager as any, handler);

    await expect(wrapped({ id: 1 })).resolves.toBe('combined');
    expect(withRateLimit).toHaveBeenCalledWith('vikunja_tasks', expect.any(Function));
    expect(PermissionManager.checkToolPermission).toHaveBeenCalledWith({ authType: 'api-token' }, 'vikunja_tasks');
    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });
});
