import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useL } from '@/shared/i18n';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import type { UiChatMessage } from '../../model/chatTypes';
import './chat-v2-quick-nav.css';

type Props = {
  questions: readonly UiChatMessage[];
  activeId?: string;
  onJump: (id: string) => void;
};

export function ChatV2QuickNav({ questions, activeId, onJump }: Props) {
  const L = useL();
  const tooltipId = useId();
  const navRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const held = useRef(false);
  const [preview, setPreview] = useState<{ id: string; top: number }>();
  const question = questions.find((item) => item.id === preview?.id);
  const cancelHold = () => clearTimeout(holdTimer.current);
  useEffect(() => cancelHold, []);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const button = navRef.current?.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    if (!viewport || !button) {
      return;
    }
    const box = button.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    if (box.top < bounds.top || box.bottom > bounds.bottom) {
      viewport.scrollTop +=
        box.top - bounds.top - bounds.height / 2 + box.height / 2;
    }
  }, [activeId]);
  if (questions.length < 2) {
    return null;
  }
  const showPreview = (button: HTMLButtonElement, id: string) => {
    const nav = navRef.current;
    if (nav) {
      setPreview({
        id,
        top: Math.min(
          button.getBoundingClientRect().top - nav.getBoundingClientRect().top,
          nav.clientHeight - 70,
        ),
      });
    }
  };
  return (
    <nav
      ref={navRef}
      className="chat-v2-quick-nav"
      aria-label={L('ai:mapAiPanel.ariaLabel.currentConversation')}
      onPointerLeave={() => {
        cancelHold();
        setPreview(undefined);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPreview(undefined);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && preview) {
          event.stopPropagation();
          setPreview(undefined);
          return;
        }
        moveQuestionFocus(event, (button, index) =>
          showPreview(button, questions[index].id),
        );
      }}
    >
      <ScrollArea
        viewportRef={viewportRef}
        className="chat-v2-quick-nav-scroll"
        contentClassName="chat-v2-quick-nav-marks"
        viewportProps={{
          tabIndex: -1,
          onScroll: (event) => {
            const button = document.activeElement;
            if (
              button instanceof HTMLButtonElement &&
              event.currentTarget.contains(button) &&
              button.dataset.chatQuestion
            ) {
              showPreview(button, button.dataset.chatQuestion);
            } else {
              setPreview(undefined);
            }
          },
        }}
      >
        {questions.map((item) => (
          <button
            key={item.id}
            type="button"
            data-chat-question={item.id}
            aria-label={item.content}
            aria-current={item.id === activeId ? 'location' : undefined}
            aria-describedby={item.id === preview?.id ? tooltipId : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') {
                showPreview(event.currentTarget, item.id);
              }
            }}
            onFocus={(event) => showPreview(event.currentTarget, item.id)}
            onPointerDown={(event) => {
              held.current = false;
              if (event.pointerType === 'touch') {
                const button = event.currentTarget;
                holdTimer.current = setTimeout(() => {
                  held.current = true;
                  showPreview(button, item.id);
                }, 450);
              }
            }}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerMove={cancelHold}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (!held.current) {
                onJump(item.id);
              }
              held.current = false;
            }}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </ScrollArea>
      {question && (
        <div
          id={tooltipId}
          role="tooltip"
          className="chat-v2-quick-nav-preview"
          style={{ top: preview?.top }}
        >
          <strong>{questions.indexOf(question) + 1}</strong>
          <span>{question.content}</span>
        </div>
      )}
    </nav>
  );
}

function moveQuestionFocus(
  event: KeyboardEvent<HTMLElement>,
  onPreview: (button: HTMLButtonElement, index: number) => void,
) {
  const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowDown'
          ? Math.min(index + 1, buttons.length - 1)
          : event.key === 'ArrowUp'
            ? Math.max(index - 1, 0)
            : undefined;
  if (next !== undefined) {
    event.preventDefault();
    buttons[next]?.focus({ preventScroll: true });
    const viewport = event.currentTarget.querySelector('.ui-scroll-viewport');
    const button = buttons[next];
    if (viewport && button) {
      viewport.scrollTop +=
        button.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        viewport.clientHeight / 2 +
        button.clientHeight / 2;
      onPreview(button, next);
    }
  }
}
