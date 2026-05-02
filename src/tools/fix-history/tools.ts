import {
  type PluginInput,
  type ToolDefinition,
  tool,
} from '@opencode-ai/plugin';
import {
  addFixAttempt,
  getRecentFailures,
  getRecurringIssues,
  markIssueResolved,
  readFixHistory,
} from './parser';

const z = tool.schema;

export function createFixHistoryTools(
  _ctx: PluginInput,
): Record<string, ToolDefinition> {
  const read_fix_history = tool({
    description:
      'Read the fix attempt history for this project. Returns all previous fix attempts, ' +
      'including what was tried, what failed, and why. Used by @super_plan to avoid repeating failed approaches.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      filter: z
        .enum(['all', 'open', 'recurring', 'resolved'])
        .optional()
        .describe(
          'Filter entries by status. "open" = still failing, "recurring" = failed multiple times, "resolved" = successfully fixed.',
        ),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();
      const filter = args.filter ?? 'all';

      if (filter === 'recurring') {
        const recurring = getRecurringIssues(root);
        if (recurring.length === 0) {
          return 'No recurring issues found.';
        }
        return JSON.stringify(recurring, null, 2);
      }

      if (filter === 'open') {
        const open = getRecentFailures(root);
        if (open.length === 0) {
          return 'No open issues found.';
        }
        return JSON.stringify(open, null, 2);
      }

      const doc = readFixHistory(root);
      if (!doc) {
        return 'No fix history found. This is the first attempt for this project.';
      }

      if (filter === 'resolved') {
        const resolved = doc.entries.filter(
          (e) => e.currentStatus === 'resolved',
        );
        return JSON.stringify(resolved, null, 2);
      }

      return JSON.stringify(doc, null, 2);
    },
  });

  const record_fix_attempt = tool({
    description:
      'Record a fix attempt in the project history. Called by @super_build after each task review cycle. ' +
      'Tracks what approach was tried, whether it succeeded or failed, and why. ' +
      'This information is used by @super_plan on subsequent attempts to avoid repeating failed approaches.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      issue: z
        .string()
        .describe('Description of the issue or bug being addressed'),
      approach: z.string().describe('What approach was taken to fix the issue'),
      targetFiles: z
        .array(z.string())
        .describe('Files that were modified in this attempt'),
      result: z
        .enum(['success', 'failed', 'partial'])
        .describe('Outcome of this fix attempt'),
      failureReason: z
        .string()
        .optional()
        .describe('If failed, why did it fail?'),
      reviewFeedback: z
        .string()
        .optional()
        .describe('Feedback from the review gate (LSP or acceptance criteria)'),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();

      addFixAttempt(root, args.issue, {
        issue: args.issue,
        approach: args.approach,
        targetFiles: args.targetFiles,
        result: args.result,
        failureReason: args.failureReason,
        reviewFeedback: args.reviewFeedback,
      });

      return `Fix attempt recorded: ${args.result} for "${args.issue}". ${args.result === 'failed' ? 'This information will help avoid repeating the same approach.' : ''}`;
    },
  });

  const resolve_issue = tool({
    description:
      'Mark an issue as resolved in the fix history. Called by @super_build when all tasks pass review.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      issue: z
        .string()
        .describe('Description of the issue to mark as resolved'),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();
      markIssueResolved(root, args.issue);
      return `Issue marked as resolved: "${args.issue}"`;
    },
  });

  return { read_fix_history, record_fix_attempt, resolve_issue };
}
