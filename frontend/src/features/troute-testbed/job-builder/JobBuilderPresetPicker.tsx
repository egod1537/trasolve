import { Button, HTMLSelect } from '@blueprintjs/core';
import {
  JOB_BUILDER_PRESETS,
  getJobBuilderPreset,
} from '@/features/troute-testbed/job-builder/presets';
import { useL } from '@/shared/i18n';

export function JobBuilderPresetPicker({
  presetId,
  onPresetChange,
  onApply,
}: {
  presetId: string;
  onPresetChange: (presetId: string) => void;
  onApply: () => void;
}) {
  const L = useL();
  const selectedPreset = getJobBuilderPreset(presetId);

  return (
    <section className="job-builder-preset" aria-labelledby="preset-title">
      <div className="job-builder-preset-controls">
        <label htmlFor="job-builder-preset-select" id="preset-title">
          {L('testbed:jobBuilderPresetPicker.label.testCase')}
        </label>
        <HTMLSelect
          id="job-builder-preset-select"
          value={presetId}
          onChange={(event) => onPresetChange(event.currentTarget.value)}
        >
          {JOB_BUILDER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </HTMLSelect>
        <Button icon="import" intent="primary" onClick={onApply}>
          {L('testbed:jobBuilderPresetPicker.action.load')}
        </Button>
      </div>
      {selectedPreset ? (
        <p>
          {L('testbed:jobBuilderPresetPicker.text.locations', {
            locationCount: selectedPreset.locationCount,
            sourceLabel: selectedPreset.sourceLabel,
            value: ' ',
            description: selectedPreset.description,
          })}
        </p>
      ) : null}
    </section>
  );
}
