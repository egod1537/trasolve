import {
  createRegisteredTripCommand,
  type RegisteredTripCommand,
} from '@/features/map-workspace/command/TripCommandRegistry';
import { tokenizeTripCommand } from '@/features/map-workspace/command/TripCommandTokenizer';

export type ParsedTripCommand = {
  commandName: string;
  operation: RegisteredTripCommand;
};

export type TripCommandParseResult =
  | { success: true; parsed: ParsedTripCommand }
  | { success: false; commandName: string | null; error: string };

const commandNamePattern = /^\/[a-z][a-z0-9_]*$/u;

export function parseTripCommandString(input: string): TripCommandParseResult {
  const tokenized = tokenizeTripCommand(input);
  if (!tokenized.success) {
    return { success: false, commandName: null, error: tokenized.error };
  }
  const [commandToken, ...args] = tokenized.tokens;
  if (!commandToken) {
    return {
      success: false,
      commandName: null,
      error: '실행할 명령을 입력해 주세요.',
    };
  }
  if (!commandNamePattern.test(commandToken)) {
    return {
      success: false,
      commandName: null,
      error: '명령은 /command_name 형식으로 시작해야 합니다.',
    };
  }

  const commandName = commandToken.slice(1);
  const registered = createRegisteredTripCommand(commandName, args);
  return registered.success
    ? {
        success: true,
        parsed: {
          commandName: registered.commandName,
          operation: registered.operation,
        },
      }
    : registered;
}
