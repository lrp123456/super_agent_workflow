import * as path from 'node:path';
import {
  type PluginInput,
  type ToolDefinition,
  tool,
} from '@opencode-ai/plugin';
import {
  codemapExists,
  codemapToMarkdown,
  readCodemapJson,
  writeCodemapJson,
  writeCodemapMd,
} from './parser';
import {
  CODEMAP_VERSION,
  type CodeMapEntry,
  type CodeMapFile,
  type CodeMapModule,
} from './types';

const z = tool.schema;

export function createCodemapTools(
  _ctx: PluginInput,
): Record<string, ToolDefinition> {
  const read_codemap = tool({
    description:
      'Read the project code map (codemap). Returns the structured code map if it exists, ' +
      'including modules, files, exports, and dependencies. Returns null if no code map exists.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();
      if (!codemapExists(root)) {
        return 'No code map found. Use the update_codemap tool to generate one.';
      }

      const entry = readCodemapJson(root);
      if (!entry) {
        return 'Code map file exists but is invalid. Use update_codemap to regenerate.';
      }

      return JSON.stringify(entry, null, 2);
    },
  });

  const update_codemap = tool({
    description:
      'Create or update the project code map. Accepts a JSON description of the project structure ' +
      'and writes both codemap.json (machine-readable) and codemap.md (human-readable). ' +
      'This tool should be called by @explorer or @super_plan after scanning the codebase.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      summary: z
        .string()
        .describe('A brief summary of the project purpose and architecture.'),
      modules: z
        .array(
          z.object({
            name: z.string().describe('Module name'),
            path: z
              .string()
              .describe('Module directory path relative to project root'),
            description: z.string().describe('What this module does'),
            files: z
              .array(
                z.object({
                  path: z
                    .string()
                    .describe('File path relative to project root'),
                  description: z.string().describe('What this file does'),
                  exports: z
                    .array(z.string())
                    .optional()
                    .describe('Key exports from this file'),
                  dependencies: z
                    .array(z.string())
                    .optional()
                    .describe('Key dependencies of this file'),
                }),
              )
              .describe('Files in this module'),
            submodules: z
              .array(z.lazy(() => z.any()))
              .optional()
              .describe('Nested submodules with the same structure'),
          }),
        )
        .describe('Top-level modules in the project'),
      namingConventions: z
        .string()
        .optional()
        .describe('Naming conventions used in the project'),
      directoryStructure: z
        .string()
        .optional()
        .describe('Directory structure pattern'),
      entryPoints: z.array(z.string()).optional().describe('Entry point files'),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();

      const existingEntry = readCodemapJson(root);
      const now = new Date().toISOString();

      function parseModules(
        rawModules: Array<Record<string, unknown>>,
      ): CodeMapModule[] {
        return rawModules.map((mod) => ({
          name: String(mod.name),
          path: String(mod.path),
          description: String(mod.description),
          files:
            (mod.files as Array<Record<string, unknown>>)?.map(
              (f): CodeMapFile => ({
                path: String(f.path),
                description: String(f.description),
                exports: Array.isArray(f.exports)
                  ? f.exports.map(String)
                  : undefined,
                dependencies: Array.isArray(f.dependencies)
                  ? f.dependencies.map(String)
                  : undefined,
              }),
            ) ?? [],
          submodules: Array.isArray(mod.submodules)
            ? parseModules(mod.submodules as Array<Record<string, unknown>>)
            : undefined,
        }));
      }

      const entry: CodeMapEntry = {
        version: CODEMAP_VERSION,
        generatedAt: now,
        projectRoot: path.basename(root),
        summary: args.summary,
        modules: parseModules(
          args.modules as unknown as Array<Record<string, unknown>>,
        ),
        keyPatterns: {
          namingConventions: args.namingConventions,
          directoryStructure: args.directoryStructure,
          entryPoints: args.entryPoints,
        },
      };

      if (existingEntry) {
        entry.keyPatterns = {
          ...existingEntry.keyPatterns,
          ...entry.keyPatterns,
        };
      }

      writeCodemapJson(root, entry);

      const mdContent = codemapToMarkdown(entry);
      writeCodemapMd(root, mdContent);

      const moduleCount = entry.modules.length;
      const fileCount = entry.modules.reduce(
        (acc, m) => acc + m.files.length,
        0,
      );
      return `Code map updated: ${moduleCount} modules, ${fileCount} files. Both codemap.json and codemap.md saved.`;
    },
  });

  return { read_codemap, update_codemap };
}
