import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import '@/features/map-workspace/components/share/share-trip-modal.css';
import { useL } from '@/shared/i18n';

type Props = {
  onClose: () => void;
};

type CopyStatus = 'idle' | 'copied' | 'failed';

const SHARE_PROFILE = {
  name: '양성준',
  initials: '양',
} as const;

export function ShareTripModal({ onClose }: Props) {
  const L = useL();
  const [anyoneWithLink, setAnyoneWithLink] = useState(false);
  const [searchable, setSearchable] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [shareUrl] = useState(() => window.location.href);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

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

  return (
    <Dialog
      className="share-trip-modal"
      backdropClassName="share-trip-modal-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={closeButtonRef}
      onClose={onClose}
    >
      <header className="share-trip-modal-header">
        <h2 id={titleId}>{L('trip:shareTripModal.title.shareMap')}</h2>
        <IconButton
          ref={closeButtonRef}
          className="share-trip-modal-close"
          aria-label={L('trip:shareTripModal.ariaLabel.shareMapClose')}
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
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
            <span>{L('trip:shareTripModal.text.anyoneLinkCanViewIt')}</span>
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
            <span>
              {L('trip:shareTripModal.text.allowOthersSearchFindThisMap')}
            </span>
          </label>
        </div>

        <p id={descriptionId} className="share-trip-description">
          {L('trip:shareTripModal.description.anyoneAccessCanSeeNameProfile')}
        </p>

        <div className="share-trip-profile">
          <span className="share-trip-avatar" aria-hidden="true">
            {SHARE_PROFILE.initials}
          </span>
          <strong>{SHARE_PROFILE.name}</strong>
        </div>

        <div className="share-trip-link-group">
          <label htmlFor={`${titleId}-url`}>
            {L('trip:shareTripModal.label.shareLink')}
          </label>
          <div className="share-trip-link-row">
            <input
              id={`${titleId}-url`}
              type="url"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              className="share-trip-copy-button"
              aria-label={L('trip:shareTripModal.ariaLabel.copyShareLink')}
              onClick={() => void copyShareUrl()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="8" y="8" width="11" height="11" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
              <span aria-live="polite">
                {copyStatus === 'copied'
                  ? L('trip:shareTripModal.text.copied')
                  : copyStatus === 'failed'
                    ? L('trip:shareTripModal.text.copyFailed')
                    : L('common:action.copy')}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <footer className="share-trip-modal-actions">
        <Button
          disabled
          title={L(
            'trip:shareTripModal.tooltip.driveSharingFeaturePreparation',
          )}
          aria-label={L(
            'trip:shareTripModal.ariaLabel.shareDriveFeaturePreparation',
          )}
        >
          {L('trip:shareTripModal.action.shareDrive')}
        </Button>
        <Button variant="primary" onClick={onClose}>
          {L('common:action.close')}
        </Button>
      </footer>
    </Dialog>
  );
}
