import { useId, useState } from 'react';
import { TUTORIAL_STEPS, type TutorialProgress } from '@trasolve/shared';
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
  const progressLabel = `${stepIndex(tutorial.progress)} / ${TUTORIAL_STEPS.length}`;
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
  return Math.max(
    1,
    TUTORIAL_STEPS.findIndex((step) => step === progress.step) + 1,
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
    case 'optimize-running':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.optimizingRoute',
      );
    case 'optimize-result':
      return L(
        'routeOptimization:routeOptimizationModal.action.applyThisResult',
      );
    case 'ai':
      return L('common:tutorial.ai.title');
    case 'share':
      return L('common:tutorial.create.title');
  }
}
