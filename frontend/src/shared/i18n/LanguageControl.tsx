import { useState, type ChangeEvent } from 'react';
import {
  SUPPORTED_LANGUAGES,
  getLanguage,
  setLanguage,
  type Language,
} from '@/shared/i18n/config';
import { useL } from '@/shared/i18n/L';
import { NL } from '@/shared/i18n/NL';

const LANGUAGE_LABELS: Record<Language, string> = {
  ko: NL('한국어'),
  ja: NL('日本語'),
  en: NL('English'),
  mn: NL('Монгол'),
};

type LanguageControlProps = {
  className?: string;
  showLabel?: boolean;
};

export function LanguageControl({
  className,
  showLabel = false,
}: LanguageControlProps) {
  const L = useL();
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootClassName = ['language-control', className]
    .filter(Boolean)
    .join(' ');

  const handleChange = async (
    event: ChangeEvent<HTMLSelectElement>,
  ): Promise<void> => {
    const nextLanguage = event.target.value as Language;
    setChanging(true);
    setError(null);
    try {
      await setLanguage(nextLanguage);
    } catch {
      setError(L('common:languageControl.error.failedChangeLanguage'));
    } finally {
      setChanging(false);
    }
  };

  return (
    <label className={rootClassName}>
      <span className={showLabel ? 'language-control-label' : 'sr-only'}>
        {L('common:languageControl.label.language')}
      </span>
      <select
        aria-label={L('common:languageControl.ariaLabel.selectLanguage')}
        disabled={changing}
        value={getLanguage()}
        onChange={(event) => void handleChange(event)}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_LABELS[language]}
          </option>
        ))}
      </select>
      {error ? (
        <span className="language-control-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
