import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { UiChatMessage } from '../../model/chatTypes';

/** Owns only the message viewport; jumping never scrolls the map or page. */
export function useChatMessageNavigation(
  messages: readonly UiChatMessage[],
  viewportRef: RefObject<HTMLDivElement | null>,
) {
  const questions = useMemo(
    () => messages.filter((message) => message.role === 'user'),
    [messages],
  );
  const [activeId, setActiveId] = useState<string>();
  const pinned = useRef(true);
  const browsingHistory = useRef(false);
  const lastQuestionId = questions.at(-1)?.id;

  // Sending a new question resumes following its response, even from history.
  useLayoutEffect(() => {
    pinned.current = true;
    browsingHistory.current = false;
  }, [lastQuestionId]);

  useActiveChatQuestion(viewportRef, lastQuestionId, setActiveId);

  const jump = (id: string) => {
    const viewport = viewportRef.current;
    const target = Array.from(
      viewport?.querySelectorAll<HTMLElement>('[data-chat-question]') ?? [],
    ).find((element) => element.dataset.chatQuestion === id);
    if (!viewport || !target) {
      return;
    }
    pinned.current = false;
    browsingHistory.current = true;
    setActiveId(id);
    viewport.scrollTo({
      top: Math.max(
        0,
        viewport.scrollTop +
          target.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top -
          24,
      ),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const onUserScroll = () => {
    browsingHistory.current = false;
    pinned.current = false;
  };
  const onScroll = () => {
    const viewport = viewportRef.current;
    if (viewport && !browsingHistory.current) {
      pinned.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 40;
    }
  };
  return { questions, activeId, pinned, jump, onUserScroll, onScroll };
}

function useActiveChatQuestion(
  viewportRef: RefObject<HTMLDivElement | null>,
  lastQuestionId: string | undefined,
  setActiveId: (id: string | undefined) => void,
) {
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    let frame = 0;
    const update = () => {
      const top = viewport.getBoundingClientRect().top + 32;
      const elements = viewport.querySelectorAll<HTMLElement>(
        '[data-chat-question]',
      );
      let current = elements[0]?.dataset.chatQuestion;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > top) {
          break;
        }
        current = element.dataset.chatQuestion;
      }
      // A short final answer cannot always bring its question to the top.
      if (
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        2
      ) {
        current = lastQuestionId;
      }
      setActiveId(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    if (viewport.firstElementChild) {
      observer.observe(viewport.firstElementChild);
    }
    viewport.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener('scroll', schedule);
    };
  }, [viewportRef, lastQuestionId, setActiveId]);
}
