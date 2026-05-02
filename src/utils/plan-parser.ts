import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PLAN_DIR,
  PLAN_JSON_FILE,
  type PlanDocument,
  type PlanTask,
} from '../tools/codemap/types';

export interface ParsedPlan {
  document: PlanDocument;
  tasks: ParsedTask[];
}

export interface ParsedTask extends PlanTask {
  status: 'pending' | 'in_progress' | 'reviewing' | 'approved' | 'failed';
  attemptCount: number;
  modifiedFiles: string[];
}

export function parsePlanFile(projectRoot: string): ParsedPlan | null {
  const jsonPath = path.join(projectRoot, PLAN_DIR, PLAN_JSON_FILE);

  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const doc = JSON.parse(content) as PlanDocument;

    if (!doc.version || !doc.tasks || !Array.isArray(doc.tasks)) {
      return null;
    }

    const tasks: ParsedTask[] = doc.tasks.map((task) => ({
      ...task,
      status: 'pending',
      attemptCount: 0,
      modifiedFiles: [],
    }));

    return { document: doc, tasks };
  } catch {
    return null;
  }
}

export function getTaskById(
  plan: ParsedPlan,
  taskId: string,
): ParsedTask | undefined {
  return plan.tasks.find((t) => t.id === taskId);
}

export function getPendingTasks(plan: ParsedPlan): ParsedTask[] {
  return plan.tasks.filter((t) => t.status === 'pending');
}

export function getReadyTasks(plan: ParsedPlan): ParsedTask[] {
  return plan.tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    if (!t.dependencies || t.dependencies.length === 0) return true;
    return t.dependencies.every((depId) => {
      const dep = getTaskById(plan, depId);
      return dep?.status === 'approved';
    });
  });
}

export function getTasksByFile(
  plan: ParsedPlan,
  filePath: string,
): ParsedTask[] {
  return plan.tasks.filter((t) =>
    t.targetFiles.some((f) => f === filePath || filePath.startsWith(f)),
  );
}

export function getAllTargetFiles(plan: ParsedPlan): string[] {
  const files = new Set<string>();
  for (const task of plan.tasks) {
    for (const f of task.targetFiles) {
      files.add(f);
    }
  }
  return [...files];
}

export function updateTaskStatus(
  plan: ParsedPlan,
  taskId: string,
  status: ParsedTask['status'],
  extra?: Partial<Pick<ParsedTask, 'attemptCount' | 'modifiedFiles'>>,
): void {
  const task = getTaskById(plan, taskId);
  if (!task) return;
  task.status = status;
  if (extra?.attemptCount !== undefined) {
    task.attemptCount = extra.attemptCount;
  }
  if (extra?.modifiedFiles) {
    task.modifiedFiles = extra.modifiedFiles;
  }
}

export function isPlanComplete(plan: ParsedPlan): boolean {
  return plan.tasks.every(
    (t) => t.status === 'approved' || t.status === 'failed',
  );
}

export function getPlanSummary(plan: ParsedPlan): string {
  const total = plan.tasks.length;
  const approved = plan.tasks.filter((t) => t.status === 'approved').length;
  const failed = plan.tasks.filter((t) => t.status === 'failed').length;
  const pending = plan.tasks.filter((t) => t.status === 'pending').length;
  const inProgress = plan.tasks.filter(
    (t) => t.status === 'in_progress',
  ).length;
  const reviewing = plan.tasks.filter((t) => t.status === 'reviewing').length;

  return [
    `Total: ${total}`,
    `Approved: ${approved}`,
    `Failed: ${failed}`,
    `Pending: ${pending}`,
    `In Progress: ${inProgress}`,
    `Reviewing: ${reviewing}`,
  ].join(' | ');
}
