/**
 * HTML Description Passthrough Tests
 * Tests that HTML descriptions are passed through to createTask without sanitization
 * This is the RED phase - tests FAIL because sanitizeString currently escapes HTML
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask } from '../../src/tools/tasks/crud';
import type { MockVikunjaClient } from '../types/mocks';

// Mock the client module
jest.mock('../../src/client', () => ({
  getClientFromContext: jest.fn(),
}));

// Mock logger to suppress output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('createTask HTML description passthrough', () => {
  let mockClient: MockVikunjaClient;
  const { getClientFromContext } = require('../../src/client');

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock client with all required methods
    mockClient = {
      tasks: {
        createTask: jest.fn(),
        getTask: jest.fn(),
        updateTask: jest.fn(),
        deleteTask: jest.fn(),
        updateTaskLabels: jest.fn(),
        bulkAssignUsersToTask: jest.fn(),
        removeUserFromTask: jest.fn(),
      },
    } as any;

    getClientFromContext.mockResolvedValue(mockClient);
  });

  it('should pass through HTML with tags like <p>, <strong>, <em> unchanged', async () => {
    const htmlDescription = '<p><strong>Bold</strong> and <em>italic</em></p>';
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      description: htmlDescription,
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: htmlDescription,
    });

    // Verify createTask was called with the HTML description UNCHANGED
    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: htmlDescription,
      })
    );
  });

  it('should pass through HTML with heading and paragraph tags unchanged', async () => {
    const htmlDescription = '<h2>Title</h2><p>Content</p>';
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      description: htmlDescription,
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: htmlDescription,
    });

    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: htmlDescription,
      })
    );
  });

  it('should pass through HTML with list tags unchanged', async () => {
    const htmlDescription = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      description: htmlDescription,
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: htmlDescription,
    });

    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: htmlDescription,
      })
    );
  });

  it('should pass through empty string description unchanged', async () => {
    const htmlDescription = '';
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      description: htmlDescription,
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: htmlDescription,
    });

    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: htmlDescription,
      })
    );
  });

  it('should handle undefined description (not passed to createTask)', async () => {
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: undefined,
    });

    // Verify createTask was called without description field
    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.not.objectContaining({
        description: expect.anything(),
      })
    );
  });

  it('should pass through HTML with HTML entities like &gt; unchanged', async () => {
    const htmlDescription = '<p>5 &gt; 3</p>';
    const mockCreatedTask = {
      id: 1,
      title: 'Test Task',
      description: htmlDescription,
      project_id: 1,
      done: false,
      priority: 1,
    };

    mockClient.tasks.createTask.mockResolvedValue(mockCreatedTask);
    mockClient.tasks.getTask.mockResolvedValue(mockCreatedTask);

    await createTask({
      projectId: 1,
      title: 'Test Task',
      description: htmlDescription,
    });

    expect(mockClient.tasks.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: htmlDescription,
      })
    );
  });
});
