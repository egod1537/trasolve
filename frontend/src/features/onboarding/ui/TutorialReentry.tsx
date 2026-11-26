import { useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { useTutorial } from '../model/tutorialContext';

export function TutorialReentry() {
  const L = useL();
  const tutorial = useTutorial();

  if (!tutorial) {
    return null;
  }

  return (
    <Button
      className="tutorial-reentry-button"
      variant="primary"
      disabled={tutorial.loading}
      onClick={tutorial.restart}
    >
      {L('common:tutorial.action.restart')}
    </Button>
  );
}
