import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MapAiButton } from '@/features/ai-chat/ui/MapAiButton';
import {
  MapAiPanel,
  type ChatRequestPreamble,
  type MapAiPanelHandle,
  type MapAiUnreadPreview,
} from '@/features/ai-chat/ui/MapAiPanel';
import { MapAiUnreadPreviews } from '@/features/ai-chat/ui/MapAiUnreadPreviews';

type Props = {
  mobileScreen?: boolean;
  open: boolean;
  singleSession?: boolean;
  persistenceKey?: string;
  getRequestPreamble?: (userRequest: string) => Promise<ChatRequestPreamble>;
  renderAssistantActions?: (content: string, context?: string) => ReactNode;
  notice?: ReactNode;
  onOpenChange: (open: boolean) => void;
};

const noUnreadPreviews: MapAiUnreadPreview[] = [];

export function MapAiRegion({
  mobileScreen = false,
  open,
  singleSession,
  persistenceKey,
  onOpenChange,
  getRequestPreamble,
  renderAssistantActions,
  notice,
}: Props) {
  const mobile = useLayoutMaxWidth();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<MapAiPanelHandle>(null);
  const wasOpenRef = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [unreadPreviews, setUnreadPreviews] = useState<MapAiUnreadPreview[]>(
    [],
  );
  useEffect(() => {
    if (!open && wasOpenRef.current) {
      buttonRef.current?.focus({ preventScroll: true });
    }
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
    <div
      className="map-ai-region"
      onKeyDown={(event) => {
        if (open && singleSession && event.key === 'Escape') {
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <MapAiButton
        tutorialTarget={!mobileScreen}
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
        modal={mobile && !mobileScreen}
        ref={panelRef}
        singleSession={singleSession}
        persistenceKey={persistenceKey}
        getRequestPreamble={getRequestPreamble}
        renderAssistantActions={renderAssistantActions}
        notice={notice}
        open={open}
        onClose={() => onOpenChange(false)}
        onGeneratingChange={setGenerating}
        onUnreadPreviewsChange={setUnreadPreviews}
      />
    </div>
  );
}
