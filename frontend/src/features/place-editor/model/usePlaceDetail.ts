import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { resolvePlaceStyle } from '@/entities/place';
import { usePlaceDetails } from '@/features/place-editor/model/usePlaceDetails';

import { useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { type Props } from '@/features/place-editor/model/placeDetailTypes';

export function usePlaceDetail({
  day,
  place,
  busy,
  readOnly = true,
  layerDetail = false,
  cardRef,
  onClose,
  onUpdateVisitTimeRange,
  onUpdatePreferredDuration,
  onUpdateMemo,
  onRename,
  onUpdateStyle,
  onRemove,
}: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.placeDetail);
  const details = usePlaceDetails(place.placeId);
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleSubmitting, setTitleSubmitting] = useState(false);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [openingHoursDetailOpen, setOpeningHoursDetailOpen] = useState(false);
  const deleteConfirmId = useId();
  const openingHoursCardId = useId();
  const cardGroupRef = useRef<HTMLDivElement>(null);
  const internalMainCardRef = useRef<HTMLElement>(null);
  const mainCardRef = cardRef ?? internalMainCardRef;
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled =
    (busy && !timeSubmitting) || titleSubmitting || memoSubmitting || removing;
  const canRename = !readOnly && onRename !== undefined;
  const canEditTime = !readOnly && onUpdateVisitTimeRange !== undefined;
  const canEditDuration = !readOnly && onUpdatePreferredDuration !== undefined;
  const canEditMemo = !readOnly && onUpdateMemo !== undefined;
  const canEditStyle = !readOnly && onUpdateStyle !== undefined;
  const canRemove = !readOnly && onRemove !== undefined;
  const googlePlace = details.status === 'loaded' ? details.place : null;
  const placeStyle = resolvePlaceStyle(place.placeStyle, day.color);
  const openingHours = googlePlace?.openingHours ?? place.openingHours;
  const openingHoursLoadState: 'ready' | 'loading' | 'error' = !place.placeId
    ? 'ready'
    : details.status === 'error'
      ? 'error'
      : details.status === 'loaded'
        ? 'ready'
        : 'loading';
  useLayoutEffect(() => {
    if (!memoEditing) {
      return;
    }
    const textarea = memoTextareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [memoEditing]);
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
    setDeleteConfirmOpen(false);
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
    setDeleteConfirmOpen(false);
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
  const closeDeleteConfirmation = (restoreFocus: boolean) => {
    if (removing) {
      return;
    }
    setDeleteConfirmOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => deleteTriggerRef.current?.focus());
    }
  };
  const confirmRemove = async () => {
    if (disabled || !canRemove) {
      return;
    }
    setRemoving(true);
    try {
      if (await onRemove(place.id)) {
        trackEvent({
          eventType: 'remove_place',
          screen: ANALYTICS_SCREENS.placeDetail,
          target: ANALYTICS_TARGETS.removePlace,
          metadata: {
            source: layerDetail ? 'layer_detail' : 'map_detail',
            success: true,
          },
        });
        setDeleteConfirmOpen(false);
        onClose();
      }
    } finally {
      setRemoving(false);
    }
  };
  return {
    L,
    timeSubmitting,
    titleEditing,
    setTitleEditing,
    titleSubmitting,
    memoEditing,
    memoDraft,
    setMemoDraft,
    memoSubmitting,
    removing,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    openingHoursDetailOpen,
    setOpeningHoursDetailOpen,
    deleteConfirmId,
    openingHoursCardId,
    cardGroupRef,
    mainCardRef,
    deleteTriggerRef,
    memoTextareaRef,
    disabled,
    canRename,
    canEditTime,
    canEditDuration,
    canEditMemo,
    canEditStyle,
    canRemove,
    googlePlace,
    placeStyle,
    openingHours,
    openingHoursLoadState,
    saveTimeRange,
    startTitleEditing,
    saveTitle,
    startMemoEditing,
    cancelMemoEditing,
    saveMemo,
    closeDeleteConfirmation,
    confirmRemove,
  };
}
