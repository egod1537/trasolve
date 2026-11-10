import { parseTripCommandString } from '../command/TripCommandParser';
import type { TripCommand } from '../command/TripCommand';
import { L } from '@/shared/i18n';
export type CommandExecutionResult = {
  success: boolean;
  commandName: string | null;
  error: string | null;
};
type CommandTarget = {
  destroyed: boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  dispatch: (command: TripCommand) => Promise<boolean>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  getError: () => string | null;
};
export async function executeTripCommandInput(
  input: string,
  target: CommandTarget,
): Promise<CommandExecutionResult> {
  if (target.destroyed) {
    return {
      success: false,
      commandName: null,
      error: L(
        'map:tripEditController.executeTripCommandString.error.youCannotRunCommandsClosedTrip',
      ),
    };
  }

  const parsed = parseTripCommandString(input);
  if (!parsed.success) {
    return parsed;
  }

  const { commandName, operation } = parsed.parsed;
  const success =
    operation.type === 'command'
      ? await target.dispatch(operation.command)
      : operation.type === 'undo'
        ? await target.undo()
        : await target.redo();
  return {
    success,
    commandName,
    error: success ? null : getCommandExecutionError(commandName, target),
  };
}
function getCommandExecutionError(
  commandName: string,
  target: CommandTarget,
): string {
  if (commandName === 'undo' && !target.canUndo()) {
    return L(
      'map:tripEditController.getCommandExecutionError.text.thereNoChangeHistoryRevert',
    );
  }
  if (commandName === 'redo' && !target.canRedo()) {
    return L(
      'map:tripEditController.getCommandExecutionError.text.thereNoChangeHistoryRedo',
    );
  }
  return (
    target.getError() ??
    L(
      'map:tripEditController.getCommandExecutionError.text.commandExecutionFailed',
    )
  );
}
