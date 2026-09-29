import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { useCurrentUser } from '@/features/auth/model/useCurrentUser';
import { useTripShareSettings } from '@/features/map-workspace/hooks/useTripShareSettings';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import '@/features/map-workspace/components/share/share-trip-modal.css';
import { useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';

type Props = {
  tripId: string;
  onClose: () => void;
};

type CopyStatus = 'idle' | 'copied' | 'failed';

export function ShareTripModal({ tripId, onClose }: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.shareTrip);
  const { state: currentUser } = useCurrentUser();
  const { settings, loading, saving, error, saveSettings } =
    useTripShareSettings(tripId);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const shareUrl = useMemo(
    () =>
      settings?.enabled && settings.token
        ? `${window.location.origin}/share/${settings.token}`
        : '',
    [settings],
  );

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const copyShareUrl = async () => {
    if (!shareUrl) {
      return;
    }
    trackEvent({
      eventType: 'button_click',
      screen: ANALYTICS_SCREENS.shareTrip,
      target: ANALYTICS_TARGETS.copyShareLink,
    });
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('copied');
      if (settings?.shareId) {
        trackEvent({
          eventType: 'share_link_copy',
          screen: ANALYTICS_SCREENS.shareTrip,
          target: ANALYTICS_TARGETS.copyShareLink,
          metadata: { shareId: settings.shareId },
        });
      }
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
        {loading ? (
          <p
            id={descriptionId}
            className="share-trip-modal-status"
            aria-live="polite"
          >
            <LoadingSpinner />
            {L('trip:shareTripModal.status.loading')}
          </p>
        ) : (
          <>
            <div className="share-trip-options">
              <label className="share-trip-option">
                <input
                  type="checkbox"
                  data-analytics-id={ANALYTICS_TARGETS.shareToggle}
                  data-analytics-screen={ANALYTICS_SCREENS.shareTrip}
                  checked={settings?.enabled ?? false}
                  disabled={!settings || saving}
                  onChange={(event) => {
                    trackEvent({
                      eventType: 'button_click',
                      screen: ANALYTICS_SCREENS.shareTrip,
                      target: ANALYTICS_TARGETS.shareToggle,
                      metadata: { enabled: event.currentTarget.checked },
                    });
                    const enabled = event.currentTarget.checked;
                    void saveSettings({
                      enabled,
                      searchable: enabled
                        ? (settings?.searchable ?? false)
                        : false,
                    }).then((nextSettings) => {
                      setCopyStatus('idle');
                      if (enabled && nextSettings?.shareId) {
                        trackEvent({
                          eventType: 'share_enable',
                          screen: ANALYTICS_SCREENS.shareTrip,
                          target: ANALYTICS_TARGETS.shareToggle,
                          metadata: { shareId: nextSettings.shareId },
                        });
                      }
                    });
                  }}
                />
                <span className="share-trip-switch" aria-hidden="true" />
                <span>{L('trip:shareTripModal.text.anyoneLinkCanViewIt')}</span>
              </label>
              <label
                className={`share-trip-option${settings?.enabled ? '' : ' is-disabled'}`}
              >
                <input
                  type="checkbox"
                  checked={settings?.searchable ?? false}
                  disabled={!settings?.enabled || saving}
                  onChange={(event) =>
                    void saveSettings({
                      enabled: true,
                      searchable: event.currentTarget.checked,
                    }).then(() => setCopyStatus('idle'))
                  }
                />
                <span className="share-trip-switch" aria-hidden="true" />
                <span>
                  {L('trip:shareTripModal.text.allowOthersSearchFindThisMap')}
                </span>
              </label>
            </div>

            <p id={descriptionId} className="share-trip-description">
              {L(
                'trip:shareTripModal.description.anyoneAccessCanSeeNameProfile',
              )}
            </p>

            {currentUser.status === 'signed-in' && (
              <div className="share-trip-profile">
                <span className="share-trip-avatar" aria-hidden="true">
                  {currentUser.user.pictureUrl ? (
                    <img src={currentUser.user.pictureUrl} alt="" />
                  ) : (
                    (currentUser.user.name ?? currentUser.user.email)
                      .trim()
                      .charAt(0)
                      .toUpperCase()
                  )}
                </span>
                <strong>
                  {currentUser.user.name ?? currentUser.user.email}
                </strong>
              </div>
            )}

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
                  disabled={!shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  className="share-trip-copy-button"
                  data-analytics-id={ANALYTICS_TARGETS.copyShareLink}
                  data-analytics-screen={ANALYTICS_SCREENS.shareTrip}
                  aria-label={L('trip:shareTripModal.ariaLabel.copyShareLink')}
                  disabled={!shareUrl || saving}
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
          </>
        )}

        {error && (
          <p className="share-trip-modal-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <footer className="share-trip-modal-actions">
        <Button variant="primary" onClick={onClose}>
          {L('common:action.close')}
        </Button>
      </footer>
    </Dialog>
  );
}
