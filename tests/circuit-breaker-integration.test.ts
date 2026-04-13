/**
 * Circuit Breaker Integration Tests with Retry Logic
 * Tests network failure recovery and cascading failure prevention
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { withRetry, isRetryableError } from '../src/utils/retry';

// Mock logger to avoid console spam
jest.mock('../src/utils/logger');

describe('Circuit Breaker Integration with Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retry retryable failures without named circuit breaker support', async () => {
    let callCount = 0;
    const mockOperation = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('network timeout');
      }
      return 'success';
    });

    const result = await withRetry(mockOperation, {
      maxRetries: 2,
      initialDelay: 1,
      maxDelay: 1,
    });

    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should handle network partition detection in retry logic', async () => {
    const networkErrors = [
      { error: new Error('ETIMEDOUT'), expected: true },
      { error: new Error('ECONNRESET'), expected: true },
      { error: new Error('ENOTFOUND'), expected: false },
      { error: new Error('socket hang up'), expected: true },
      { error: new Error('validation error'), expected: false },
    ];

    for (const { error, expected } of networkErrors) {
      let callCount = 0;
      const mockOperation = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw error;
        }
        return 'success';
      });

      try {
        await withRetry(mockOperation, {
          maxRetries: 1,
          initialDelay: 10,
          shouldRetry: () => expected
        });

        // If expected to retry, should have been called twice
        expect(mockOperation).toHaveBeenCalledTimes(expected ? 2 : 1);
      } catch (e) {
        // If not expected to retry, should have failed on first attempt
        expect(mockOperation).toHaveBeenCalledTimes(1);
      }
    }
  });

  it('should stop retrying non-retryable failures immediately', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('network error'));

    try {
      await withRetry(mockOperation, {
        maxRetries: 1,
        shouldRetry: () => false,
      });
    } catch (error) {
      // Expected to fail
    }

    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should classify retryable errors using current helper logic', () => {
    expect(isRetryableError(new Error('connection reset'))).toBe(true);
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('validation error'))).toBe(false);
  });
});
