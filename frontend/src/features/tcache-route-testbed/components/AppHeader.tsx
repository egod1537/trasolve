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
  { mode: 'system', label: '시스템', icon: 'desktop' },
  { mode: 'light', label: '라이트', icon: <SunIcon size={16} /> },
  { mode: 'dark', label: '다크', icon: 'moon' },
];

export function AppHeader({
  health,
  themeMode,
  onRefresh,
  onThemeChange,
}: AppHeaderProps) {
  const healthLabel =
    health === 'online'
      ? '온라인'
      : health === 'offline'
        ? '오프라인'
        : '확인 중';

  return (
    <Navbar className="tcache-testbed-navbar">
      <NavbarGroup align={Alignment.START}>
        <Button
          aria-label="테스트베드 목록으로 돌아가기"
          title="테스트베드 목록으로 돌아가기"
          icon="arrow-left"
          variant="minimal"
          onClick={() => window.location.assign('/testbed')}
        />
        <NavbarHeading>Trasolve · tcache Route Testbed</NavbarHeading>
        <NavbarDivider />
        <code className={`${Classes.MONOSPACE_TEXT} ${Classes.TEXT_MUTED}`}>
          {TCACHE_ROUTE_API.jobs}
        </code>
      </NavbarGroup>
      <NavbarGroup align={Alignment.END}>
        <span className={Classes.TEXT_MUTED}>tcache</span>
        <Tag
          aria-label={`tcache ${healthLabel}`}
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
          aria-label="tcache 상태 새로고침"
          title="tcache 상태 새로고침"
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
  const selected =
    THEME_OPTIONS.find((option) => option.mode === mode) ?? THEME_OPTIONS[0];
  return (
    <PopoverNext
      animation={PopoverAnimation.MINIMAL}
      arrow={false}
      content={
        <Menu aria-label="테마">
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
        aria-label={`테마: ${selected.label}`}
        title={`테마: ${selected.label}`}
        icon={selected.icon}
        variant="minimal"
      />
    </PopoverNext>
  );
}
