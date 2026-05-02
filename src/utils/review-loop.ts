import type { ParsedTask } from './plan-parser';

export interface ReviewResult {
  passed: boolean;
  gate: 'lsp' | 'acceptance' | 'none';
  errors: string[];
  feedback: string;
  attemptNumber: number;
  maxAttempts: number;
}

export interface ReviewConfig {
  maxRetries: number;
  taskTimeoutMs: number;
  lspChecker: 'auto' | 'tsc' | 'biome' | 'both';
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  maxRetries: 3,
  taskTimeoutMs: 300_000,
  lspChecker: 'auto',
};

export function createReviewResult(
  passed: boolean,
  gate: ReviewResult['gate'],
  errors: string[] = [],
  feedback = '',
  attemptNumber = 1,
  maxAttempts = 3,
): ReviewResult {
  return {
    passed,
    gate,
    errors,
    feedback,
    attemptNumber,
    maxAttempts,
  };
}

export function formatLspFeedback(errors: string[]): string {
  if (errors.length === 0) return '';
  const lines = [
    'LSP syntax check FAILED. The following errors must be fixed:',
  ];
  for (const err of errors) {
    lines.push(`- ${err}`);
  }
  lines.push('');
  lines.push('Fix these syntax/type errors and resubmit.');
  return lines.join('\n');
}

export function formatAcceptanceFeedback(
  task: ParsedTask,
  failedCriteria: string[],
): string {
  const lines = [
    `Acceptance criteria verification FAILED for task "${task.title}".`,
  ];
  lines.push('');
  lines.push('The following criteria were NOT met:');
  for (const criterion of failedCriteria) {
    lines.push(`- ❌ ${criterion}`);
  }
  lines.push('');
  lines.push('All acceptance criteria for this task:');
  for (const criterion of task.acceptanceCriteria) {
    const failed = failedCriteria.includes(criterion);
    lines.push(`- ${failed ? '❌' : '✅'} ${criterion}`);
  }
  lines.push('');
  lines.push(
    'Address the failed criteria and resubmit. Do NOT modify code that already passes its criteria.',
  );
  return lines.join('\n');
}

export function shouldRetry(
  attemptNumber: number,
  maxRetries: number,
): boolean {
  return attemptNumber < maxRetries;
}

export function formatRetryGuidance(
  task: ParsedTask,
  result: ReviewResult,
): string {
  const lines: string[] = [];
  lines.push(
    `Task "${task.title}" review failed at gate "${result.gate}" (attempt ${result.attemptNumber}/${result.maxAttempts}).`,
  );

  if (shouldRetry(result.attemptNumber, result.maxAttempts)) {
    lines.push('');
    lines.push('**Feedback to address:**');
    lines.push(result.feedback);
    lines.push('');
    lines.push(
      `You have ${result.maxAttempts - result.attemptNumber} retry attempt(s) remaining.`,
    );
  } else {
    lines.push('');
    lines.push('**Maximum retry attempts reached.**');
    lines.push('This task requires human intervention.');
    lines.push('');
    lines.push('Last feedback:');
    lines.push(result.feedback);
  }

  return lines.join('\n');
}

export function formatApprovalMessage(task: ParsedTask): string {
  return `Task "${task.title}" PASSED all review gates. Approved for merge.`;
}
