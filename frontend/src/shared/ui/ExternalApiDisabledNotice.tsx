import { useEffect, useState } from 'react';
import {
  EXTERNAL_API_DISABLED_NOTICE_EVENT,
  getCurrentExternalApiDisabledNotice,
  type ExternalApiDisabledNoticeDetail,
} from '@/shared/api/externalApiDisabled';

export function ExternalApiDisabledNotice() {
  const [message, setMessage] = useState<string | null>(
    getCurrentExternalApiDisabledNotice,
  );

  useEffect(() => {
    const showNotice = (event: Event): void => {
      setMessage(
        (event as CustomEvent<ExternalApiDisabledNoticeDetail>).detail.message,
      );
    };
    window.addEventListener(EXTERNAL_API_DISABLED_NOTICE_EVENT, showNotice);
    return () =>
      window.removeEventListener(
        EXTERNAL_API_DISABLED_NOTICE_EVENT,
        showNotice,
      );
  }, []);

  return message ? (
    <div className="external-api-disabled-notice" role="alert">
      {message}
    </div>
  ) : null;
}
