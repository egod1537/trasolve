import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
} from '@blueprintjs/core';
import { useL } from '@/shared/i18n';

interface CancelJobDialogProps {
  jobId: string | null;
  loading: boolean;
  dark: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelJobDialog({
  jobId,
  loading,
  dark,
  onClose,
  onConfirm,
}: CancelJobDialogProps) {
  const L = useL();
  return (
    <Dialog
      className={dark ? Classes.DARK : ''}
      isOpen={jobId !== null}
      title={L('testbed:cancelJobDialog.tooltip.cancelRouteOperation')}
      icon="warning-sign"
      canEscapeKeyClose={!loading}
      canOutsideClickClose={!loading}
      onClose={onClose}
    >
      <DialogBody>
        <p>
          <code>{jobId}</code>
          {L(
            'testbed:cancelJobDialog.description.youSureYouWantCancelOperation',
          )}
        </p>
        <p className={Classes.TEXT_MUTED}>
          {L(
            'testbed:cancelJobDialog.description.finalStatusReflectedAfterCancellationResponse',
          )}
        </p>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button disabled={loading} onClick={onClose}>
              {L('common:action.close')}
            </Button>
            <Button
              intent="danger"
              loading={loading}
              disabled={loading}
              onClick={onConfirm}
            >
              {L('testbed:cancelJobDialog.tooltip.cancelRouteOperation')}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
