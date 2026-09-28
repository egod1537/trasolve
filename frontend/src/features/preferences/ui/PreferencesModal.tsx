import { useId, useState } from 'react';
import { Button } from '@/shared/ui/Button';
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
import { requiresGoogleMapsReload } from '@/map/runtime/googleMaps';
import '@/features/preferences/ui/preferences-modal.css';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

type Props = {
  onClose: () => void;
};

export function PreferencesModal({ onClose }: Props) {
  const L = useL();
  const { themeMode, setThemeMode } = useTheme();
  const [changingLanguage, setChangingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const titleId = useId();
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

      <form className="preferences-form">
        <fieldset className="preferences-group">
          <legend>
            {L('common:themeControl.ariaLabel.theme', {
              label: currentThemeLabel,
            })}
          </legend>
          <div className="preferences-options">
            {THEME_MODES.map((mode) => (
              <label className="preferences-option" key={mode}>
                <input
                  type="radio"
                  name="theme"
                  value={mode}
                  checked={themeMode === mode}
                  onChange={() => setThemeMode(mode)}
                />
                <span>{getThemeLabel(L, mode)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="preferences-group">
          <legend>{L('common:languageControl.label.language')}</legend>
          <div className="preferences-options">
            {SUPPORTED_LANGUAGES.map((language) => (
              <label className="preferences-option" key={language}>
                <input
                  type="radio"
                  name="language"
                  value={language}
                  checked={getLanguage() === language}
                  disabled={changingLanguage}
                  onChange={() => void handleLanguageChange(language)}
                />
                <span>{getLanguageLabel(L, language)}</span>
              </label>
            ))}
          </div>
          {languageError ? (
            <p className="preferences-error" role="alert">
              {languageError}
            </p>
          ) : null}
        </fieldset>
      </form>

      <footer className="preferences-actions">
        <Button variant="secondary" onClick={onClose}>
          {L('common:action.close')}
        </Button>
      </footer>
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
