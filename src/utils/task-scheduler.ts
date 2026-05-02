import {
  getReadyTasks,
  getTaskById,
  type ParsedPlan,
  type ParsedTask,
} from './plan-parser';

export interface TaskBatch {
  batchId: number;
  tasks: ParsedTask[];
  reason: string;
}

export interface FileConflict {
  filePath: string;
  taskIds: string[];
  resolution: 'parallel_safe' | 'sequential_required' | 'manual_review';
}

export interface ScheduleResult {
  batches: TaskBatch[];
  conflicts: FileConflict[];
  totalBatches: number;
  estimatedParallelism: number;
}

export function buildTaskSchedule(plan: ParsedPlan): ScheduleResult {
  const fileTaskMap = buildFileTaskMap(plan);
  const conflicts = detectConflicts(plan, fileTaskMap);
  const conflictFiles = new Set(
    conflicts
      .filter((c) => c.resolution === 'sequential_required')
      .map((c) => c.filePath),
  );

  const batches: TaskBatch[] = [];
  let batchIndex = 0;
  const scheduled = new Set<string>();

  while (scheduled.size < plan.tasks.length) {
    const ready = getReadyTasks(plan).filter((t) => !scheduled.has(t.id));

    if (ready.length === 0) {
      const remaining = plan.tasks.filter((t) => !scheduled.has(t.id));
      if (remaining.length > 0) {
        batches.push({
          batchId: batchIndex++,
          tasks: remaining,
          reason:
            'Remaining tasks could not be scheduled (possible circular dependency)',
        });
        for (const t of remaining) {
          scheduled.add(t.id);
        }
      }
      break;
    }

    const parallelSafe = filterParallelSafe(ready, conflictFiles);
    const batch: TaskBatch = {
      batchId: batchIndex,
      tasks: parallelSafe,
      reason:
        parallelSafe.length === ready.length
          ? `All ${ready.length} ready tasks can run in parallel`
          : `${parallelSafe.length} of ${ready.length} ready tasks are parallel-safe (conflicts resolved sequentially)`,
    };

    batches.push(batch);
    for (const t of parallelSafe) {
      scheduled.add(t.id);
    }
    batchIndex++;
  }

  const maxBatchSize = Math.max(...batches.map((b) => b.tasks.length), 1);

  return {
    batches,
    conflicts,
    totalBatches: batches.length,
    estimatedParallelism: maxBatchSize,
  };
}

function buildFileTaskMap(plan: ParsedPlan): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const task of plan.tasks) {
    for (const file of task.targetFiles) {
      const existing = map.get(file) ?? [];
      existing.push(task.id);
      map.set(file, existing);
    }
  }
  return map;
}

function detectConflicts(
  plan: ParsedPlan,
  fileTaskMap: Map<string, string[]>,
): FileConflict[] {
  const conflicts: FileConflict[] = [];

  for (const [filePath, taskIds] of fileTaskMap) {
    if (taskIds.length <= 1) continue;

    const tasks = taskIds
      .map((id) => getTaskById(plan, id))
      .filter((t): t is ParsedTask => t !== undefined);

    const hasDependency = tasks.some((t) =>
      t.dependencies?.some((depId) => taskIds.includes(depId)),
    );

    const allSameDirectory = tasks.every((t) =>
      t.targetFiles.every((f) => {
        const dir = f.split('/').slice(0, -1).join('/');
        return filePath.split('/').slice(0, -1).join('/') === dir;
      }),
    );

    let resolution: FileConflict['resolution'];
    if (hasDependency) {
      resolution = 'sequential_required';
    } else if (allSameDirectory && taskIds.length <= 2) {
      resolution = 'parallel_safe';
    } else {
      resolution = 'sequential_required';
    }

    conflicts.push({ filePath, taskIds, resolution });
  }

  return conflicts;
}

function filterParallelSafe(
  tasks: ParsedTask[],
  conflictFiles: Set<string>,
): ParsedTask[] {
  if (conflictFiles.size === 0) return tasks;

  const safe: ParsedTask[] = [];
  const unsafe: ParsedTask[] = [];

  for (const task of tasks) {
    const hasConflict = task.targetFiles.some((f) => conflictFiles.has(f));
    if (hasConflict) {
      unsafe.push(task);
    } else {
      safe.push(task);
    }
  }

  if (safe.length > 0) {
    return [...safe, ...unsafe.slice(0, 1)];
  }

  return unsafe.slice(0, 1);
}

export function buildDelegationPrompt(task: ParsedTask): string {
  const lines: string[] = [];
  lines.push(`## Task: ${task.title}`);
  lines.push('');
  lines.push('**Target Files**:');
  for (const f of task.targetFiles) {
    lines.push(`- \`${f}\``);
  }
  lines.push('');
  lines.push('**Instructions**:');
  for (const inst of task.instructions) {
    lines.push(`${inst}`);
  }
  lines.push('');
  lines.push('**Acceptance Criteria**:');
  for (const criterion of task.acceptanceCriteria) {
    lines.push(`- ${criterion}`);
  }
  if (task.dependencies?.length) {
    lines.push('');
    lines.push(
      `**Depends on**: ${task.dependencies.map((d) => `Task ${d}`).join(', ')}`,
    );
  }
  return lines.join('\n');
}
