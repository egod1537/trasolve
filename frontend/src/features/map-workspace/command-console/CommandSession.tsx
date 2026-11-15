import { useTripSnapshotReader } from '../hooks/useTrip';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createEditCommands, type EditCommandContext } from './editCommands';
import { useCommandBindings, useCommandRuntime } from './CommandProvider';
const Context = createContext<EditCommandContext | null>(null);
export function CommandSession({
  trip,
  controller,
  ui,
  children,
}: Omit<EditCommandContext, 'currentTrip'> & { children: ReactNode }) {
  const currentTrip = useTripSnapshotReader();
  const context = { trip, controller, ui, currentTrip };
  const runtime = useCommandRuntime();
  useEffect(
    () => runtime.guardNavigation(() => controller.save()),
    [controller, runtime],
  );
  useCommandBindings(createEditCommands(context));
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useCommandSession() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('COMMAND_SESSION_REQUIRED');
  }
  return ctx;
}
