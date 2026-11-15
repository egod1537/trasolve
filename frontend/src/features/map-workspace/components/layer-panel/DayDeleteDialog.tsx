import { useId, useRef, useState } from 'react';
import { useTripError } from '@/features/map-workspace/hooks/useTrip';
import { useL } from '@/shared/i18n';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';

type Props = {
  day: { id: string; title: string };
  onRemove: (dayId: string) => Promise<boolean>;
  onClose: () => void;
  onRemoved: () => void;
};

export function DayDeleteDialog({ day, onRemove, onClose, onRemoved }: Props) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const mutationError = useTripError();
  const close = () => {
    if (!pendingRef.current) {
      onClose();
    }
  };
  const remove = async () => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    try {
      if (await onRemove(day.id)) {
        onRemoved();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog
      className="trip-day-delete-dialog"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={cancelRef}
      busy={pending}
      onClose={close}
    >
      <h2 id={titleId}>
        {L('place:placeDeleteConfirmCard.text.youSureYouWantDeleteIt')}
      </h2>
      <p id={descriptionId}>
        {L(
          'place:placeDeleteConfirmCard.text.willBeRemovedFromCurrentSchedule',
          { placeName: day.title },
        )}
      </p>
      {failed && (
        <p role="alert">
          {mutationError ?? L('map:layerBulkActionBar.text.taskFailed')}
        </p>
      )}
      <div className="trip-day-delete-actions">
        <Button ref={cancelRef} disabled={pending} onClick={close}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="danger"
          loading={pending}
          onClick={() => void remove()}
        >
          {L('common:action.delete')}
        </Button>
      </div>
    </Dialog>
  );
}
