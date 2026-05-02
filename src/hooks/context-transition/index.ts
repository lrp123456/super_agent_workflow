import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../../config';
import { log } from '../../utils/logger';

const CONTEXT_WIPE_NUDGE = `\n\n---\n\n!CONTEXT TRANSITION! You are @super_build starting a fresh execution. Do NOT carry over context from the planning phase. Your only source of truth is the final_plan.json file — use the read_plan tool to load it. All previous discussion, brainstorming, and exploration context has been intentionally cleared to save tokens and prevent hallucination. !END CONTEXT TRANSITION!`;

export function createContextTransitionHook(
  _ctx: PluginInput,
  _config?: PluginConfig,
) {
  const injectedSessions = new Set<string>();

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
      for (const message of output.messages) {
        if (message.info.role !== 'user') continue;

        const agent = message.info.agent;
        if (agent !== 'super_build') continue;

        const sessionId = message.info.sessionID;
        if (!sessionId) continue;

        if (injectedSessions.has(sessionId)) continue;

        for (const part of message.parts) {
          if (part.type !== 'text' || typeof part.text !== 'string') continue;

          if (part.text.includes('!CONTEXT TRANSITION!')) continue;

          part.text = `${part.text}${CONTEXT_WIPE_NUDGE}`;
          injectedSessions.add(sessionId);
          log(
            '[context-transition] Injected context wipe nudge for super_build session',
            {
              sessionId,
            },
          );
        }
      }
    },
  };
}
