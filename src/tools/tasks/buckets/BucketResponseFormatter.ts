import type { Bucket, ProjectView } from '../../../types/vikunja';
import { createSuccessResponse, formatMcpResponse } from '../../../types';

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
}
