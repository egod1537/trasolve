import { useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { useL } from '@/shared/i18n';

type DeveloperToolsProps = {
  trip: Trip;
  status: string;
  selectedDayId: string | null;
  selectedPlaceIds: readonly string[];
};

export default function AiDeveloperTools({
  trip,
  status,
  selectedDayId,
  selectedPlaceIds,
}: DeveloperToolsProps) {
  const L = useL();
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | null>(null);
  const day =
    trip.days.find((value) => value.id === selectedDayId) ?? trip.days[0];
  const place =
    trip.days
      .flatMap((value) => value.places)
      .find((value) => selectedPlaceIds.includes(value.id)) ?? day?.places[0];
  // Copy only: these examples never submit a request or modify a Trip.
  const presets = [
    `여행 제목을 ${JSON.stringify(trip.title + ' · Debug')}로 변경하는 Plan을 제안해 줘.`,
    ...(day
      ? [
          `Day ID ${JSON.stringify(day.id)} (${JSON.stringify(day.title)})의 제목을 ${JSON.stringify(day.title + ' · Debug')}로 변경하는 Plan을 제안해 줘.`,
        ]
      : []),
    ...(place
      ? [
          `Place ID ${JSON.stringify(place.id)} (${JSON.stringify(place.name)})의 메모를 "Debug memo"로 변경하는 Plan을 제안해 줘.`,
        ]
      : []),
  ];
  const diagnostics = {
    tripId: trip.id,
    selectedDayId,
    selectedPlaceIds,
    saveStatus: status,
    provider: null,
    providerSource: 'NOT_EXPOSED_BY_CLIENT_STATE',
  };
  const guide = {
    execution: 'MANUAL_ONLY / NO_AUTOMATIC_REQUESTS',
    flow: [
      'Copy preset → AI chat input → Send',
      'Preview → Apply → canonical reload',
    ],
    cancel: 'Preview → Cancel; PUT 0; Trip unchanged',
    isolation:
      'Trip A → Chat A → Trip B → Chat B → reopen A/B; messages and request selection remain isolated',
    concurrency:
      '/testbed/ai-chat → 3 sessions → independent requests; inspect response ownership',
    network: [
      'POST /api/chat: response / error',
      'PUT /api/trips/:id: If-Match / status (412 conflict)',
      'GET /api/trips/:id: ETag / canonical state',
    ],
    recovery: 'UNKNOWN → canonical GET; no blind Apply retry',
    evidence: 'NOT_A_TEST_RESULT',
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };
  return (
    <details
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 'calc(var(--z-dialog) + 10)',
        width: 'min(420px, 90vw)',
        maxHeight: '80vh',
        overflow: 'auto',
        padding: 12,
        background: 'var(--color-bg, white)',
        color: 'var(--color-text, black)',
        boxShadow: 'var(--shadow-map-overlay)',
      }}
    >
      <summary>
        {L('testbed:aiChatTestPage.aiChatTestContent.title.aiChatTestBed')}
      </summary>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
      {presets.map((prompt) => (
        <div key={prompt}>
          <p>{prompt}</p>
          <button type="button" onClick={() => void copy(prompt)}>
            {L('common:action.copy')}
          </button>
        </div>
      ))}
      {copyStatus && (
        <p role={copyStatus === 'error' ? 'alert' : 'status'}>
          {copyStatus === 'error'
            ? L('trip:shareTripModal.text.copyFailed')
            : L('trip:shareTripModal.text.copied')}
        </p>
      )}
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(guide, null, 2)}
      </pre>
      <a href="/testbed/ai-chat">
        {L('testbed:aiChatTestPage.aiChatTestContent.title.aiChatTestBed')}
      </a>
    </details>
  );
}
