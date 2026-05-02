import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../../config';
import { log } from '../../utils/logger';

const CODEMAP_NUDGE = `\n\n---\n\n!CODEMAP CHECK! Before planning, check if a code map exists using the read_codemap tool. If no code map exists, delegate to @explorer to scan the codebase and then use update_codemap to create one. If a code map exists, use it as your foundation for understanding the codebase. !END CODEMAP CHECK!`;

export function createSuperPlanWorkflowHook(
  _ctx: PluginInput,
  config?: PluginConfig,
) {
  const codemapEnabled = config?.codemap?.enabled ?? true;

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
      if (!codemapEnabled) return;

      for (const message of output.messages) {
        if (message.info.role !== 'user') continue;

        const agent = message.info.agent;
        if (agent !== 'super_plan') continue;

        for (const part of message.parts) {
          if (part.type !== 'text' || typeof part.text !== 'string') continue;

          if (part.text.includes('!CODEMAP CHECK!')) continue;

          part.text = `${part.text}${CODEMAP_NUDGE}`;
          log(
            '[super-plan-workflow] Injected codemap check nudge for super_plan',
          );
        }
      }
    },
  };
}
