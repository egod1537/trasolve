import { Intent } from '@blueprintjs/core';

export interface Feedback {
  intent: Intent;
  message: string;
}

export function formatSchemaIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
