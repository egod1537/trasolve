import type { RefObject } from 'react';
import { useL } from '@/shared/i18n';
import type { PlaceDetailPlace } from '../model/placeDetailTypes';

type Props = {
  place: PlaceDetailPlace;
  canEditMemo: boolean;
  disabled: boolean;
  memoEditing: boolean;
  memoDraft: string;
  memoSubmitting: boolean;
  memoTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
  onStartEditing: () => void;
  onCancel: () => void;
};
export function PlaceDetailMemo({
  place,
  canEditMemo,
  disabled,
  memoEditing,
  memoDraft,
  memoSubmitting,
  memoTextareaRef,
  onDraftChange,
  onSave,
  onStartEditing,
  onCancel,
}: Props) {
  const L = useL();
  return (
    <section className="trip-place-management-section">
      <h3>{L('place:placeDetailContent.title.memo')}</h3>
      {memoEditing ? (
        <form
          className="trip-place-memo-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <textarea
            ref={memoTextareaRef}
            value={memoDraft}
            maxLength={4000}
            aria-label={L('place:placeDetailContent.ariaLabel.notes', {
              name: place.name,
            })}
            disabled={disabled}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
                return;
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="trip-place-memo-editor-actions">
            {memoSubmitting && (
              <span role="status">
                {L('place:placeDetailContent.text.savingNote')}
              </span>
            )}
            <button type="submit" disabled={disabled}>
              {L('common:action.save')}
            </button>
            <button type="button" disabled={disabled} onClick={onCancel}>
              {L('common:action.cancel')}
            </button>
          </div>
        </form>
      ) : canEditMemo ? (
        <p
          className={
            place.memo ? 'trip-place-memo' : 'trip-place-memo is-empty'
          }
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={L('place:placeDetailContent.ariaLabel.memo', {
            name: place.name,
            value: place.memo
              ? L('place:placeDetailContent.ariaLabel.edit')
              : L('common:action.add'),
          })}
          title={L('place:placeDetailContent.tooltip.doubleClickEdit')}
          onClick={onStartEditing}
          onDoubleClick={onStartEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onStartEditing();
            }
          }}
        >
          {place.memo ||
            L('place:placeDetailContent.description.doubleClickEnterNote')}
        </p>
      ) : (
        <p
          className={
            place.memo ? 'trip-place-memo' : 'trip-place-memo is-empty'
          }
        >
          {place.memo || L('place:placeDetailContent.description.noNotes')}
        </p>
      )}
    </section>
  );
}
