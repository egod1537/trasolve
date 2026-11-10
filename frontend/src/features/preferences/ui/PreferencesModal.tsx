import { useId, useState } from 'react';
import { ANALYTICS_SCREENS } from '@trasolve/shared';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import {
  getLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  useL,
  type Language,
  type Localize,
} from '@/shared/i18n';
import { useTheme } from '@/shared/theme/useTheme';
import type { ThemeMode } from '@/shared/theme/theme';
import { requiresGoogleMapsReload } from '@/map/locale';
import '@/features/preferences/ui/preferences-modal.css';
import { useScreenView } from '@/shared/analytics';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
const THEME_ICON_PATHS: Record<ThemeMode, string> = {
  system: 'M4 4h16v12H4z M8 20h8 M12 16v4',
  light:
    'M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M19 5l-1.5 1.5 M6.5 17.5 5 19',
  dark: 'M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z',
};

type Props = {
  onClose: () => void;
};

export function PreferencesModal({ onClose }: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.preferences);
  const { themeMode, setThemeMode } = useTheme();
  const [changingLanguage, setChangingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const titleId = useId();
  const languageId = useId();
  const currentThemeLabel = getThemeLabel(L, themeMode);

  const handleLanguageChange = async (language: Language): Promise<void> => {
    setChangingLanguage(true);
    setLanguageError(null);
    try {
      await setLanguage(language);
      if (requiresGoogleMapsReload(language)) {
        window.location.reload();
      }
    } catch {
      setLanguageError(L('common:languageControl.error.failedChangeLanguage'));
    } finally {
      setChangingLanguage(false);
    }
  };

  return (
    <Dialog
      className="preferences-popup"
      backdropClassName="preferences-backdrop"
      labelledBy={titleId}
      onClose={onClose}
    >
      <header className="preferences-header">
        <h2 id={titleId}>{L('auth:mapUserControls.text.preferences')}</h2>
        <IconButton
          className="preferences-close"
          aria-label={L('common:action.close')}
          title={L('common:action.close')}
          variant="ghost"
          size="sm"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </header>

      <div className="preferences-form">
        <fieldset className="preferences-group">
          <legend>
            {L('common:themeControl.ariaLabel.theme', {
              label: currentThemeLabel,
            })}
          </legend>
          <div className="preferences-theme-options">
            {THEME_MODES.map((mode) => (
              <label className="preferences-theme-option" key={mode}>
                <input
                  type="radio"
                  name="theme"
                  value={mode}
                  checked={themeMode === mode}
                  onChange={() => setThemeMode(mode)}
                />
                <span className="preferences-theme-choice">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={THEME_ICON_PATHS[mode]} />
                  </svg>
                  <span>{getThemeLabel(L, mode)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="preferences-group">
          <label className="preferences-language-label" htmlFor={languageId}>
            {L('common:languageControl.label.language')}
          </label>
          <select
            id={languageId}
            className="ui-select"
            value={getLanguage()}
            disabled={changingLanguage}
            aria-busy={changingLanguage || undefined}
            onChange={(event) =>
              void handleLanguageChange(event.target.value as Language)
            }
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {getLanguageLabel(L, language)}
              </option>
            ))}
          </select>
          {languageError ? (
            <p className="preferences-error" role="alert">
              {languageError}
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function getThemeLabel(L: Localize, mode: ThemeMode): string {
  switch (mode) {
    case 'system':
      return L('common:themeControl.themeOptions.label.system');
    case 'light':
      return L('common:themeControl.themeOptions.label.light');
    case 'dark':
      return L('common:themeControl.themeOptions.label.dark');
  }
}

function getLanguageLabel(L: Localize, language: Language): string {
  switch (language) {
    case 'ko':
      return L('common:languageControl.language.ko');
    case 'ja':
      return L('common:languageControl.language.ja');
    case 'en':
      return L('common:languageControl.language.en');
    case 'mn':
      return L('common:languageControl.language.mn');
  }
}
