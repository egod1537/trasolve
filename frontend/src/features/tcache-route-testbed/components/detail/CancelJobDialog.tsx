import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
} from '@blueprintjs/core';

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
  return (
    <Dialog
      className={dark ? Classes.DARK : ''}
      isOpen={jobId !== null}
      title="경로 작업 취소"
      icon="warning-sign"
      canEscapeKeyClose={!loading}
      canOutsideClickClose={!loading}
      onClose={onClose}
    >
      <DialogBody>
        <p>
          <code>{jobId}</code> 작업을 취소하시겠습니까?
        </p>
        <p className={Classes.TEXT_MUTED}>
          취소 응답 또는 SSE 상태가 확인된 뒤 최종 상태가 반영됩니다.
        </p>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button disabled={loading} onClick={onClose}>
              닫기
            </Button>
            <Button
              intent="danger"
              loading={loading}
              disabled={loading}
              onClick={onConfirm}
            >
              작업 취소
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
