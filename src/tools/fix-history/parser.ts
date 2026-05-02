import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FIX_HISTORY_DIR,
  FIX_HISTORY_FILE,
  FIX_HISTORY_VERSION,
  type FixAttempt,
  type FixHistoryDocument,
  type FixHistoryEntry,
  findMatchingEntry,
  generateFingerprint,
} from './types';

export function findFixHistoryFile(projectRoot: string): string | null {
  const filePath = path.join(projectRoot, FIX_HISTORY_DIR, FIX_HISTORY_FILE);
  return fs.existsSync(filePath) ? filePath : null;
}

export function fixHistoryExists(projectRoot: string): boolean {
  return findFixHistoryFile(projectRoot) !== null;
}

export function readFixHistory(projectRoot: string): FixHistoryDocument | null {
  const filePath = findFixHistoryFile(projectRoot);
  if (!filePath) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as FixHistoryDocument;
    if (parsed.version && Array.isArray(parsed.entries)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeFixHistory(
  projectRoot: string,
  doc: FixHistoryDocument,
): void {
  const dir = path.join(projectRoot, FIX_HISTORY_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, FIX_HISTORY_FILE);
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
}

export function findEntryByIssue(
  doc: FixHistoryDocument,
  issue: string,
  affectedPaths: string[] = [],
  issueId?: string,
): FixHistoryEntry | undefined {
  return findMatchingEntry(doc, issue, affectedPaths, issueId);
}

export function addFixAttempt(
  projectRoot: string,
  issue: string,
  attempt: Omit<FixAttempt, 'id' | 'timestamp' | 'attemptNumber'>,
  affectedPaths?: string[],
  issueId?: string,
): void {
  let doc = readFixHistory(projectRoot);

  const now = new Date().toISOString();
  const attemptId = `attempt_${Date.now()}`;

  const paths = affectedPaths ?? attempt.targetFiles;
  const fingerprint = generateFingerprint(issue, paths);

  if (!doc) {
    doc = {
      version: FIX_HISTORY_VERSION,
      generatedAt: now,
      entries: [],
    };
  }

  let entry = findEntryByIssue(doc, issue, paths, issueId);

  if (!entry) {
    const keywords = issue
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 10);

    entry = {
      fingerprint,
      issueId,
      issue,
      keywords,
      affectedPaths: paths,
      firstAttemptedAt: now,
      lastAttemptedAt: now,
      totalAttempts: 0,
      currentStatus: 'open',
      attempts: [],
    };
    doc.entries.push(entry);
  }

  const newAttempt: FixAttempt = {
    ...attempt,
    id: attemptId,
    timestamp: now,
    attemptNumber: entry.totalAttempts + 1,
  };

  entry.attempts.push(newAttempt);
  entry.totalAttempts++;
  entry.lastAttemptedAt = now;

  if (attempt.result === 'success') {
    entry.currentStatus = 'resolved';
  } else if (attempt.result === 'pending_verification') {
    entry.currentStatus = 'pending_verification';
  } else if (entry.totalAttempts > 1) {
    entry.currentStatus = 'recurring';
  } else {
    entry.currentStatus = 'open';
  }

  doc.generatedAt = now;
  writeFixHistory(projectRoot, doc);
}

export function getRecentFailures(
  projectRoot: string,
  limit = 10,
): FixHistoryEntry[] {
  const doc = readFixHistory(projectRoot);
  if (!doc) return [];

  return doc.entries
    .filter(
      (e) =>
        e.currentStatus !== 'resolved' &&
        e.currentStatus !== 'pending_verification',
    )
    .sort(
      (a, b) =>
        new Date(b.lastAttemptedAt).getTime() -
        new Date(a.lastAttemptedAt).getTime(),
    )
    .slice(0, limit);
}

export function getRecurringIssues(projectRoot: string): FixHistoryEntry[] {
  const doc = readFixHistory(projectRoot);
  if (!doc) return [];

  return doc.entries.filter((e) => e.currentStatus === 'recurring');
}

export function getPendingVerification(projectRoot: string): FixHistoryEntry[] {
  const doc = readFixHistory(projectRoot);
  if (!doc) return [];

  return doc.entries.filter((e) => e.currentStatus === 'pending_verification');
}

export function markIssueResolved(
  projectRoot: string,
  issue: string,
  affectedPaths?: string[],
  issueId?: string,
): void {
  const doc = readFixHistory(projectRoot);
  if (!doc) return;

  const entry = findEntryByIssue(doc, issue, affectedPaths, issueId);
  if (entry) {
    entry.currentStatus = 'resolved';
    entry.lastAttemptedAt = new Date().toISOString();
    doc.generatedAt = new Date().toISOString();
    writeFixHistory(projectRoot, doc);
  }
}

export function markVerificationFailed(
  projectRoot: string,
  issue: string,
  failureDescription: string,
  affectedPaths?: string[],
  issueId?: string,
): void {
  const doc = readFixHistory(projectRoot);
  if (!doc) return;

  const entry = findEntryByIssue(doc, issue, affectedPaths, issueId);
  if (entry) {
    const lastAttempt = entry.attempts[entry.attempts.length - 1];
    if (lastAttempt) {
      lastAttempt.result = 'failed';
      lastAttempt.failureReason = `User verification failed: ${failureDescription}`;
    }
    entry.currentStatus = 'recurring';
    entry.lastAttemptedAt = new Date().toISOString();
    doc.generatedAt = new Date().toISOString();
    writeFixHistory(projectRoot, doc);
  }
}
