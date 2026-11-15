import { useState } from 'react';
import type { PlaceDetailEditorOptions } from './placeDetailTypes';

type Options = Pick<
  PlaceDetailEditorOptions,
  | 'place'
  | 'busy'
  | 'readOnly'
  | 'onRename'
  | 'onUpdateMemo'
  | 'onUpdateVisitTimeRange'
  | 'onUpdatePreferredDuration'
> & {
  removing: boolean;
  onEditStart: () => void;
};
export function usePlaceDetailEdits({
  place,
  busy,
  readOnly = true,
  onRename,
  onUpdateMemo,
  onUpdateVisitTimeRange,
  onUpdatePreferredDuration,
  removing,
  onEditStart,
}: Options) {
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleSubmitting, setTitleSubmitting] = useState(false);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const disabled =
    (busy && !timeSubmitting) || titleSubmitting || memoSubmitting || removing;
  const canRename = !readOnly && onRename !== undefined;
  const canEditTime = !readOnly && onUpdateVisitTimeRange !== undefined;
  const canEditDuration = !readOnly && onUpdatePreferredDuration !== undefined;
  const canEditMemo = !readOnly && onUpdateMemo !== undefined;
  const saveTimeRange = async (time: string, visitDurationMinutes: number) => {
    if (disabled || timeSubmitting || !canEditTime) {
      return false;
    }
    if (
      place.time === time &&
      place.visitDurationMinutes === visitDurationMinutes
    ) {
      return true;
    }
    setTimeSubmitting(true);
    try {
      return await onUpdateVisitTimeRange(place.id, time, visitDurationMinutes);
    } finally {
      setTimeSubmitting(false);
    }
  };
  const startTitleEditing = () => {
    if (disabled || !canRename) {
      return;
    }
    onEditStart();
    setTitleEditing(true);
  };
  const saveTitle = async (draft: string) => {
    const nextName = draft.trim();
    if (!canRename || !nextName || nextName === place.name) {
      setTitleEditing(false);
      return;
    }

    setTitleSubmitting(true);
    try {
      await onRename(place.id, nextName);
    } finally {
      setTitleSubmitting(false);
      setTitleEditing(false);
    }
  };
  const startMemoEditing = () => {
    if (disabled || !canEditMemo) {
      return;
    }
    onEditStart();
    setMemoDraft(place.memo ?? '');
    setMemoEditing(true);
  };
  const cancelMemoEditing = () => {
    setMemoDraft(place.memo ?? '');
    setMemoEditing(false);
  };
  const saveMemo = async () => {
    if (disabled || !canEditMemo) {
      return;
    }
    const nextMemo = memoDraft.trim();
    if (nextMemo === (place.memo ?? '')) {
      setMemoEditing(false);
      return;
    }
    setMemoSubmitting(true);
    try {
      if (await onUpdateMemo(place.id, nextMemo)) {
        setMemoEditing(false);
      } else {
        cancelMemoEditing();
      }
    } finally {
      setMemoSubmitting(false);
    }
  };
  return {
    timeSubmitting,
    titleEditing,
    setTitleEditing,
    titleSubmitting,
    memoEditing,
    memoDraft,
    setMemoDraft,
    memoSubmitting,
    disabled,
    canRename,
    canEditTime,
    canEditDuration,
    canEditMemo,
    saveTimeRange,
    startTitleEditing,
    saveTitle,
    startMemoEditing,
    cancelMemoEditing,
    saveMemo,
  };
}
