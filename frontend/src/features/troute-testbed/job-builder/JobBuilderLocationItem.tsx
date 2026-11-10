import { Button } from '@blueprintjs/core';
import { DragHandle } from '@/shared/ui/DragHandle';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '@/entities/place';
import type {
  JobBuilderLocation,
  JobBuilderLocationErrors,
  JobBuilderLocationRole,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { MAX_STAY_MINUTES } from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { useL, L } from '@/shared/i18n';
import { type JobBuilderLocationPatch } from '@/features/troute-testbed/job-builder/jobBuilderLocationTypes';
import {
  type LocationItemDragProps,
  type DropTargetEdge,
} from '@/features/troute-testbed/job-builder/jobBuilderDrag';

export interface JobBuilderLocationItemProps {
  location: JobBuilderLocation;
  index: number;
  role: JobBuilderLocationRole;
  placeIdRequired: boolean;
  selected: boolean;
  dropTargetEdge: DropTargetEdge;
  errors: JobBuilderLocationErrors;
  drag: LocationItemDragProps;
  setRowRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onUpdate: (patch: JobBuilderLocationPatch) => void;
  onRemove: () => void;
}

export function JobBuilderLocationItem({
  location,
  index,
  role,
  placeIdRequired,
  selected,
  dropTargetEdge,
  errors,
  drag,
  setRowRef,
  onSelect,
  onUpdate,
  onRemove,
}: JobBuilderLocationItemProps) {
  const L = useL();
  return (
    <article
      ref={setRowRef}
      className={`job-builder-location-item${selected ? ' is-selected' : ''}${drag.dragging ? ' is-dragging' : ''}${dropTargetEdge ? ` is-drop-target-${dropTargetEdge}` : ''}`}
      data-builder-location-id={location.id}
      {...(role === 'waypoint'
        ? { 'data-builder-sortable-location-id': location.id }
        : {})}
      onClick={onSelect}
    >
      <div className="job-builder-location-heading">
        <DragHandle
          className="job-builder-drag-handle"
          label={L(
            'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.location',
            { name: location.name },
          )}
          dragging={drag.dragging}
          disabled={role !== 'waypoint'}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
          onLostPointerCapture={drag.onLostPointerCapture}
          onKeyDown={drag.onKeyDown}
        />
        <span className={`job-builder-location-order is-${role}`}>
          {getLocationRoleLabel(role, index)}
        </span>
        <div className="job-builder-location-copy">
          <span className="job-builder-location-name">
            <strong>{location.name}</strong>
          </span>
          <span className="job-builder-location-address">
            {location.address ??
              L('testbed:tcacheRouteMap.text.noAddressInformation')}
          </span>
        </div>
        <Button
          aria-label={L(
            'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.remove',
            { name: location.name },
          )}
          title={L(
            'testbed:jobBuilderLocationList.jobBuilderLocationItem.tooltip.remove',
          )}
          icon="cross"
          size="small"
          variant="minimal"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        />
      </div>

      <div
        className="job-builder-location-fields"
        onClick={(event) => event.stopPropagation()}
      >
        <label>
          <span>
            {L('testbed:jobBuilderLocationList.jobBuilderLocationItem.text.id')}
          </span>
          <input
            className="bp6-input"
            type="text"
            aria-label={L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.id',
              { name: location.name },
            )}
            aria-invalid={Boolean(errors.id)}
            value={location.id}
            onChange={(event) => onUpdate({ id: event.currentTarget.value })}
          />
        </label>
        {errors.id ? (
          <p className="job-builder-field-error" role="alert">
            {errors.id}
          </p>
        ) : null}
        <label>
          <span>
            {L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.name',
            )}
          </span>
          <input
            className="bp6-input"
            type="text"
            aria-label={L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.name',
              { name: location.name },
            )}
            value={location.name}
            onChange={(event) => onUpdate({ name: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>
            {placeIdRequired
              ? L('testbed:jobDetail.requestSection.text.placeId')
              : L(
                  'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.placeIdOptional',
                )}
          </span>
          <input
            className="bp6-input"
            type="text"
            required={placeIdRequired}
            aria-label={L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.placeId',
              { name: location.name },
            )}
            aria-invalid={Boolean(errors.placeId)}
            value={location.placeId}
            onChange={(event) => onUpdate({ placeId: event.target.value })}
          />
        </label>
        {errors.placeId ? (
          <p className="job-builder-field-error" role="alert">
            {errors.placeId}
          </p>
        ) : null}
        <label>
          <span>
            {L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.businessHours',
            )}
          </span>
          <span className="job-builder-time-range">
            <input
              className="bp6-input"
              type="time"
              step={VISIT_TIME_GRANULARITY_MINUTES * 60}
              aria-label={L(
                'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.businessStartTime',
                { name: location.name },
              )}
              aria-invalid={Boolean(errors.openTime)}
              value={location.openTime}
              onChange={(event) => onUpdate({ openTime: event.target.value })}
            />
            <span>~</span>
            <input
              className="bp6-input"
              type="time"
              step={VISIT_TIME_GRANULARITY_MINUTES * 60}
              aria-label={L(
                'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.businessClosingTime',
                { name: location.name },
              )}
              aria-invalid={Boolean(errors.closeTime)}
              value={location.closeTime}
              onChange={(event) => onUpdate({ closeTime: event.target.value })}
            />
          </span>
        </label>
        {errors.openTime || errors.closeTime ? (
          <p className="job-builder-field-error" role="alert">
            {errors.openTime ?? errors.closeTime}
          </p>
        ) : null}
        <label>
          <span>
            {L(
              'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.residenceTime',
            )}
          </span>
          <span className="job-builder-stay-input">
            <input
              className="bp6-input"
              type="number"
              min={role === 'waypoint' ? MIN_VISIT_DURATION_MINUTES : 0}
              max={MAX_STAY_MINUTES}
              step={VISIT_TIME_GRANULARITY_MINUTES}
              aria-label={L(
                'testbed:jobBuilderLocationList.jobBuilderLocationItem.ariaLabel.dwellTimeMinutes',
                { name: location.name },
              )}
              aria-invalid={Boolean(errors.stayMinutes)}
              value={location.stayMinutes}
              onChange={(event) =>
                onUpdate({ stayMinutes: Number(event.target.value) })
              }
            />
            <span>{L('testbed:jobRequestLocationTable.text.minutes')}</span>
          </span>
        </label>
        {errors.stayMinutes ? (
          <p className="job-builder-field-error" role="alert">
            {errors.stayMinutes}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function getLocationRoleLabel(
  role: JobBuilderLocationRole,
  index: number,
): string {
  if (role === 'start') {
    return L('testbed:jobResultMapComparison.locationSequence.label.departure');
  }
  if (role === 'end') {
    return L('testbed:jobResultMapComparison.locationSequence.label.arrival');
  }
  return String(index + 1);
}
