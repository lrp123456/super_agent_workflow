import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type PluginInput,
  type ToolDefinition,
  tool,
} from '@opencode-ai/plugin';
import {
  PLAN_DIR,
  PLAN_JSON_FILE,
  PLAN_MD_FILE,
  PLAN_VERSION,
  type PlanContext,
  type PlanDocument,
  type PlanTask,
} from '../codemap/types';

const z = tool.schema;

function planToMarkdown(doc: PlanDocument): string {
  const lines: string[] = [];
  lines.push(`# Project Plan: ${doc.context.goal}`);
  lines.push('');
  lines.push(`**Generated**: ${doc.generatedAt}`);
  lines.push(`**Version**: ${doc.version}`);
  lines.push('');

  lines.push('## 1. Architecture Context');
  lines.push(`- **Goal**: ${doc.context.goal}`);
  lines.push(
    `- **Core Dependencies**: ${doc.context.coreDependencies.join(', ')}`,
  );
  if (doc.context.constraints?.length) {
    lines.push(`- **Constraints**: ${doc.context.constraints.join(', ')}`);
  }
  lines.push('');

  lines.push('## 2. Task Execution List');
  for (const task of doc.tasks) {
    lines.push(`### [Task ${task.id}] ${task.title}`);
    lines.push(
      `- **Target Files**: ${task.targetFiles.map((f: string) => `\`${f}\``).join(', ')}`,
    );
    lines.push('- **Execution Instructions**:');
    for (const inst of task.instructions) {
      lines.push(`  ${inst}`);
    }
    lines.push('- **Acceptance Criteria**:');
    for (const criterion of task.acceptanceCriteria) {
      lines.push(`  - [ ] ${criterion}`);
    }
    if (task.dependencies?.length) {
      lines.push(
        `- **Dependencies**: Task ${task.dependencies.join(', Task ')}`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function createPlanTools(
  _ctx: PluginInput,
): Record<string, ToolDefinition> {
  const generate_plan = tool({
    description:
      'Generate a structured execution plan in both human-readable (final_plan.md) and machine-readable (final_plan.json) formats. ' +
      'Called by @super_plan after requirement analysis and clarification.',
    args: {
      projectRoot: z
        .string()
        .optional()
        .describe(
          'Absolute path to the project root. Defaults to the current working directory.',
        ),
      goal: z.string().describe('The overall goal of this plan'),
      coreDependencies: z
        .array(z.string())
        .describe('Key libraries, tools, or modules involved'),
      constraints: z
        .array(z.string())
        .optional()
        .describe('Any constraints or requirements'),
      tasks: z
        .array(
          z.object({
            id: z.string().describe('Unique task identifier (e.g., "1", "2")'),
            title: z.string().describe('Task title'),
            targetFiles: z
              .array(z.string())
              .describe('Files this task will modify or create'),
            instructions: z
              .array(z.string())
              .describe('Step-by-step instructions for this task'),
            acceptanceCriteria: z
              .array(z.string())
              .describe('Measurable criteria to verify task completion'),
            dependencies: z
              .array(z.string())
              .optional()
              .describe('IDs of tasks that must complete before this one'),
          }),
        )
        .describe('Ordered list of tasks to execute'),
    },
    async execute(args) {
      const root = args.projectRoot ?? process.cwd();
      const now = new Date().toISOString();

      const context: PlanContext = {
        goal: args.goal,
        coreDependencies: args.coreDependencies,
        constraints: args.constraints,
      };

      const tasks: PlanTask[] = args.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        targetFiles: t.targetFiles,
        instructions: t.instructions,
        acceptanceCriteria: t.acceptanceCriteria,
        dependencies: t.dependencies,
      }));

      const doc: PlanDocument = {
        version: PLAN_VERSION,
        generatedAt: now,
        context,
        tasks,
      };

      const planDir = path.join(root, PLAN_DIR);
      if (!fs.existsSync(planDir)) {
        fs.mkdirSync(planDir, { recursive: true });
      }

      const jsonPath = path.join(planDir, PLAN_JSON_FILE);
      fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf-8');

      const mdContent = planToMarkdown(doc);
      const mdPath = path.join(root, PLAN_MD_FILE);
      fs.writeFileSync(mdPath, mdContent, 'utf-8');

      return `Plan generated: ${tasks.length} tasks. Files saved: ${PLAN_MD_FILE} and ${PLAN_DIR}/${PLAN_JSON_FILE}`;
    },
  });

  const read_plan = tool({
    description:
      'Read the approved execution plan (final_plan.json). Returns the structured plan if it exists, ' +
      'including tasks, dependencies, and acceptance criteria.',
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
      const jsonPath = path.join(root, PLAN_DIR, PLAN_JSON_FILE);

      if (!fs.existsSync(jsonPath)) {
        return 'No plan found. Use @super_plan to generate one first.';
      }

      try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(content) as PlanDocument;
        if (!parsed.version || !parsed.tasks) {
          return 'Plan file exists but is invalid. Regenerate with @super_plan.';
        }
        return JSON.stringify(parsed, null, 2);
      } catch {
        return 'Failed to read plan file. Regenerate with @super_plan.';
      }
    },
  });

  return { generate_plan, read_plan };
}
