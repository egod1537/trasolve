import { useId, useState } from 'react';
import type { TutorialProgress } from '@trasolve/shared';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { useL } from '@/shared/i18n';
import { useTutorial } from '../model/tutorialContext';

export function TutorialReentry() {
  const L = useL();
  const tutorial = useTutorial();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  if (!tutorial) {
    return null;
  }
  const resumable = ['in-progress', 'paused', 'skipped'].includes(
    tutorial.progress.status,
  );
  const progressLabel = `${
    tutorial.progress.step === 'ai' ? 6 : stepIndex(tutorial.progress)
  } / 6`;
  return (
    <>
      <Button
        className="tutorial-reentry-button"
        variant="primary"
        onClick={() => setOpen(true)}
      >
        {L('common:hero.text.viewFeatures')}
      </Button>
      {open && (
        <Dialog
          className="tutorial-reentry-dialog"
          labelledBy={titleId}
          onClose={() => setOpen(false)}
        >
          <h2 id={titleId}>{L('common:hero.text.viewFeatures')}</h2>
          <p>{stepTitle(tutorial.progress, L)}</p>
          <p>{progressLabel}</p>
          <div className="tutorial-dialog-actions">
            {resumable && (
              <Button
                onClick={() => {
                  setOpen(false);
                  tutorial.resume();
                }}
              >
                {L('common:hero.text.gettingStarted')}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
                tutorial.restart();
              }}
            >
              {L('admin:common.reset')}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function stepIndex(progress: TutorialProgress): number {
  return (
    ['create', 'days', 'search', 'add-place', 'optimize', 'ai'].indexOf(
      progress.step,
    ) + 1
  );
}

function stepTitle(
  progress: TutorialProgress,
  L: ReturnType<typeof useL>,
): string {
  switch (progress.step) {
    case 'create':
      return L('common:tutorial.create.title');
    case 'days':
      return L('common:tutorial.days.title');
    case 'search':
      return L('common:tutorial.search.title');
    case 'add-place':
      return L('common:tutorial.addPlace.title');
    case 'optimize':
      return L('common:tutorial.optimize.title');
    case 'ai':
      return L('common:tutorial.ai.title');
    case 'share':
      return L('common:tutorial.create.title');
  }
}
