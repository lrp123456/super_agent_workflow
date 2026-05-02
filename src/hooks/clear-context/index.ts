import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../../config';
import { log } from '../../utils/logger';

const CLEAR_CONTEXT_COMMAND = 'clear_context';

const CLEAR_CONTEXT_RESPONSE = `Context cleared! 🧹

The previous conversation context has been intentionally cleared to:
1. Free up token budget for the next phase
2. Prevent hallucination from stale planning context
3. Start fresh with only the approved plan as source of truth

**Next step**: Invoke @super_build to execute the approved plan. It will read the plan from final_plan.json — no need to repeat any context from this conversation.`;

export function createClearContextCommand(
  _ctx: PluginInput,
  _config?: PluginConfig,
) {
  return {
    handleCommandExecuteBefore: async (
      input: {
        command: string;
        sessionID: string;
        arguments: string;
      },
      output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      if (input.command !== CLEAR_CONTEXT_COMMAND) return;

      log('[clear-context] /clear_context command invoked', {
        sessionID: input.sessionID,
      });

      output.parts = [
        {
          type: 'text',
          text: CLEAR_CONTEXT_RESPONSE,
        },
      ];
    },
  };
}
