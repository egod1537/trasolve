import { useCallback } from 'react';
import { type TOptions } from 'i18next';
import { useTranslation } from 'react-i18next';
import { localizationInstance } from './config';

export type LocalizationOptions = TOptions;
export type Localize = (
  locKey: string,
  options?: LocalizationOptions,
) => string;

function localizedValue(value: unknown, locKey: string): string {
  return typeof value === 'string' ? value : locKey;
}

export const L: Localize = (locKey, options) =>
  localizedValue(localizationInstance.t(locKey, options), locKey);

export function useL(): Localize {
  const { t } = useTranslation();
  return useCallback(
    (locKey, options) => localizedValue(t(locKey, options), locKey),
    [t],
  );
}
