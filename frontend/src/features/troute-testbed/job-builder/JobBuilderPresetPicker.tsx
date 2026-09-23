import { Button, HTMLSelect } from '@blueprintjs/core';
import {
  JOB_BUILDER_PRESETS,
  getJobBuilderPreset,
} from '@/features/troute-testbed/job-builder/presets';

export function JobBuilderPresetPicker({
  presetId,
  onPresetChange,
  onApply,
}: {
  presetId: string;
  onPresetChange: (presetId: string) => void;
  onApply: () => void;
}) {
  const selectedPreset = getJobBuilderPreset(presetId);

  return (
    <section className="job-builder-preset" aria-labelledby="preset-title">
      <div className="job-builder-preset-controls">
        <label htmlFor="job-builder-preset-select" id="preset-title">
          Test Case
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
          불러오기
        </Button>
      </div>
      {selectedPreset ? (
        <p>
          {selectedPreset.locationCount}개 장소 · {selectedPreset.sourceLabel} ·{' '}
          {selectedPreset.description}
        </p>
      ) : null}
    </section>
  );
}
