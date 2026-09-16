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
import type { ThemeMode } from '../../../../shared/theme/theme';

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
  { mode: 'system', label: '시스템', icon: 'desktop' },
  { mode: 'light', label: '라이트', icon: <SunIcon size={16} /> },
  { mode: 'dark', label: '다크', icon: 'moon' },
];

export function AppHeader({
  health,
  themeMode,
  onRefreshHealth,
  onThemeChange,
}: AppHeaderProps) {
  const healthLabel =
    health === 'online'
      ? '정상'
      : health === 'offline'
        ? '연결 실패'
        : '확인 중';

  return (
    <Navbar className="app-navbar troute-testbed-navbar">
      <NavbarGroup align={Alignment.START}>
        <Button
          aria-label="테스트베드 목록으로 돌아가기"
          title="테스트베드 목록으로 돌아가기"
          icon="arrow-left"
          variant="minimal"
          onClick={() => window.location.assign('/testbed')}
        />
        <NavbarHeading>trasolve 테스트베드</NavbarHeading>
        <NavbarDivider />
        <code
          className={`${Classes.MONOSPACE_TEXT} ${Classes.TEXT_MUTED} navbar-endpoint`}
        >
          /api · POST {API_ROUTES.trouteOptimize}
        </code>
      </NavbarGroup>
      <NavbarGroup align={Alignment.END}>
        <span className={`${Classes.TEXT_MUTED} navbar-api-label`}>API</span>
        <Tag
          aria-label={`API ${healthLabel}`}
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
          aria-label="API 상태 새로고침"
          title="API 상태 새로고침"
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

function healthIntent(health: HealthState): Intent {
  if (health === 'online') {
    return Intent.SUCCESS;
  }
  if (health === 'offline') {
    return Intent.DANGER;
  }
  return Intent.PRIMARY;
}
