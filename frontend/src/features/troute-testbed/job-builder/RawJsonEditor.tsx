import {
  Button,
  ButtonGroup,
  Classes,
  Intent,
  TextArea,
} from '@blueprintjs/core';
import { useL } from '@/shared/i18n';

export function RawJsonEditor({
  input,
  dirty,
  onChange,
  onApply,
  onFormat,
  onReset,
}: {
  input: string;
  dirty: boolean;
  onChange: (input: string) => void;
  onApply: () => void;
  onFormat: () => void;
  onReset: () => void;
}) {
  const L = useL();
  return (
    <section className="job-builder-raw-editor">
      <header>
        <div>
          <h2 className={Classes.HEADING}>
            {L('testbed:jobBuilderDialog.rawJsonEditor.title.rawJson')}
          </h2>
          <p>
            {L(
              'testbed:jobBuilderDialog.rawJsonEditor.description.displaysRequestLikeFormIfYou',
            )}
          </p>
        </div>
        <ButtonGroup size="small" variant="minimal">
          <Button icon="code" onClick={onFormat}>
            {L('testbed:jobBuilderDialog.rawJsonEditor.action.format')}
          </Button>
          <Button icon="reset" onClick={onReset}>
            {L('testbed:jobBuilderDialog.rawJsonEditor.action.restoreFromForm')}
          </Button>
          <Button
            icon="import"
            intent={dirty ? Intent.PRIMARY : Intent.NONE}
            disabled={!dirty}
            onClick={onApply}
          >
            {L('testbed:jobBuilderDialog.rawJsonEditor.action.applyForm')}
          </Button>
        </ButtonGroup>
      </header>
      <TextArea
        aria-label={L(
          'testbed:jobBuilderDialog.rawJsonEditor.ariaLabel.requestJson',
        )}
        className="job-builder-raw-textarea"
        fill
        spellCheck={false}
        autoCapitalize="off"
        value={input}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
