import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import './share-trip-modal.css';

type Props = {
  onClose: () => void;
};

type CopyStatus = 'idle' | 'copied' | 'failed';

const SHARE_PROFILE = {
  name: '양성준',
  initials: '양',
} as const;

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ShareTripModal({ onClose }: Props) {
  const [anyoneWithLink, setAnyoneWithLink] = useState(false);
  const [searchable, setSearchable] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [shareUrl] = useState(() => window.location.href);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const interceptGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', interceptGlobalKeyDown, true);
    return () =>
      window.removeEventListener('keydown', interceptGlobalKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') {
      return;
    }
    event.stopPropagation();

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateAnyoneWithLink = (enabled: boolean) => {
    setAnyoneWithLink(enabled);
    if (!enabled) {
      setSearchable(false);
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return createPortal(
    <div className="share-trip-modal-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="share-trip-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="share-trip-modal-header">
          <h2 id={titleId}>지도 공유</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="share-trip-modal-close"
            aria-label="지도 공유 닫기"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="share-trip-modal-content">
          <div className="share-trip-options">
            <label className="share-trip-option">
              <input
                type="checkbox"
                checked={anyoneWithLink}
                onChange={(event) =>
                  updateAnyoneWithLink(event.currentTarget.checked)
                }
              />
              <span className="share-trip-switch" aria-hidden="true" />
              <span>링크가 있는 사용자는 누구나 볼 수 있음</span>
            </label>
            <label
              className={`share-trip-option${anyoneWithLink ? '' : ' is-disabled'}`}
            >
              <input
                type="checkbox"
                checked={searchable}
                disabled={!anyoneWithLink}
                onChange={(event) => setSearchable(event.currentTarget.checked)}
              />
              <span className="share-trip-switch" aria-hidden="true" />
              <span>다른 사람이 인터넷에서 이 지도를 검색하고 찾도록 허용</span>
            </label>
          </div>

          <p id={descriptionId} className="share-trip-description">
            액세스 권한이 있는 모든 사용자는 내 지도 및 Drive에서 내 이름과
            프로필 사진을 볼 수 있습니다.
          </p>

          <div className="share-trip-profile">
            <span className="share-trip-avatar" aria-hidden="true">
              {SHARE_PROFILE.initials}
            </span>
            <strong>{SHARE_PROFILE.name}</strong>
          </div>

          <div className="share-trip-link-group">
            <label htmlFor={`${titleId}-url`}>공유 링크</label>
            <div className="share-trip-link-row">
              <input
                id={`${titleId}-url`}
                type="url"
                value={shareUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="share-trip-copy-button"
                aria-label="공유 링크 복사"
                onClick={() => void copyShareUrl()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="11" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                <span aria-live="polite">
                  {copyStatus === 'copied'
                    ? '복사됨'
                    : copyStatus === 'failed'
                      ? '복사 실패'
                      : '복사'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <footer className="share-trip-modal-actions">
          <button
            type="button"
            disabled
            title="Drive 공유 기능 준비 중"
            aria-label="Drive에서 공유, 기능 준비 중"
          >
            Drive에서 공유
          </button>
          <button type="button" className="is-primary" onClick={onClose}>
            닫기
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
