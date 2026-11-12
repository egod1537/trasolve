import { usePlaceDetailEdits } from '../model/usePlaceDetailEdits';
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { resolvePlaceStyle } from '@/entities/place';
import { usePlaceDetails } from '@/features/place-editor/model/usePlaceDetails';

import { useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { type Props } from '@/features/place-editor/ui/placeDetailContentTypes';

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
  const onEditStart = useCallback(() => setDeleteConfirmOpen(false), []);
  const edits = usePlaceDetailEdits({
    place,
    busy,
    readOnly,
    onRename,
    onUpdateMemo,
    onUpdateVisitTimeRange,
    onUpdatePreferredDuration,
    removing,
    onEditStart,
  });
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
    if (!edits.memoEditing) {
      return;
    }
    const textarea = memoTextareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [edits.memoEditing]);
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
    if (edits.disabled || !canRemove) {
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
    ...edits,
    L,
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
    canEditStyle,
    canRemove,
    googlePlace,
    placeStyle,
    openingHours,
    openingHoursLoadState,
    closeDeleteConfirmation,
    confirmRemove,
  };
}
