import { commandFingerprint } from './commandFingerprint';
import { useState } from 'react';
import { workspaceCommandDefinitions } from '@trasolve/shared';
import { NL, useL } from '@/shared/i18n';
import { readCommandProposal } from './commandAi';
import { useCommandRuntime } from './CommandProvider';
import { useTripData } from '../hooks/useTrip';
export function WorkspaceCommandAction({
  content,
  requestContext,
}: {
  content: string;
  requestContext?: string;
}) {
  const runtime = useCommandRuntime();
  const trip = useTripData();
  const L = useL();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const command = readCommandProposal(content);
  if (!command) {
    return null;
  }
  let fingerprint: string | undefined;
  try {
    fingerprint = JSON.parse(requestContext ?? '{}').commandTrip;
  } catch {
    /* Invalid captured context cannot authorize a state change. */
  }
  const effect = workspaceCommandDefinitions.find(
    (d) => d.name === command.name,
  )!.effect;
  const stale = effect !== 'read' && fingerprint !== commandFingerprint(trip);
  const run = async () => {
    if (busy || done || stale) {
      return;
    }
    setBusy(true);
    try {
      await runtime.execute(command);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : NL('COMMAND_FAILED'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="trip-ai-plan">
      <code>{command.name}</code>
      <pre>{JSON.stringify(command.args, null, 2)}</pre>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy || done || stale || !runtime.available(command.name)}
        onClick={() => void run()}
      >
        {L('common:action.apply')}
      </button>
    </div>
  );
}
