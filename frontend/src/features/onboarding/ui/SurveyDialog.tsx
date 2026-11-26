import { useId } from 'react';
import { getEmbeddedSurveyFormUrl } from '../surveyForm';
import { useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

type Props = {
  formUrl: string;
  onClose: () => void;
};

export function SurveyDialog({ formUrl, onClose }: Props) {
  const L = useL();
  const titleId = useId();

  return (
    <Dialog
      className="tutorial-survey-dialog"
      labelledBy={titleId}
      onClose={onClose}
    >
      <header className="tutorial-survey-dialog-header">
        <h2 id={titleId}>{L('common:survey.dialog.title')}</h2>
        <IconButton
          aria-label={L('common:action.close')}
          title={L('common:action.close')}
          size="sm"
          variant="ghost"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </header>
      <iframe
        className="tutorial-survey-frame"
        src={getEmbeddedSurveyFormUrl(formUrl)}
        title={L('common:survey.dialog.title')}
      />
      <footer className="tutorial-survey-dialog-actions">
        <Button
          onClick={() => window.open(formUrl, '_blank', 'noopener,noreferrer')}
        >
          {L('common:survey.action.openNewTab')}
        </Button>
        <Button variant="primary" onClick={onClose}>
          {L('common:action.close')}
        </Button>
      </footer>
    </Dialog>
  );
}
