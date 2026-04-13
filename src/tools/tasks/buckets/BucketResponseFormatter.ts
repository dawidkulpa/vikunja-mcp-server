import type { Bucket, BucketWithTasks, ProjectView, Task } from '../../../types/vikunja';
import { createSuccessResponse, formatMcpResponse } from '../../../types';

function getTaskPosition(task: Task): number | undefined {
  const candidate = (task as unknown as Record<string, unknown>).position;
  return typeof candidate === 'number' ? candidate : undefined;
}

function truncateDescription(description: string): string {
  return description.length <= 100 ? description : `${description.slice(0, 100)}...`;
}

function formatBucketTaskSummary(task: Task, index: number): string {
  const position = getTaskPosition(task);
  return `${index + 1}. Task #${task.id ?? 'unknown'} — ${task.title} (position: ${position ?? 'n/a'})`;
}

function formatDetailedTask(task: Task, index: number): string {
  const lines = [`${index + 1}. Task #${task.id ?? 'unknown'} — ${task.title}`];
  const position = getTaskPosition(task);

  if (position !== undefined) {
    lines.push(`- Position: ${position}`);
  }

  if (task.created) {
    lines.push(`- Created: ${task.created}`);
  }

  if (task.description) {
    lines.push(`- Description: ${truncateDescription(task.description)}`);
  }

  return lines.join('\n');
}

function getBucketTasks(bucket: BucketWithTasks): Task[] {
  return bucket.tasks ?? [];
}

export class BucketResponseFormatter {
  formatViews(views: ProjectView[]): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'list',
      `Found ${views.length} view(s)`,
      {
        views,
      },
      {
        timestamp: new Date().toISOString(),
        count: views.length,
      },
    );

    return {
      content: formatMcpResponse(response),
    };
  }

  formatBuckets(buckets: Bucket[]): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'list',
      `Found ${buckets.length} bucket(s)`,
      {
        buckets,
      },
      {
        timestamp: new Date().toISOString(),
        count: buckets.length,
      },
    );

    return {
      content: formatMcpResponse(response),
    };
  }

  formatBucketTasks(
    buckets: BucketWithTasks[],
    bucketId?: number,
  ): { content: Array<{ type: 'text'; text: string }> } {
    if (bucketId !== undefined) {
      const bucket = buckets.find((item) => item.id === bucketId);
      const tasks = bucket ? getBucketTasks(bucket) : [];
      const message = bucket
        ? `Found ${tasks.length} task(s) in bucket ${bucket.title}`
        : `No bucket found with ID ${bucketId}`;
      const summary = bucket
        ? [
            `### Bucket: ${bucket.title} (ID: ${bucket.id ?? bucketId})`,
            `- Position: ${bucket.position}`,
            `- Task count: ${bucket.count}`,
            tasks.length > 0
              ? tasks.map((task, index) => formatDetailedTask(task, index)).join('\n')
              : '- No tasks in this bucket',
          ].join('\n')
        : undefined;

      const response = createSuccessResponse(
        'list',
        message,
        summary ? { summary } : undefined,
        {
          timestamp: new Date().toISOString(),
          count: tasks.length,
          bucketId,
        },
      );

      return {
        content: formatMcpResponse(response),
      };
    }

    const summary = buckets.length > 0
      ? buckets.map((bucket) => {
          const tasks = getBucketTasks(bucket);

          return [
            `### Bucket: ${bucket.title} (ID: ${bucket.id ?? 'unknown'})`,
            `- Position: ${bucket.position}`,
            `- Task count: ${bucket.count}`,
            tasks.length > 0
              ? tasks.map((task, index) => formatBucketTaskSummary(task, index)).join('\n')
              : '- No tasks in this bucket',
          ].join('\n');
        }).join('\n\n')
      : 'No buckets found';

    const response = createSuccessResponse(
      'list',
      `Found ${buckets.length} bucket(s) with task summaries`,
      {
        summary,
      },
      {
        timestamp: new Date().toISOString(),
        count: buckets.length,
      },
    );

    return {
      content: formatMcpResponse(response),
    };
  }
}
