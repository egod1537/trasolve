import { useEffect, useRef } from 'react';
import { MapAiButton } from './MapAiButton';
import { MapAiPanel } from '../../../../shared/components/chat/MapAiPanel';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MapAiRegion({ open, onOpenChange }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open && wasOpenRef.current)
      buttonRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  return (
    <div className="map-ai-region">
      <MapAiButton
        ref={buttonRef}
        open={open}
        onClick={() => onOpenChange(!open)}
      />
      <MapAiPanel open={open} onClose={() => onOpenChange(false)} />
    </div>
  );
}
