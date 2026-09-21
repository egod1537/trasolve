import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';

type Props = {
  id: string;
  children: ReactNode;
};

const recordRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  performance.measure(`trasolve:react:${id}`, {
    start: startTime,
    end: commitTime,
    detail: { phase, actualDuration, baseDuration },
  });
};

/** Records development-only React commits in the browser Performance timeline. */
export function RenderProfiler({ id, children }: Props) {
  if (!import.meta.env.DEV) {
    return children;
  }
  return (
    <Profiler id={id} onRender={recordRender}>
      {children}
    </Profiler>
  );
}
