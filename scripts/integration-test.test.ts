import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CUSTOM_SKILL_NAMES = ['simplify', 'codemap', 'brainstorm', 'plannotator'];

describe('Skill Auto-Integration', () => {
  describe('Skill files exist in source', () => {
    for (const skillName of CUSTOM_SKILL_NAMES) {
      it(`should have ${skillName}/SKILL.md in src/skills/`, () => {
        const skillPath = join(
          import.meta.dir,
          '..',
          'src',
          'skills',
          skillName,
          'SKILL.md',
        );
        expect(existsSync(skillPath)).toBe(true);
      });
    }
  });

  describe('Skill files in package.json files array', () => {
    it('should include src/skills in the files array', () => {
      const packageJsonPath = join(import.meta.dir, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.files).toContain('src/skills');
    });
  });

  describe('CUSTOM_SKILLS registry completeness', () => {
    it('should register brainstorm and plannotator in custom-skills.ts', async () => {
      const { CUSTOM_SKILLS } = await import('../src/cli/custom-skills');
      const names = CUSTOM_SKILLS.map((s) => s.name);
      expect(names).toContain('brainstorm');
      expect(names).toContain('plannotator');
      expect(names).toContain('simplify');
      expect(names).toContain('codemap');
    });

    it('should assign brainstorm and plannotator to super_plan only', async () => {
      const { CUSTOM_SKILLS } = await import('../src/cli/custom-skills');
      const brainstorm = CUSTOM_SKILLS.find((s) => s.name === 'brainstorm');
      const plannotator = CUSTOM_SKILLS.find((s) => s.name === 'plannotator');
      expect(brainstorm?.allowedAgents).toEqual(['super_plan']);
      expect(plannotator?.allowedAgents).toEqual(['super_plan']);
    });
  });

  describe('Skill permissions for agents', () => {
    it('should allow brainstorm and plannotator for super_plan', async () => {
      const { getSkillPermissionsForAgent } = await import('../src/cli/skills');
      const permissions = getSkillPermissionsForAgent('super_plan');
      expect(permissions.brainstorm).toBe('allow');
      expect(permissions.plannotator).toBe('allow');
    });

    it('should deny brainstorm and plannotator for fixer', async () => {
      const { getSkillPermissionsForAgent } = await import('../src/cli/skills');
      const permissions = getSkillPermissionsForAgent('fixer');
      expect(permissions['*']).toBe('deny');
      expect(permissions.brainstorm).toBeUndefined();
      expect(permissions.plannotator).toBeUndefined();
    });

    it('should allow all skills for orchestrator via wildcard', async () => {
      const { getSkillPermissionsForAgent } = await import('../src/cli/skills');
      const permissions = getSkillPermissionsForAgent('orchestrator');
      expect(permissions['*']).toBe('allow');
    });
  });

  describe('Build script integration', () => {
    it('should have build:skills script in package.json', () => {
      const packageJsonPath = join(import.meta.dir, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.scripts['build:skills']).toBeDefined();
      expect(packageJson.scripts['build:skills']).toContain('install-skills');
    });

    it('should include build:skills in the main build script', () => {
      const packageJsonPath = join(import.meta.dir, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.scripts.build).toContain('build:skills');
    });
  });
});

describe('MCP Health Monitor', () => {
  const { McpHealthMonitor } = require('../src/mcp/health-monitor');

  it('should initialize with default options', () => {
    const monitor = new McpHealthMonitor({});
    expect(monitor).toBeDefined();
  });

  it('should record health check results', () => {
    const monitor = new McpHealthMonitor({});
    const result = {
      name: 'websearch',
      status: 'healthy' as const,
      latencyMs: 100,
      timestamp: Date.now(),
    };
    const history = monitor.recordCheck(result);
    expect(history.currentStatus).toBe('healthy');
    expect(history.consecutiveSuccesses).toBe(1);
  });

  it('should detect unhealthy status after threshold failures', () => {
    const monitor = new McpHealthMonitor({ failureThreshold: 2 });
    for (let i = 0; i < 2; i++) {
      monitor.recordCheck({
        name: 'websearch',
        status: 'unhealthy',
        latencyMs: 0,
        timestamp: Date.now(),
        error: 'timeout',
      });
    }
    const history = monitor.getStatus('websearch');
    expect(history?.currentStatus).toBe('unhealthy');
  });

  it('should recover after threshold successes', () => {
    const monitor = new McpHealthMonitor({
      failureThreshold: 1,
      recoveryThreshold: 2,
    });
    monitor.recordCheck({
      name: 'websearch',
      status: 'unhealthy',
      latencyMs: 0,
      timestamp: Date.now(),
      error: 'timeout',
    });
    for (let i = 0; i < 2; i++) {
      monitor.recordCheck({
        name: 'websearch',
        status: 'healthy',
        latencyMs: 50,
        timestamp: Date.now(),
      });
    }
    const history = monitor.getStatus('websearch');
    expect(history?.currentStatus).toBe('healthy');
  });

  it('should report isHealthy for unknown services', () => {
    const monitor = new McpHealthMonitor({});
    expect(monitor.isHealthy('unknown_service')).toBe(true);
  });
});

describe('MCP Failover Manager', () => {
  it('should register failover chains', () => {
    const { McpFailoverManager } = require('../src/mcp/failover-manager');
    const { McpHealthMonitor } = require('../src/mcp/health-monitor');

    const monitor = new McpHealthMonitor({});
    const manager = new McpFailoverManager(
      {
        enabled: true,
        chains: {
          websearch: {
            primary: 'websearch',
            fallbacks: ['websearch_tavily'],
          },
        },
        autoRecovery: true,
        recoveryCooldownMs: 300_000,
      },
      monitor,
    );

    const mcps = {
      websearch: {
        type: 'remote' as const,
        url: 'https://mcp.exa.ai/mcp',
        oauth: false as const,
      },
      websearch_tavily: {
        type: 'remote' as const,
        url: 'https://mcp.tavily.com/mcp/',
        oauth: false as const,
      },
    };

    const result = manager.registerChains(mcps);
    expect(result.websearch).toBeDefined();
    expect(manager.getActiveService('websearch')).toBe('websearch');
  });

  it('should switch to fallback when primary becomes unhealthy', () => {
    const { McpFailoverManager } = require('../src/mcp/failover-manager');
    const { McpHealthMonitor } = require('../src/mcp/health-monitor');

    const monitor = new McpHealthMonitor({ failureThreshold: 1 });
    const manager = new McpFailoverManager(
      {
        enabled: true,
        chains: {
          websearch: {
            primary: 'websearch',
            fallbacks: ['websearch_tavily'],
          },
        },
        autoRecovery: true,
        recoveryCooldownMs: 300_000,
      },
      monitor,
    );

    const mcps = {
      websearch: {
        type: 'remote' as const,
        url: 'https://mcp.exa.ai/mcp',
        oauth: false as const,
      },
      websearch_tavily: {
        type: 'remote' as const,
        url: 'https://mcp.tavily.com/mcp/',
        headers: { Authorization: 'Bearer test' },
        oauth: false as const,
      },
    };

    manager.registerChains(mcps);

    monitor.recordCheck({
      name: 'websearch',
      status: 'unhealthy',
      latencyMs: 0,
      timestamp: Date.now(),
      error: 'timeout',
    });

    const newConfig = manager.handleStatusChange(
      'websearch',
      'healthy',
      'unhealthy',
    );
    expect(newConfig).toBeDefined();
    expect(newConfig?.type).toBe('remote');
    expect((newConfig as { url?: string })?.url).toContain('tavily');
    expect(manager.getActiveService('websearch')).toBe('websearch_tavily');
  });

  it('should record switch history', () => {
    const { McpFailoverManager } = require('../src/mcp/failover-manager');
    const { McpHealthMonitor } = require('../src/mcp/health-monitor');

    const monitor = new McpHealthMonitor({ failureThreshold: 1 });
    const manager = new McpFailoverManager(
      {
        enabled: true,
        chains: {
          websearch: {
            primary: 'websearch',
            fallbacks: ['websearch_tavily'],
          },
        },
        autoRecovery: true,
        recoveryCooldownMs: 300_000,
      },
      monitor,
    );

    manager.registerChains({
      websearch: {
        type: 'remote' as const,
        url: 'https://mcp.exa.ai/mcp',
        oauth: false as const,
      },
      websearch_tavily: {
        type: 'remote' as const,
        url: 'https://mcp.tavily.com/mcp/',
        oauth: false as const,
      },
    });

    monitor.recordCheck({
      name: 'websearch',
      status: 'unhealthy',
      latencyMs: 0,
      timestamp: Date.now(),
      error: 'timeout',
    });

    manager.handleStatusChange('websearch', 'healthy', 'unhealthy');

    const history = manager.getSwitchHistory();
    expect(history.length).toBe(1);
    expect(history[0].from).toBe('websearch');
    expect(history[0].to).toBe('websearch_tavily');
    expect(history[0].reason).toBe('primary_unhealthy');
  });
});

describe('MCP Failover Configuration Schema', () => {
  it('should validate mcpFailover config with defaults', async () => {
    const { PluginConfigSchema } = await import('../src/config/schema');
    const result = PluginConfigSchema.safeParse({
      mcpFailover: {
        enabled: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mcpFailover?.enabled).toBe(true);
      expect(result.data.mcpFailover?.failureThreshold).toBe(3);
      expect(result.data.mcpFailover?.recoveryThreshold).toBe(2);
      expect(result.data.mcpFailover?.autoRecovery).toBe(true);
    }
  });

  it('should validate mcpFailover with custom chains', async () => {
    const { PluginConfigSchema } = await import('../src/config/schema');
    const result = PluginConfigSchema.safeParse({
      mcpFailover: {
        enabled: true,
        chains: {
          websearch: {
            primary: 'websearch',
            fallbacks: ['websearch_tavily'],
          },
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mcpFailover?.chains?.websearch?.primary).toBe(
        'websearch',
      );
      expect(result.data.mcpFailover?.chains?.websearch?.fallbacks).toEqual([
        'websearch_tavily',
      ]);
    }
  });

  it('should reject invalid healthCheckIntervalMs', async () => {
    const { PluginConfigSchema } = await import('../src/config/schema');
    const result = PluginConfigSchema.safeParse({
      mcpFailover: {
        enabled: true,
        healthCheckIntervalMs: 1000,
      },
    });
    expect(result.success).toBe(false);
  });
});
