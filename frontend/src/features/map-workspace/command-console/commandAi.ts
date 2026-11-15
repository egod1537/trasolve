import {
  CHAT_LIMITS,
  validateWorkspaceCommand,
  workspaceCommandDefinitions,
  type WorkspaceCommandRequest,
} from '@trasolve/shared';
export function readCommandProposal(
  content: string,
): WorkspaceCommandRequest | null {
  try {
    const raw: unknown = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    );
    if (
      !raw ||
      typeof raw !== 'object' ||
      (raw as { kind?: unknown }).kind !== 'workspace_command'
    ) {
      return null;
    }
    return validateWorkspaceCommand((raw as { command?: unknown }).command);
  } catch {
    return null;
  }
}
export function commandAiInstructions(
  available: (name: string) => boolean,
  allowPlan = true,
): string[] {
  const messages = [
    'The workspace command registry is shared with the user command console. To propose one operation, return ONLY JSON: {"kind":"workspace_command","command":{"name":"place move","args":{"place":"exact ID or unique name","day":"exact day ID or 1-based ordinal","order":2}}}.',
    'The client validates arguments and the current trip snapshot before the user applies a proposal. Never claim an operation has executed. Use read commands to request lookups; never invent place IDs or coordinates. No prefix such as > or / is used in the user console.',
    allowPlan
      ? 'Use the existing TripCommandPlan format for multi-step edits.'
      : 'This console supports one reviewed workspace command per answer. For multi-step requests propose the next command, then wait for the user to apply it and ask to continue.',
  ];
  const catalog = workspaceCommandDefinitions.filter((d) => available(d.name));
  let part = 'Workspace command catalog:\n';
  for (const definition of catalog) {
    const row = `${JSON.stringify(definition)}\n`;
    if (part.length + row.length > CHAT_LIMITS.messageLength) {
      messages.push(part);
      part = 'Workspace command catalog (continued):\n';
    }
    part += row;
  }
  messages.push(part);
  return messages;
}
