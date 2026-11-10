import { createContext, useContext } from 'react';

export const LoginDialogContext = createContext<
  ((returnTo: string, linking?: boolean) => void) | null
>(null);

export function useLoginDialog() {
  const open = useContext(LoginDialogContext);
  if (!open) {
    throw new Error('Login dialog provider is missing.');
  }
  return open;
}
