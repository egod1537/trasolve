import { useEffect, useRef } from 'react';
import { useTutorial } from '../model/tutorialContext';

export function TutorialWorkspaceBridge({
  selectedTripId,
  tripIds,
  pickerOpen,
  busy,
  onOpenPicker,
  onClosePicker,
  onOpenTrip,
}: {
  selectedTripId: string | null;
  tripIds: readonly string[];
  pickerOpen: boolean;
  busy: boolean;
  onOpenPicker(): void;
  onClosePicker(): void;
  onOpenTrip(id: string): void;
}) {
  const tutorial = useTutorial();
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (!tutorial?.active || busy) {
      return;
    }
    if (tutorial.progress.step === 'create') {
      if (!pickerOpen) {
        onOpenPicker();
      }
      return;
    }
    if (selectedTripId) {
      if (pickerOpen) {
        onClosePicker();
      }
      return;
    }
    const tripId = tutorial.progress.tripId;
    if (tripId && tripIds.includes(tripId)) {
      if (attempted.current !== tripId) {
        attempted.current = tripId;
        onOpenTrip(tripId);
      } else {
        tutorial.step(0);
      }
    } else {
      tutorial.step(0);
    }
  }, [
    tutorial,
    selectedTripId,
    tripIds,
    pickerOpen,
    busy,
    onOpenPicker,
    onClosePicker,
    onOpenTrip,
  ]);
  return null;
}
