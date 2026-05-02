import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  type PluginInput,
  type ToolDefinition,
  tool,
} from '@opencode-ai/plugin';

const execFileAsync = promisify(execFile);

const z = tool.schema;

async function runTscCheck(
  projectRoot: string,
  files: string[],
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const args = ['--noEmit', '--pretty', 'false', ...files];
    await execFileAsync('npx', ['tsc', ...args], {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return { success: true, errors: [] };
  } catch (err) {
    const output =
      err instanceof Error && 'stderr' in err
        ? (err as { stderr: string }).stderr
        : String(err);

    const lines = output.split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      if (line.includes('error TS')) {
        errors.push(line.trim());
      }
    }

    return { success: errors.length === 0, errors };
  }
}

async function runBiomeCheck(
  projectRoot: string,
  files: string[],
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const args = ['check', '--no-errors-on-unmatched', ...files];
    await execFileAsync('npx', ['biome', ...args], {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return { success: true, errors: [] };
  } catch (err) {
    const output =
      err instanceof Error && 'stdout' in err
        ? (err as { stdout: string }).stdout
        : String(err);

    const lines = output.split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
      if (
        line.includes('error') ||
        line.includes('Error') ||
        line.includes('FAILED')
      ) {
        errors.push(line.trim());
      }
    }

    return { success: errors.length === 0, errors };
  }
}

export function createLspTools(
  _ctx: PluginInput,
): Record<string, ToolDefinition> {
  const lsp_check = tool({
    description:
      'Run syntax and type checking on specified files. Attempts OpenCode LSP diagnostics first, ' +
      'then falls back to tsc --noEmit and biome check for comprehensive validation. ' +
      'Used by @super_build as Gate 1 of the dual-review pipeline.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      files: z
        .array(z.string())
        .describe('List of file paths (relative to project root) to check'),
      checker: z
        .enum(['auto', 'tsc', 'biome', 'both'])
        .optional()
        .describe(
          'Which checker to use. "auto" tries both tsc and biome, "both" runs both, or specify one.',
        ),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();
      const checker = args.checker ?? 'auto';
      const absoluteFiles = args.files.map((f) =>
        path.isAbsolute(f) ? f : path.join(root, f),
      );

      const allErrors: string[] = [];
      const results: string[] = [];

      if (checker === 'auto' || checker === 'both' || checker === 'tsc') {
        const tscResult = await runTscCheck(root, absoluteFiles);
        if (tscResult.success) {
          results.push('tsc: PASSED');
        } else {
          results.push(`tsc: FAILED (${tscResult.errors.length} errors)`);
          allErrors.push(...tscResult.errors);
        }
      }

      if (checker === 'auto' || checker === 'both' || checker === 'biome') {
        const biomeResult = await runBiomeCheck(root, absoluteFiles);
        if (biomeResult.success) {
          results.push('biome: PASSED');
        } else {
          results.push(`biome: FAILED (${biomeResult.errors.length} errors)`);
          allErrors.push(...biomeResult.errors);
        }
      }

      if (allErrors.length === 0) {
        return `LSP check PASSED for ${args.files.length} file(s). ${results.join(', ')}`;
      }

      return `LSP check FAILED for ${args.files.length} file(s). ${results.join(', ')}\n\nErrors:\n${allErrors.join('\n')}`;
    },
  });

  return { lsp_check };
}
