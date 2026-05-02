import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../../config';
import { log } from '../../utils/logger';

interface SuperBuildWorkflowConfig {
  autoUpdateCodemap: boolean;
}

export function createSuperBuildWorkflowHook(
  _ctx: PluginInput,
  config?: PluginConfig,
) {
  const hookConfig: SuperBuildWorkflowConfig = {
    autoUpdateCodemap: config?.codemap?.autoUpdate ?? true,
  };

  const pendingCodemapUpdates = new Set<string>();

  return {
    'experimental.chat.messages.transform': async (
      _input: Record<string, never>,
      output: {
        messages: Array<{
          info: { role: string; agent?: string; sessionID?: string };
          parts: Array<{ type: string; text?: string }>;
        }>;
      },
    ): Promise<void> => {
      if (!hookConfig.autoUpdateCodemap) return;

      for (const message of output.messages) {
        if (message.info.role !== 'assistant') continue;

        const agent = message.info.agent;
        if (agent !== 'super_build') continue;

        for (const part of message.parts) {
          if (part.type !== 'text' || typeof part.text !== 'string') continue;

          if (
            part.text.includes('Code map updated') ||
            part.text.includes('update_codemap')
          ) {
            continue;
          }

          if (
            part.text.includes('all tasks are approved') ||
            part.text.includes('All tasks completed') ||
            part.text.includes('execution summary')
          ) {
            const sessionId = message.info.sessionID;
            if (sessionId) {
              pendingCodemapUpdates.add(sessionId);
              log(
                '[super-build-workflow] Detected build completion, codemap update pending',
                {
                  sessionId,
                },
              );
            }
          }
        }
      }
    },

    'tool.execute.after': async (
      input: { tool: string; sessionID?: string },
      _output: { output?: unknown },
    ): Promise<void> => {
      if (!hookConfig.autoUpdateCodemap) return;

      if (input.tool !== 'update_codemap') return;

      const sessionId = input.sessionID;
      if (sessionId && pendingCodemapUpdates.has(sessionId)) {
        pendingCodemapUpdates.delete(sessionId);
        log('[super-build-workflow] Codemap update completed after build', {
          sessionId,
        });
      }
    },

    getPendingUpdates(): Set<string> {
      return new Set(pendingCodemapUpdates);
    },

    shouldTriggerCodemapUpdate(sessionId: string): boolean {
      return pendingCodemapUpdates.has(sessionId);
    },
  };
}
