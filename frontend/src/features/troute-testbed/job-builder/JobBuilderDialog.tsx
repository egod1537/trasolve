import { useJobBuilderDialog } from '@/features/troute-testbed/job-builder/useJobBuilderDialog';
import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
} from '@blueprintjs/core';

import { JobBuilderContentFlow } from '@/features/troute-testbed/job-builder/JobBuilderContentFlow';
import { JobBuilderLocationList } from '@/features/troute-testbed/job-builder/JobBuilderLocationList';
import { JobBuilderMap } from '@/features/troute-testbed/job-builder/JobBuilderMap';
import { JobBuilderPresetPicker } from '@/features/troute-testbed/job-builder/JobBuilderPresetPicker';

import { JobBuilderSettings } from '@/features/troute-testbed/job-builder/JobBuilderSettings';
import { JobBuilderTravelTimeSource } from '@/features/troute-testbed/job-builder/JobBuilderTravelTimeSource';

import '@/features/troute-testbed/job-builder/job-builder.css';

import { RawJsonEditor } from '@/features/troute-testbed/job-builder/RawJsonEditor';
import { type JobBuilderDialogProps } from '@/features/troute-testbed/job-builder/jobBuilderDialogTypes';

export function JobBuilderDialog({
  isOpen,
  dark,
  existingJobIds,
  onClose,
  onCreate,
}: JobBuilderDialogProps) {
  const {
    L,
    jobId,
    setJobId,
    builder,
    presetId,
    setPresetId,
    viewportRevision,
    selectedLocationId,
    setSelectedLocationId,
    feedback,
    setFeedback,
    setRawDraft,
    rawInput,
    rawDirty,
    validation,
    clearFeedback,
    addPlace,
    updateLocation,
    removeLocation,
    reorderLocation,
    shuffleLocations,
    updateTravelTimeSource,
    updateTravelTimeMatrixCell,
    updateTravelTimeMatrix,
    updateSettings,
    loadPreset,
    validateVisual,
    parseRaw,
    applyRawToForm,
    createJob,
  } = useJobBuilderDialog({ isOpen, dark, existingJobIds, onClose, onCreate });
  return (
    <Dialog
      className="job-builder-dialog"
      isOpen={isOpen}
      onClose={onClose}
      portalClassName={dark ? Classes.DARK : undefined}
      title={L('testbed:jobSidebar.text.newJob')}
      icon="new-object"
      canEscapeKeyClose
      canOutsideClickClose={false}
    >
      <DialogBody className="job-builder-dialog-body">
        <JobBuilderContentFlow
          validationStatus={validation.status}
          validationErrors={validation.errors}
          feedback={feedback}
        >
          <div className="job-builder-visual">
            <JobBuilderSettings
              jobId={jobId}
              state={builder}
              startTimeError={validation.validation?.startTimeError}
              minJobDurationMsError={
                validation.validation?.minJobDurationMsError
              }
              onJobIdChange={(nextJobId) => {
                setJobId(nextJobId);
                clearFeedback();
              }}
              onChange={updateSettings}
            />
            <JobBuilderPresetPicker
              presetId={presetId}
              onPresetChange={setPresetId}
              onApply={loadPreset}
            />
            <div className="job-builder-main-grid">
              <JobBuilderMap
                locations={builder.locations}
                viewportRevision={viewportRevision}
                selectedLocationId={selectedLocationId}
                onSelectLocation={setSelectedLocationId}
                onAddPlace={addPlace}
              />
              <JobBuilderLocationList
                locations={builder.locations}
                placeIdRequired={builder.travelTimeSource === 'tcache'}
                selectedLocationId={selectedLocationId}
                errors={validation.validation?.locationErrors ?? {}}
                validationStatus={validation.status}
                validationErrorCount={validation.errorCount}
                onSelect={setSelectedLocationId}
                onUpdate={updateLocation}
                onRemove={removeLocation}
                onReorder={reorderLocation}
                onShuffle={shuffleLocations}
              />
            </div>
            <JobBuilderTravelTimeSource
              source={builder.travelTimeSource}
              locations={builder.locations}
              matrix={builder.travelTimeMatrix}
              onSourceChange={updateTravelTimeSource}
              onMatrixCellChange={updateTravelTimeMatrixCell}
              onMatrixChange={updateTravelTimeMatrix}
            />
            <RawJsonEditor
              input={rawInput}
              dirty={rawDirty}
              onChange={(input) => {
                setRawDraft(input);
                setFeedback(null);
              }}
              onApply={applyRawToForm}
              onFormat={() => {
                const request = parseRaw();
                if (request) {
                  setRawDraft(JSON.stringify(request, null, 2));
                }
              }}
              onReset={() => {
                setRawDraft(null);
                setFeedback(null);
              }}
            />
          </div>
        </JobBuilderContentFlow>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose}>{L('common:action.cancel')}</Button>
            <Button
              icon="tick"
              onClick={rawDirty ? applyRawToForm : validateVisual}
            >
              {L(
                'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.inputValidation',
              )}
            </Button>
            <Button
              icon="play"
              intent={Intent.PRIMARY}
              disabled={!validation.isValid || rawDirty}
              title={
                rawDirty
                  ? L(
                      'testbed:jobBuilderDialog.tooltip.applyRawJsonChangesFormFirst',
                    )
                  : undefined
              }
              onClick={createJob}
            >
              {L('testbed:jobSidebar.text.newJob')}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
