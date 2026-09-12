import { useCallback, useEffect, useRef, useState } from 'react';
import { MapAiButton } from './MapAiButton';
import {
  MapAiPanel,
  type MapAiPanelHandle,
  type MapAiUnreadPreview,
} from '../../../../shared/components/chat/MapAiPanel';
import { MapAiUnreadPreviews } from './MapAiUnreadPreviews';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const noUnreadPreviews: MapAiUnreadPreview[] = [];

export function MapAiRegion({ open, onOpenChange }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<MapAiPanelHandle>(null);
  const wasOpenRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [unreadPreviews, setUnreadPreviews] = useState<MapAiUnreadPreview[]>(
    [],
  );
  useEffect(() => {
    if (!open && wasOpenRef.current)
      buttonRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);
  const togglePanel = useCallback(() => {
    if (open) {
      onOpenChange(false);
      return;
    }
    panelRef.current?.viewSelectedThread();
    onOpenChange(true);
  }, [onOpenChange, open]);
  const openPreview = useCallback(
    (preview: MapAiUnreadPreview) => {
      panelRef.current?.viewThread(preview.threadId);
      onOpenChange(true);
    },
    [onOpenChange],
  );

  return (
    <div className="map-ai-region">
      <MapAiButton
        ref={buttonRef}
        open={open}
        generating={generating}
        onClick={togglePanel}
      />
      <MapAiUnreadPreviews
        previews={open ? noUnreadPreviews : unreadPreviews}
        onOpen={openPreview}
      />
      <MapAiPanel
        ref={panelRef}
        open={open}
        onGeneratingChange={setGenerating}
        onUnreadPreviewsChange={setUnreadPreviews}
      />
    </div>
  );
}
