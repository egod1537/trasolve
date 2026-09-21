import { useEffect } from 'react';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';

function isNativeUndoTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest('input, textarea')) {
    return true;
  }
  const editable = target.closest<HTMLElement>('[contenteditable]');
  return editable !== null && editable.contentEditable !== 'false';
}

export function useTripHistoryShortcuts(controller: TripEditController): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        isNativeUndoTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const undoRequested = key === 'z' && !event.shiftKey;
      const redoRequested =
        (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      if (undoRequested && controller.canUndo) {
        event.preventDefault();
        void controller.undo();
      } else if (redoRequested && controller.canRedo) {
        event.preventDefault();
        void controller.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controller]);
}
