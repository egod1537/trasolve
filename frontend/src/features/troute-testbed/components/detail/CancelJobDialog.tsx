import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
} from '@blueprintjs/core';
import { useL } from '@/shared/i18n';

interface CancelJobDialogProps {
  isOpen: boolean;
  loading: boolean;
  dark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CancelJobDialog({
  isOpen,
  loading,
  dark,
  onCancel,
  onConfirm,
}: CancelJobDialogProps) {
  const L = useL();
  return (
    <Dialog
      className="cancel-job-dialog"
      role="alertdialog"
      isOpen={isOpen}
      title={L('testbed:cancelJobDialog.tooltip.forceQuitJob')}
      icon="warning-sign"
      isCloseButtonShown={false}
      canEscapeKeyClose={!loading}
      canOutsideClickClose={false}
      portalClassName={dark ? Classes.DARK : undefined}
      onClose={onCancel}
    >
      <DialogBody>
        <p>
          {L(
            'testbed:cancelJobDialog.description.terminatesCurrentlyRunningJob',
          )}
        </p>
        <p>
          {L(
            'testbed:cancelJobDialog.description.calculationsRecordsThatHaveAlreadyBeen',
          )}
        </p>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button disabled={loading} onClick={onCancel}>
              {L('common:action.cancel')}
            </Button>
            <Button
              icon="stop"
              intent={Intent.DANGER}
              loading={loading}
              disabled={loading}
              onClick={onConfirm}
            >
              {L('testbed:cancelJobDialog.tooltip.forceQuitJob')}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
