import { useCallback, useEffect, useRef, useState } from 'react';
import { captureView, requiresNativeCapture } from './captureView';
import { useL } from '@/shared/i18n';

export function useViewCapture() {
  const L = useL();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const capture = useCallback(async () => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    const native = requiresNativeCapture(document.body);
    setBusy(true);
    setMessage(native ? L('map:capture.chooseTab') : null);
    try {
      await captureView(document.body, native);
      if (mounted.current) {
        setMessage(null);
      }
    } catch (error) {
      if (mounted.current) {
        setMessage(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? null
            : L('map:capture.failed'),
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    }
  }, [L]);
  return { busy, message, capture };
}
