import { useId, useRef } from 'react';
import type { Trip } from '@trasolve/shared';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { useL } from '@/shared/i18n';

type Props = {
  trip: Trip;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TripDeleteConfirmation({ trip, onCancel, onConfirm }: Props) {
  const L = useL();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      className="trip-map-delete-confirmation"
      backdropClassName="trip-map-delete-backdrop"
      role="alertdialog"
      labelledBy={titleId}
      initialFocusRef={cancelRef}
      onClose={onCancel}
    >
      <h2 id={titleId}>
        {L('trip:tripPickerPopup.ariaLabel.delete', { title: trip.title })}
      </h2>
      <div className="trip-map-delete-confirmation-actions">
        <Button ref={cancelRef} onClick={onCancel}>
          {L('common:action.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {L('common:action.delete')}
        </Button>
      </div>
    </Dialog>
  );
}
