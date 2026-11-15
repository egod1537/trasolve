import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import type { TutorialProgress } from '@trasolve/shared';
import { readTutorial, writeTutorial } from '../api/tutorialApi';

export function useTutorialProgress(
  userId: string,
  onLoaded: (progress: TutorialProgress | null) => void,
) {
  const loaded = useEffectEvent(onLoaded);
  const [initial, setInitial] = useState<TutorialProgress | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, reload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef<TutorialProgress | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void readTutorial(userId, controller.signal)
      .then((progress) => {
        if (!controller.signal.aborted) {
          setInitial(progress);
          setError(false);
          loaded(progress);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          loaded(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [userId, revision]);

  const save = useCallback(
    (progress: TutorialProgress) => {
      setInitial(progress);
      pending.current = progress;
      const controller = lifetime.current;
      queue.current = queue.current.then(async () => {
        if (!controller || controller.signal.aborted) {
          return;
        }
        try {
          await writeTutorial(userId, progress, controller.signal);
          if (!controller.signal.aborted && pending.current === progress) {
            pending.current = null;
            setError(false);
          }
        } catch {
          if (!controller.signal.aborted) {
            setError(true);
          }
        }
      });
    },
    [userId],
  );

  const retry = useCallback(() => {
    if (pending.current) {
      save(pending.current);
    } else {
      setLoading(true);
      reload((value) => value + 1);
    }
  }, [save]);

  return { initial, error, loading, save, retry };
}
