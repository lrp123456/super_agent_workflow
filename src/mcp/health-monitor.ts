import { log } from '../utils/logger';
import type { McpConfig, RemoteMcpConfig } from './types';

export type McpServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface McpHealthCheckResult {
  name: string;
  status: McpServiceStatus;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

export interface McpHealthHistory {
  name: string;
  checks: McpHealthCheckResult[];
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckAt: number;
  currentStatus: McpServiceStatus;
}

const MAX_HISTORY_LENGTH = 20;

export class McpHealthMonitor {
  private readonly history = new Map<string, McpHealthHistory>();
  private readonly timeoutMs: number;
  private readonly checkIntervalMs: number;
  private readonly failureThreshold: number;
  private readonly recoveryThreshold: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: {
    timeoutMs?: number;
    checkIntervalMs?: number;
    failureThreshold?: number;
    recoveryThreshold?: number;
  }) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.checkIntervalMs = options.checkIntervalMs ?? 60_000;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryThreshold = options.recoveryThreshold ?? 2;
  }

  async checkService(
    name: string,
    config: McpConfig,
  ): Promise<McpHealthCheckResult> {
    const start = Date.now();
    const timestamp = start;

    if (config.type === 'local') {
      return {
        name,
        status: 'unknown',
        latencyMs: 0,
        timestamp,
        error: 'Local MCP services cannot be health-checked remotely',
      };
    }

    const remote = config as RemoteMcpConfig;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(remote.url, {
        method: 'GET',
        signal: controller.signal,
        headers: remote.headers,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (response.ok || response.status === 405 || response.status === 401) {
        const status: McpServiceStatus = response.ok ? 'healthy' : 'degraded';
        return { name, status, latencyMs, timestamp };
      }

      return {
        name,
        status: 'unhealthy',
        latencyMs,
        timestamp,
        error: `HTTP ${response.status}`,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        name,
        status: 'unhealthy',
        latencyMs,
        timestamp,
        error: message,
      };
    }
  }

  recordCheck(result: McpHealthCheckResult): McpHealthHistory {
    let history = this.history.get(result.name);
    if (!history) {
      history = {
        name: result.name,
        checks: [],
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheckAt: result.timestamp,
        currentStatus: 'unknown',
      };
      this.history.set(result.name, history);
    }

    history.checks.push(result);
    if (history.checks.length > MAX_HISTORY_LENGTH) {
      history.checks = history.checks.slice(-MAX_HISTORY_LENGTH);
    }
    history.lastCheckAt = result.timestamp;

    if (result.status === 'healthy' || result.status === 'degraded') {
      history.consecutiveSuccesses++;
      history.consecutiveFailures = 0;
    } else {
      history.consecutiveFailures++;
      history.consecutiveSuccesses = 0;
    }

    if (history.consecutiveFailures >= this.failureThreshold) {
      history.currentStatus = 'unhealthy';
    } else if (history.consecutiveSuccesses >= this.recoveryThreshold) {
      history.currentStatus = 'healthy';
    } else if (history.consecutiveFailures > 0) {
      history.currentStatus = 'degraded';
    } else {
      history.currentStatus = result.status;
    }

    return history;
  }

  getStatus(name: string): McpHealthHistory | undefined {
    return this.history.get(name);
  }

  isHealthy(name: string): boolean {
    const history = this.history.get(name);
    if (!history) return true;
    return history.currentStatus !== 'unhealthy';
  }

  start(
    mcps: Record<string, McpConfig>,
    onStatusChange?: (
      name: string,
      oldStatus: McpServiceStatus,
      newStatus: McpServiceStatus,
    ) => void,
  ): void {
    this.stop();

    const runCheck = async () => {
      for (const [name, config] of Object.entries(mcps)) {
        const result = await this.checkService(name, config);
        const prev = this.history.get(result.name);
        const oldStatus = prev?.currentStatus ?? 'unknown';
        const updated = this.recordCheck(result);
        const newStatus = updated.currentStatus;

        if (oldStatus !== newStatus && onStatusChange) {
          log('[mcp-health] Status changed', {
            name,
            oldStatus,
            newStatus,
          });
          onStatusChange(name, oldStatus, newStatus);
        }
      }
    };

    runCheck();
    this.timer = setInterval(runCheck, this.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getAllStatus(): Map<string, McpHealthHistory> {
    return new Map(this.history);
  }
}
