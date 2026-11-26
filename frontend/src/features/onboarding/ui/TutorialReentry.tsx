import { useRef, useState } from 'react';
import { useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { surveyFormUrl } from '../surveyForm';
import { useTutorial } from '../model/tutorialContext';
import { SurveyDialog } from './SurveyDialog';
import { useTutorialReentryVisibility } from './useTutorialReentryVisibility';

export function TutorialReentry() {
  const L = useL();
  const tutorial = useTutorial();
  const [surveyOpen, setSurveyOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const obscured = useTutorialReentryVisibility(actionsRef);

  if (!tutorial) {
    return null;
  }

  return (
    <>
      <div
        ref={actionsRef}
        className="tutorial-reentry-actions"
        data-layout-obscured={obscured || undefined}
        aria-hidden={obscured || undefined}
        inert={obscured ? true : undefined}
      >
        <Button
          variant="primary"
          disabled={tutorial.loading}
          onClick={tutorial.restart}
        >
          {L('common:tutorial.action.restart')}
        </Button>
        {surveyFormUrl && (
          <Button onClick={() => setSurveyOpen(true)}>
            {L('common:survey.action.open')}
          </Button>
        )}
      </div>
      {surveyOpen && surveyFormUrl && (
        <SurveyDialog
          formUrl={surveyFormUrl}
          onClose={() => setSurveyOpen(false)}
        />
      )}
    </>
  );
}
