import { createSuccessResponse, formatMcpResponse } from '../../../types';
import type { Activity } from '../../../types/vikunja';

function formatActivityData(data: Activity['data'] | null | undefined): string {
  if (data === null || data === undefined) {
    return 'No activity data';
  }

  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return 'No activity data';
  }

  const keyValueString = entries
    .map(([key, value]) => `${key}=${typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`)
    .join(', ');

  return `${keyValueString} | JSON: ${JSON.stringify(data)}`;
}

function formatActivitySummary(activity: Activity, index: number): string {
  const identifier = activity.id ?? index + 1;
  const parts = [`${index + 1}. Activity #${identifier}`];

  if (activity.type !== undefined) {
    parts.push(`Type: ${activity.type}`);
  }

  if (activity.user_id !== undefined) {
    parts.push(`User: ${activity.user_id}`);
  }

  parts.push(`Task: ${activity.task_id}`);

  if (activity.created) {
    parts.push(`Created: ${activity.created}`);
  }

  parts.push(`Data: ${formatActivityData(activity.data)}`);

  return parts.join(' | ');
}

export class ActivityResponseFormatter {
  formatActivities(activities: Activity[]): { content: Array<{ type: 'text'; text: string }> } {
    const response = createSuccessResponse(
      'list',
      activities.length === 0
        ? 'No activity found for this task'
        : `Found ${activities.length} activity entr${activities.length === 1 ? 'y' : 'ies'}`,
      activities.length === 0
        ? undefined
        : {
            summary: activities
              .map((activity, index) => formatActivitySummary(activity, index))
              .join('\n'),
          },
      {
        timestamp: new Date().toISOString(),
        count: activities.length,
      },
    );

    return {
      content: formatMcpResponse(response),
    };
  }
}
