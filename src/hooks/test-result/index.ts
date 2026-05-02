import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../../config';
import {
  markIssueResolved,
  markVerificationFailed,
  readFixHistory,
} from '../../tools/fix-history/parser';
import { log } from '../../utils/logger';

const execFileAsync = promisify(execFile);

const TEST_RESULT_COMMAND = 'test_result';

async function _getGitCommitHash(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      timeout: 5_000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function gitRollback(
  projectRoot: string,
  commitHash: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFileAsync('git', ['reset', '--hard', commitHash], {
      cwd: projectRoot,
      timeout: 10_000,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

async function findPreBuildCommit(projectRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '--oneline', '-20'], {
      cwd: projectRoot,
      timeout: 5_000,
    });
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (
        line.toLowerCase().includes('super_build') ||
        line.toLowerCase().includes('super_build:')
      ) {
        const hash = line.split(/\s/)[0];
        if (hash) {
          try {
            const { stdout: parentHash } = await execFileAsync(
              'git',
              ['rev-parse', `${hash}^`],
              { cwd: projectRoot, timeout: 5_000 },
            );
            return parentHash.trim();
          } catch {}
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function createTestResultCommand(
  _ctx: PluginInput,
  _config?: PluginConfig,
) {
  return {
    handleCommandExecuteBefore: async (
      input: {
        command: string;
        sessionID: string;
        arguments: string;
      },
      output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      if (input.command !== TEST_RESULT_COMMAND) return;

      const args = input.arguments.trim().toLowerCase();
      const projectRoot = process.cwd();

      log('[test-result] /test_result command invoked', {
        sessionID: input.sessionID,
        args,
      });

      if (!args || (args !== 'pass' && args !== 'fail')) {
        output.parts = [
          {
            type: 'text',
            text: [
              'Usage: /test_result <pass|fail> [description]',
              '',
              '  /test_result pass          — Mark the fix as verified and resolved',
              '  /test_result fail [reason] — Mark the fix as failed, rollback code, and re-trigger @super_plan',
              '',
              'Examples:',
              '  /test_result pass',
              '  /test_result fail Token still expires after 5 minutes',
            ].join('\n'),
          },
        ];
        return;
      }

      const doc = readFixHistory(projectRoot);
      if (!doc) {
        output.parts = [
          {
            type: 'text',
            text: 'No fix history found. There is nothing to verify.',
          },
        ];
        return;
      }

      const pendingEntries = doc.entries.filter(
        (e) => e.currentStatus === 'pending_verification',
      );

      if (pendingEntries.length === 0) {
        output.parts = [
          {
            type: 'text',
            text: 'No pending verification entries found in fix history. All issues are either resolved or not yet attempted.',
          },
        ];
        return;
      }

      const entry = pendingEntries[0];

      if (args === 'pass') {
        markIssueResolved(
          projectRoot,
          entry.issue,
          entry.affectedPaths,
          entry.issueId,
        );

        output.parts = [
          {
            type: 'text',
            text: [
              '✅ Fix verified and marked as RESOLVED!',
              '',
              `Issue: "${entry.issue}"`,
              `Total attempts: ${entry.totalAttempts}`,
              '',
              'The fix history has been updated. The code map will be updated on the next @super_plan run.',
            ].join('\n'),
          },
        ];
      } else {
        const failReason =
          input.arguments.trim().slice(4).trim() ||
          'User reported the fix did not resolve the issue';

        markVerificationFailed(
          projectRoot,
          entry.issue,
          failReason,
          entry.affectedPaths,
          entry.issueId,
        );

        const preBuildCommit = await findPreBuildCommit(projectRoot);
        let rollbackResult = '';

        if (preBuildCommit) {
          const rollback = await gitRollback(projectRoot, preBuildCommit);
          if (rollback.success) {
            rollbackResult = [
              '',
              '🔄 Code has been rolled back to the state before the last build attempt.',
              `Rollback commit: ${preBuildCommit.slice(0, 8)}`,
            ].join('\n');
          } else {
            rollbackResult = [
              '',
              '⚠️ Automatic rollback failed. Please manually rollback with:',
              `  git reset --hard ${preBuildCommit.slice(0, 8)}`,
              `Error: ${rollback.error}`,
            ].join('\n');
          }
        } else {
          rollbackResult = [
            '',
            '⚠️ Could not find a pre-build commit to rollback to.',
            'You may need to manually revert the changes using git.',
          ].join('\n');
        }

        output.parts = [
          {
            type: 'text',
            text: [
              '❌ Fix verification FAILED.',
              '',
              `Issue: "${entry.issue}"`,
              `Failure reason: ${failReason}`,
              `Total attempts so far: ${entry.totalAttempts}`,
              '',
              'Fix history has been updated with this failure.',
              rollbackResult,
              '',
              '---',
              '',
              '🔄 To retry with a new approach, run:',
              '  /clear_context',
              '  @super_plan [re-describe the issue]',
              '',
              '@super_plan will see the previous failed attempts and try a different strategy.',
            ].join('\n'),
          },
        ];
      }
    },
  };
}
