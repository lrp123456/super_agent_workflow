import * as crypto from 'node:crypto';

export interface FixAttempt {
  id: string;
  timestamp: string;
  issue: string;
  approach: string;
  targetFiles: string[];
  result: 'success' | 'failed' | 'partial' | 'pending_verification';
  failureReason?: string;
  reviewFeedback?: string;
  attemptNumber: number;
  gitCommitHash?: string;
}

export interface FixHistoryEntry {
  fingerprint: string;
  issueId?: string;
  issue: string;
  keywords: string[];
  affectedPaths: string[];
  firstAttemptedAt: string;
  lastAttemptedAt: string;
  totalAttempts: number;
  currentStatus: 'open' | 'resolved' | 'recurring' | 'pending_verification';
  attempts: FixAttempt[];
}

export interface FixHistoryDocument {
  version: number;
  generatedAt: string;
  entries: FixHistoryEntry[];
}

export const FIX_HISTORY_VERSION = 2;

export const FIX_HISTORY_DIR = '.codemap';
export const FIX_HISTORY_FILE = 'fix-history.json';

export function generateFingerprint(
  issue: string,
  affectedPaths: string[],
): string {
  const normalizedIssue = issue
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const keywords = extractKeywords(normalizedIssue);
  const sortedPaths = [...affectedPaths].sort();
  const raw = `${keywords.join('|')}::${sortedPaths.join('|')}`;

  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'out',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
    'and',
    'but',
    'or',
    'nor',
    'not',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'each',
    'every',
    'all',
    'any',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'only',
    'own',
    'same',
    'than',
    'too',
    'very',
    'just',
    'because',
    'if',
    'when',
    'where',
    'how',
    'what',
    'which',
    'who',
    'whom',
    'this',
    'that',
    'these',
    'those',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'he',
    'him',
    'his',
    'she',
    'her',
    'it',
    'its',
    'they',
    'them',
    'their',
  ]);

  return text
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .slice(0, 10);
}

export function findMatchingEntry(
  doc: FixHistoryDocument,
  issue: string,
  affectedPaths: string[],
  issueId?: string,
): FixHistoryEntry | undefined {
  if (issueId) {
    const match = doc.entries.find((e) => e.issueId === issueId);
    if (match) return match;
  }

  const fingerprint = generateFingerprint(issue, affectedPaths);
  const exactMatch = doc.entries.find((e) => e.fingerprint === fingerprint);
  if (exactMatch) return exactMatch;

  const inputKeywords = extractKeywords(issue.toLowerCase());
  const inputPaths = new Set(affectedPaths.map((p) => p.toLowerCase()));

  let bestMatch: FixHistoryEntry | undefined;
  let bestScore = 0;

  for (const entry of doc.entries) {
    const keywordOverlap = entry.keywords.filter((k) =>
      inputKeywords.includes(k),
    ).length;
    const pathOverlap = entry.affectedPaths.filter((p) =>
      inputPaths.has(p.toLowerCase()),
    ).length;

    const keywordScore =
      inputKeywords.length > 0
        ? keywordOverlap / Math.max(inputKeywords.length, entry.keywords.length)
        : 0;
    const pathScore =
      inputPaths.size > 0
        ? pathOverlap / Math.max(inputPaths.size, entry.affectedPaths.length)
        : 0;

    const score = keywordScore * 0.6 + pathScore * 0.4;

    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch;
}
