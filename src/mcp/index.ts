import type { McpName, WebsearchConfig } from '../config';
import { context7 } from './context7';
import { grep_app } from './grep-app';
import type { McpConfig } from './types';
import { createWebsearchConfig, websearch } from './websearch';

export type {
  McpFailoverChain,
  McpFailoverConfig,
} from './failover-manager';
export {
  buildDefaultFailoverChains,
  buildFailoverMcps,
  createWebsearchFallbackConfig,
  McpFailoverManager,
} from './failover-manager';
export type {
  McpHealthCheckResult,
  McpHealthHistory,
  McpServiceStatus,
} from './health-monitor';
export { McpHealthMonitor } from './health-monitor';
export type { LocalMcpConfig, McpConfig, RemoteMcpConfig } from './types';

const allBuiltinMcps: Record<McpName, McpConfig> = {
  websearch,
  context7,
  grep_app,
};

export function createBuiltinMcps(
  disabledMcps: readonly string[] = [],
  websearchConfig?: WebsearchConfig,
): Record<string, McpConfig> {
  const mcps = Object.fromEntries(
    Object.entries(allBuiltinMcps).filter(
      ([name]) => !disabledMcps.includes(name),
    ),
  );

  if (!disabledMcps.includes('websearch')) {
    mcps.websearch = createWebsearchConfig(websearchConfig);
  }

  return mcps;
}
