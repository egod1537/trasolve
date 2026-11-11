import { createTripCommandPlanContext } from '../ai-command/TripCommandPlanContext';
import { createTripCommandPlanSystemMessages } from '../ai-command/TripCommandPlanContextParts';
import { commandFingerprint } from './commandFingerprint';
import { useRef } from 'react';
import { CHAT_LIMITS, type ChatMessage } from '@trasolve/shared';
import { sendChat } from '@/features/ai-chat';
import { useCommandBindings, useCommandRuntime } from './CommandProvider';
import { useCommandSession } from './CommandSession';
import { commandAiInstructions, readCommandProposal } from './commandAi';
export function AiCommands() {
  const ctx = useCommandSession();
  const runtime = useCommandRuntime();
  const history = useRef<ChatMessage[]>([]);
  useCommandBindings({
    ai: async (a, signal) => {
      const fingerprint = commandFingerprint(ctx.trip);
      const context = createTripCommandPlanSystemMessages(
        await createTripCommandPlanContext(ctx.trip, [
          ...ctx.ui.selectedPlaceIds,
        ]),
      );
      if (!context) {
        throw new Error('CONTEXT_TOO_LARGE');
      }
      const system: ChatMessage[] = [
        ...context,
        ...commandAiInstructions(runtime.available, false),
      ].map((content) => ({ role: 'system', content }));
      const remaining = CHAT_LIMITS.messages - system.length - 1;
      if (remaining < 0) {
        throw new Error('CONTEXT_TOO_LARGE');
      }
      signal.throwIfAborted();
      const user: ChatMessage = { role: 'user', content: String(a.prompt) };
      const result = await sendChat(
        {
          messages: [
            ...system,
            ...(remaining ? history.current.slice(-remaining) : []),
            user,
          ],
        },
        signal,
      );
      signal.throwIfAborted();
      if (
        commandFingerprint(ctx.trip) !== commandFingerprint(ctx.currentTrip())
      ) {
        throw new Error('STALE_TRIP');
      }
      history.current = [...history.current, user, result.message].slice(
        -(CHAT_LIMITS.messages - 2),
      );
      const command = readCommandProposal(result.message.content);
      return {
        text: result.message.content,
        ...(command
          ? {
              items: [
                {
                  label: command.name,
                  detail: JSON.stringify(command.args),
                  command,
                },
              ],
              expectedTrip: fingerprint,
            }
          : {}),
      };
    },
    'ai new': () => {
      history.current = [];
      return { data: { newConversation: true } };
    },
    'ai stop': () => ({ data: { stopped: false } }),
  });
  return null;
}
