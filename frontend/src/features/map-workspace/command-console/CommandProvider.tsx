import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createCommandRuntime,
  type CommandHandlers,
  type CommandRuntime,
} from './commandRuntime';
const Context = createContext<CommandRuntime | null>(null);
export function WorkspaceCommandProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [runtime] = useState(createCommandRuntime);
  useEffect(() => () => runtime.cancel(), [runtime]);
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}
export function useCommandRuntime() {
  const runtime = useContext(Context);
  if (!runtime) {
    throw new Error('COMMAND_PROVIDER_MISSING');
  }
  return runtime;
}
export function useCommandBindings(handlers: CommandHandlers) {
  const runtime = useCommandRuntime();
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const keys = Object.keys(handlers).sort().join('|');
  useEffect(
    () =>
      runtime.bind(
        Object.fromEntries(
          keys
            .split('|')
            .filter(Boolean)
            .map((key) => [
              key,
              (args, signal) => latest.current[key]!(args, signal),
            ]),
        ),
      ),
    [runtime, keys],
  );
}
