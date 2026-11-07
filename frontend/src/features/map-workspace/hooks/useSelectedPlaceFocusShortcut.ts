import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest('input, textarea, select')) {
    return true;
  }
  const editable = target.closest<HTMLElement>('[contenteditable]');
  return editable !== null && editable.contentEditable !== 'false';
}

export function useSelectedPlaceFocusShortcut(
  selectedPlaceId: string | null,
  focusPlace: (placeId: string) => void,
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !selectedPlaceId ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      if (event.code !== 'KeyF' && event.key.toLowerCase() !== 'f') {
        return;
      }

      event.preventDefault();
      focusPlace(selectedPlaceId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusPlace, selectedPlaceId]);
}
