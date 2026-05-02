import { log } from '../utils/logger';
import type { McpHealthMonitor, McpServiceStatus } from './health-monitor';
import type { McpConfig, RemoteMcpConfig } from './types';

export interface McpFailoverChain {
  primary: string;
  fallbacks: string[];
}

export interface McpFailoverConfig {
  enabled: boolean;
  chains: Record<string, McpFailoverChain>;
  autoRecovery: boolean;
  recoveryCooldownMs: number;
}

interface McpServiceEntry {
  name: string;
  config: McpConfig;
  isFallback: boolean;
  parentService?: string;
}

export class McpFailoverManager {
  private readonly activeService = new Map<string, string>();
  private readonly serviceRegistry = new Map<string, McpServiceEntry[]>();
  private readonly config: McpFailoverConfig;
  private readonly monitor: McpHealthMonitor;
  private readonly switchHistory: Array<{
    service: string;
    from: string;
    to: string;
    reason: string;
    timestamp: number;
  }> = [];

  constructor(config: McpFailoverConfig, monitor: McpHealthMonitor) {
    this.config = config;
    this.monitor = monitor;
  }

  registerChains(mcps: Record<string, McpConfig>): Record<string, McpConfig> {
    if (!this.config.enabled) return mcps;

    const result: Record<string, McpConfig> = { ...mcps };

    for (const [serviceName, chain] of Object.entries(this.config.chains)) {
      const entries: McpServiceEntry[] = [];

      const primaryConfig = mcps[chain.primary];
      if (primaryConfig) {
        entries.push({
          name: chain.primary,
          config: primaryConfig,
          isFallback: false,
        });
      }

      for (const fallbackName of chain.fallbacks) {
        const fallbackConfig = mcps[fallbackName];
        if (fallbackConfig) {
          entries.push({
            name: fallbackName,
            config: fallbackConfig,
            isFallback: true,
            parentService: serviceName,
          });
        }
      }

      if (entries.length > 0) {
        this.serviceRegistry.set(serviceName, entries);
        this.activeService.set(serviceName, chain.primary);
        result[serviceName] = entries[0].config;
      }
    }

    return result;
  }

  handleStatusChange(
    serviceName: string,
    oldStatus: McpServiceStatus,
    newStatus: McpServiceStatus,
  ): McpConfig | null {
    if (!this.config.enabled) return null;

    const chain = this.config.chains[serviceName];
    if (!chain) return null;

    const entries = this.serviceRegistry.get(serviceName);
    if (!entries || entries.length <= 1) return null;

    if (newStatus === 'unhealthy' && oldStatus !== 'unhealthy') {
      return this.switchToFallback(serviceName, 'primary_unhealthy');
    }

    if (
      newStatus === 'healthy' &&
      oldStatus === 'unhealthy' &&
      this.config.autoRecovery
    ) {
      const currentActive = this.activeService.get(serviceName);
      if (currentActive !== chain.primary) {
        return this.switchToPrimary(serviceName);
      }
    }

    return null;
  }

  private switchToFallback(
    serviceName: string,
    reason: string,
  ): McpConfig | null {
    const entries = this.serviceRegistry.get(serviceName);
    if (!entries) return null;

    const currentActive = this.activeService.get(serviceName);
    const currentIndex = entries.findIndex((e) => e.name === currentActive);

    const nextEntry = entries.find(
      (e, i) => i > currentIndex && this.monitor.isHealthy(e.name),
    );

    if (!nextEntry) {
      log('[mcp-failover] No healthy fallback available', {
        serviceName,
        tried: entries.map((e) => e.name),
      });
      return null;
    }

    const previous = this.activeService.get(serviceName);
    this.activeService.set(serviceName, nextEntry.name);

    this.switchHistory.push({
      service: serviceName,
      from: previous ?? 'unknown',
      to: nextEntry.name,
      reason,
      timestamp: Date.now(),
    });

    log('[mcp-failover] Switched to fallback', {
      service: serviceName,
      from: previous,
      to: nextEntry.name,
      reason,
    });

    return nextEntry.config;
  }

  private switchToPrimary(serviceName: string): McpConfig | null {
    const chain = this.config.chains[serviceName];
    if (!chain) return null;

    const entries = this.serviceRegistry.get(serviceName);
    if (!entries) return null;

    const primaryEntry = entries.find((e) => !e.isFallback);
    if (!primaryEntry) return null;

    if (!this.monitor.isHealthy(primaryEntry.name)) {
      log('[mcp-failover] Primary still unhealthy, skipping recovery', {
        service: serviceName,
        primary: primaryEntry.name,
      });
      return null;
    }

    const previous = this.activeService.get(serviceName);
    this.activeService.set(serviceName, primaryEntry.name);

    this.switchHistory.push({
      service: serviceName,
      from: previous ?? 'unknown',
      to: primaryEntry.name,
      reason: 'auto_recovery',
      timestamp: Date.now(),
    });

    log('[mcp-failover] Recovered to primary', {
      service: serviceName,
      from: previous,
      to: primaryEntry.name,
    });

    return primaryEntry.config;
  }

  getActiveService(serviceName: string): string | undefined {
    return this.activeService.get(serviceName);
  }

  getSwitchHistory(): typeof this.switchHistory {
    return [...this.switchHistory];
  }

  getEffectiveMcps(
    originalMcps: Record<string, McpConfig>,
  ): Record<string, McpConfig> {
    if (!this.config.enabled) return originalMcps;

    const result = { ...originalMcps };

    for (const [serviceName, activeName] of this.activeService) {
      const entries = this.serviceRegistry.get(serviceName);
      if (!entries) continue;

      const activeEntry = entries.find((e) => e.name === activeName);
      if (activeEntry) {
        result[serviceName] = activeEntry.config;
      }
    }

    return result;
  }
}

export function createWebsearchFallbackConfig(
  provider: 'exa' | 'tavily',
): RemoteMcpConfig {
  if (provider === 'tavily') {
    const tavilyKey = process.env.TAVILY_API_KEY;
    return {
      type: 'remote',
      url: 'https://mcp.tavily.com/mcp/',
      headers: tavilyKey ? { Authorization: `Bearer ${tavilyKey}` } : undefined,
      oauth: false,
    };
  }

  const exaKey = process.env.EXA_API_KEY;
  const exaUrl = exaKey
    ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(exaKey)}`
    : 'https://mcp.exa.ai/mcp?tools=web_search_exa';

  return {
    type: 'remote',
    url: exaUrl,
    oauth: false,
  };
}

export function buildDefaultFailoverChains(): Record<string, McpFailoverChain> {
  const chains: Record<string, McpFailoverChain> = {};

  const hasExa = Boolean(process.env.EXA_API_KEY);
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);

  if (hasExa && hasTavily) {
    chains.websearch = {
      primary: 'websearch',
      fallbacks: ['websearch_tavily'],
    };
  }

  return chains;
}

export function buildFailoverMcps(): Record<string, McpConfig> {
  const mcps: Record<string, McpConfig> = {};

  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  if (hasTavily) {
    mcps.websearch_tavily = createWebsearchFallbackConfig('tavily');
  }

  const hasExa = Boolean(process.env.EXA_API_KEY);
  if (hasExa) {
    mcps.websearch_exa = createWebsearchFallbackConfig('exa');
  }

  return mcps;
}
