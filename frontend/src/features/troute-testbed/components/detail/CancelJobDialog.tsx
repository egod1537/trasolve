import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
} from '@blueprintjs/core';

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
  return (
    <Dialog
      className="cancel-job-dialog"
      role="alertdialog"
      isOpen={isOpen}
      title="Job 강제 종료"
      icon="warning-sign"
      isCloseButtonShown={false}
      canEscapeKeyClose={!loading}
      canOutsideClickClose={false}
      portalClassName={dark ? Classes.DARK : undefined}
      onClose={onCancel}
    >
      <DialogBody>
        <p>현재 실행 중인 Job을 종료합니다.</p>
        <p>
          이미 수행된 계산과 기록은 유지되며, 종료 후 다시 실행하려면 새 Job을
          생성해야 합니다.
        </p>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button disabled={loading} onClick={onCancel}>
              취소
            </Button>
            <Button
              icon="stop"
              intent={Intent.DANGER}
              loading={loading}
              disabled={loading}
              onClick={onConfirm}
            >
              강제 종료
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
