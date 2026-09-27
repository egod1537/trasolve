import {
  Alignment,
  Button,
  Classes,
  Intent,
  Menu,
  MenuItem,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  PopoverAnimation,
  PopoverNext,
  Tag,
} from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/icons';
import { SunIcon } from '@blueprintjs/icons/next';
import { API_ROUTES } from '@trasolve/shared';
import type { ReactElement } from 'react';
import type { ThemeMode } from '@/shared/theme/theme';
import { useL, L, NL } from '@/shared/i18n';

export type HealthState = 'checking' | 'online' | 'offline';

interface AppHeaderProps {
  health: HealthState;
  themeMode: ThemeMode;
  onRefreshHealth: () => void;
  onThemeChange: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: readonly {
  mode: ThemeMode;
  label: string;
  icon: IconName | ReactElement;
}[] = [
  {
    mode: 'system',
    get label() {
      return L('testbed:appHeader.tHEMEOPTIONS.label.system');
    },
    icon: 'desktop',
  },
  {
    mode: 'light',
    get label() {
      return L('testbed:appHeader.tHEMEOPTIONS.label.light');
    },
    icon: <SunIcon size={16} />,
  },
  {
    mode: 'dark',
    get label() {
      return L('testbed:appHeader.tHEMEOPTIONS.label.dark');
    },
    icon: 'moon',
  },
];

export function AppHeader({
  health,
  themeMode,
  onRefreshHealth,
  onThemeChange,
}: AppHeaderProps) {
  const L = useL();
  const healthLabel =
    health === 'online'
      ? L('testbed:appHeader.text.normal')
      : health === 'offline'
        ? L('testbed:appHeader.text.connectionFailed')
        : L('testbed:appHeader.text.checking');

  return (
    <Navbar className="app-navbar troute-testbed-navbar">
      <NavbarGroup align={Alignment.START}>
        <Button
          aria-label={L('testbed:appHeader.ariaLabel.returnTestbedList')}
          title={L('testbed:appHeader.ariaLabel.returnTestbedList')}
          icon="arrow-left"
          variant="minimal"
          onClick={() => window.location.assign('/testbed')}
        />
        <NavbarHeading>
          {L('testbed:appHeader.text.trasolveTestbed')}
        </NavbarHeading>
        <NavbarDivider />
        <code
          className={`${Classes.MONOSPACE_TEXT} ${Classes.TEXT_MUTED} navbar-endpoint`}
        >
          {L('testbed:appHeader.text.apiPost')}
          {API_ROUTES.trouteOptimize}
        </code>
      </NavbarGroup>
      <NavbarGroup align={Alignment.END}>
        <span className={`${Classes.TEXT_MUTED} navbar-api-label`}>
          {NL('API')}
        </span>
        <Tag
          aria-label={L('testbed:appHeader.ariaLabel.api', {
            healthLabel: healthLabel,
          })}
          icon={
            health === 'online'
              ? 'tick-circle'
              : health === 'offline'
                ? 'error'
                : 'time'
          }
          intent={healthIntent(health)}
          minimal
        >
          {healthLabel}
        </Tag>
        <Button
          aria-label={L('testbed:appHeader.ariaLabel.refreshApiStatus')}
          title={L('testbed:appHeader.ariaLabel.refreshApiStatus')}
          icon="refresh"
          loading={health === 'checking'}
          disabled={health === 'checking'}
          variant="minimal"
          onClick={onRefreshHealth}
        />
        <BlueprintThemeControl mode={themeMode} onChange={onThemeChange} />
      </NavbarGroup>
    </Navbar>
  );
}

function BlueprintThemeControl({
  mode,
  onChange,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const L = useL();
  const selected =
    THEME_OPTIONS.find((option) => option.mode === mode) ?? THEME_OPTIONS[0];

  return (
    <PopoverNext
      animation={PopoverAnimation.MINIMAL}
      arrow={false}
      content={
        <Menu aria-label={L('testbed:appHeader.themeMenu.ariaLabel.theme')}>
          {THEME_OPTIONS.map((option) => (
            <MenuItem
              active={mode === option.mode}
              icon={option.icon}
              key={option.mode}
              text={option.label}
              onClick={() => onChange(option.mode)}
            />
          ))}
        </Menu>
      }
      inheritDarkTheme
      placement="bottom-end"
    >
      <Button
        aria-label={L('testbed:appHeader.themeMenu.ariaLabel.theme2', {
          label: selected.label,
        })}
        title={L('testbed:appHeader.themeMenu.ariaLabel.theme2', {
          label: selected.label,
        })}
        icon={selected.icon}
        variant="minimal"
      />
    </PopoverNext>
  );
}

function healthIntent(health: HealthState): Intent {
  if (health === 'online') {
    return Intent.SUCCESS;
  }
  if (health === 'offline') {
    return Intent.DANGER;
  }
  return Intent.PRIMARY;
}
