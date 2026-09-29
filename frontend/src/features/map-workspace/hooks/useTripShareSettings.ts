import { useCallback, useEffect, useState } from 'react';
import type {
  TripShareSettings,
  UpdateTripShareRequest,
} from '@trasolve/shared';
import {
  getTripShareSettings,
  updateTripShareSettings,
} from '@/shared/api/tripSharing';
import { useL } from '@/shared/i18n';

type TripShareSettingsState = {
  settings: TripShareSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveSettings: (
    input: UpdateTripShareRequest,
  ) => Promise<TripShareSettings | null>;
};

export function useTripShareSettings(tripId: string): TripShareSettingsState {
  const L = useL();
  const [settings, setSettings] = useState<TripShareSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getTripShareSettings(tripId, controller.signal)
      .then((nextSettings) => {
        setSettings(nextSettings);
        setError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(L('trip:shareTripModal.error.loadFailed'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [L, tripId]);

  const saveSettings = useCallback(
    async (
      input: UpdateTripShareRequest,
    ): Promise<TripShareSettings | null> => {
      setSaving(true);
      setError(null);
      try {
        const nextSettings = await updateTripShareSettings(tripId, input);
        setSettings(nextSettings);
        return nextSettings;
      } catch {
        setError(L('trip:shareTripModal.error.updateFailed'));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [L, tripId],
  );

  return { settings, loading, saving, error, saveSettings };
}
