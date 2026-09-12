import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TransitionEvent,
} from 'react';
import type { MapAiUnreadPreview } from '../../../../shared/components/chat/MapAiPanel';

type Props = {
  previews: MapAiUnreadPreview[];
  onOpen: (preview: MapAiUnreadPreview) => void;
};

type PreviewStyle = CSSProperties & {
  '--unread-preview-rank': number;
};

function toPreviewText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' 코드 ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-+*>]|\d+[.)])\s+/gm, '')
    .replace(/[*_~`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function MapAiUnreadPreviews({ previews, onOpen }: Props) {
  const [renderedPreviews, setRenderedPreviews] = useState(() =>
    previews.slice(0, 3),
  );
  const [motionState, setMotionState] = useState<
    'entering' | 'visible' | 'exiting'
  >(previews.length ? 'entering' : 'visible');
  const presentRef = useRef(previews.length > 0);
  const motionStateRef = useRef(motionState);
  const frameRef = useRef(0);
  const settleFrameRef = useRef(0);
  const exitTimerRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    cancelAnimationFrame(settleFrameRef.current);
    window.clearTimeout(exitTimerRef.current);
    frameRef.current = requestAnimationFrame(() => {
      if (previews.length) {
        setRenderedPreviews(previews.slice(0, 3));
        if (!presentRef.current) {
          presentRef.current = true;
          motionStateRef.current = 'entering';
          setMotionState('entering');
          settleFrameRef.current = requestAnimationFrame(() => {
            motionStateRef.current = 'visible';
            setMotionState('visible');
          });
        } else if (motionStateRef.current === 'entering') {
          settleFrameRef.current = requestAnimationFrame(() => {
            motionStateRef.current = 'visible';
            setMotionState('visible');
          });
        }
        return;
      }
      if (!presentRef.current) return;
      presentRef.current = false;
      motionStateRef.current = 'exiting';
      setMotionState('exiting');
      exitTimerRef.current = window.setTimeout(() => {
        setRenderedPreviews([]);
      }, 260);
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      cancelAnimationFrame(settleFrameRef.current);
      window.clearTimeout(exitTimerRef.current);
    };
  }, [previews]);

  const finishExit = (event: TransitionEvent<HTMLElement>) => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'transform' &&
      motionState === 'exiting' &&
      !presentRef.current
    ) {
      window.clearTimeout(exitTimerRef.current);
      setRenderedPreviews([]);
    }
  };

  if (!renderedPreviews.length) return null;

  return (
    <section
      className={`trip-map-ai-unread-previews is-${motionState}`}
      aria-label="확인하지 않은 AI 응답"
      onTransitionEnd={finishExit}
    >
      <ol>
        {renderedPreviews.map((preview, index) => (
          <li
            key={preview.messageId}
            style={{ '--unread-preview-rank': index } as PreviewStyle}
          >
            <button
              type="button"
              aria-label={`${preview.threadTitle}의 확인하지 않은 AI 응답 열기`}
              onClick={() => onOpen(preview)}
            >
              <span className="trip-map-ai-unread-title">
                {preview.threadTitle}
              </span>
              <span className="trip-map-ai-unread-content">
                {toPreviewText(preview.content)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
