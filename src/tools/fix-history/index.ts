export {
  addFixAttempt,
  fixHistoryExists,
  getPendingVerification,
  getRecentFailures,
  getRecurringIssues,
  markIssueResolved,
  markVerificationFailed,
  readFixHistory,
} from './parser';
export { createFixHistoryTools } from './tools';
export {
  type FixAttempt,
  type FixHistoryDocument,
  type FixHistoryEntry,
  findMatchingEntry,
  generateFingerprint,
} from './types';
