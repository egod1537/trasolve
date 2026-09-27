import {
  Alignment,
  Button,
  Classes,
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
import type { ReactElement } from 'react';
import { TCACHE_ROUTE_API } from '@/features/tcache-route-testbed/api/tcacheRoute';
import type { TcacheHealthState } from '@/features/tcache-route-testbed/model/types';
import type { ThemeMode } from '@/shared/theme/theme';
import { useL, L, NL } from '@/shared/i18n';

interface AppHeaderProps {
  health: TcacheHealthState;
  themeMode: ThemeMode;
  onRefresh: () => void;
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
  onRefresh,
  onThemeChange,
}: AppHeaderProps) {
  const L = useL();
  const healthLabel =
    health === 'online'
      ? L('testbed:appHeader.text.online')
      : health === 'offline'
        ? L('testbed:appHeader.text.offline')
        : L('testbed:appHeader.text.checking');

  return (
    <Navbar className="tcache-testbed-navbar">
      <NavbarGroup align={Alignment.START}>
        <Button
          aria-label={L('testbed:appHeader.ariaLabel.returnTestbedList')}
          title={L('testbed:appHeader.ariaLabel.returnTestbedList')}
          icon="arrow-left"
          variant="minimal"
          onClick={() => window.location.assign('/testbed')}
        />
        <NavbarHeading>
          {L('testbed:appHeader.text.trasolveTcacheRouteTestbed')}
        </NavbarHeading>
        <NavbarDivider />
        <code className={`${Classes.MONOSPACE_TEXT} ${Classes.TEXT_MUTED}`}>
          {TCACHE_ROUTE_API.jobs}
        </code>
      </NavbarGroup>
      <NavbarGroup align={Alignment.END}>
        <span className={Classes.TEXT_MUTED}>{NL('tcache')}</span>
        <Tag
          aria-label={L('testbed:appHeader.ariaLabel.tcache', {
            healthLabel: healthLabel,
          })}
          icon={
            health === 'online'
              ? 'tick-circle'
              : health === 'offline'
                ? 'error'
                : 'time'
          }
          intent={
            health === 'online'
              ? 'success'
              : health === 'offline'
                ? 'danger'
                : 'primary'
          }
          minimal
        >
          {healthLabel}
        </Tag>
        <Button
          aria-label={L('testbed:appHeader.ariaLabel.refreshTcacheStatus')}
          title={L('testbed:appHeader.ariaLabel.refreshTcacheStatus')}
          icon="refresh"
          loading={health === 'checking'}
          disabled={health === 'checking'}
          variant="minimal"
          onClick={onRefresh}
        />
        <ThemeMenu mode={themeMode} onChange={onThemeChange} />
      </NavbarGroup>
    </Navbar>
  );
}

function ThemeMenu({
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
