import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { useL } from '@/shared/i18n';
import { useTutorial } from '../model/tutorialContext';

export function TutorialPreferences({ onClose }: { onClose(): void }) {
  const tutorial = useTutorial();
  const L = useL();
  const id = useId();
  if (!tutorial) {
    return null;
  }
  return (
    <fieldset className="preferences-group tutorial-preferences">
      <legend>{L('common:hero.text.viewFeatures')}</legend>
      <Button
        disabled={tutorial.loading}
        onClick={() => {
          onClose();
          tutorial.restart();
        }}
      >
        {L('common:hero.text.gettingStarted')}
      </Button>
      {tutorial.debug && (
        <>
          <label htmlFor={id}>{L('auth:billing.debugMode')}</label>
          <select
            id={id}
            className="ui-select"
            value={tutorial.mode}
            disabled={tutorial.loading}
            onChange={(event) => {
              onClose();
              tutorial.setMode(event.target.value as 'auto' | 'always' | 'off');
            }}
          >
            <option value="auto">
              {L('auth:accountSettingsModal.title.accountSettings')}
            </option>
            <option value="always">
              {L('map:dayColorControl.ariaLabel.showing')}
            </option>
            <option value="off">
              {L('map:dayColorControl.ariaLabel.hiddenStatus')}
            </option>
          </select>
          <Button disabled={tutorial.loading} onClick={tutorial.reset}>
            {L('admin:common.reset')}
          </Button>
        </>
      )}
      {tutorial.error && (
        <p role="alert">
          {L('common:status.error')}{' '}
          <Button size="sm" onClick={tutorial.retry}>
            {L('common:action.retry')}
          </Button>
        </p>
      )}
    </fieldset>
  );
}
