import {
  Button,
  ButtonGroup,
  Checkbox,
  FormGroup,
  InputGroup,
} from '@blueprintjs/core';
import type { TcacheJobBuilderState } from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import type { TcacheRouteMode } from '@/features/tcache-route-testbed/model/types';

interface TcacheRouteOptionsProps {
  state: TcacheJobBuilderState;
  onChange: (patch: Partial<TcacheJobBuilderState>) => void;
}

const MODES: { value: TcacheRouteMode; label: string }[] = [
  { value: 'DRIVING', label: '자동차' },
  { value: 'WALKING', label: '도보' },
  { value: 'BICYCLING', label: '자전거' },
  { value: 'TRANSIT', label: '대중교통' },
];

export function TcacheRouteOptions({
  state,
  onChange,
}: TcacheRouteOptionsProps) {
  return (
    <section
      className="tcache-builder-options"
      aria-labelledby="tcache-options-title"
    >
      <h2 id="tcache-options-title">요청 설정</h2>
      <FormGroup label="이동 수단">
        <ButtonGroup fill>
          {MODES.map((mode) => (
            <Button
              key={mode.value}
              active={state.mode === mode.value}
              onClick={() => onChange({ mode: mode.value })}
            >
              {mode.label}
            </Button>
          ))}
        </ButtonGroup>
      </FormGroup>
      <FormGroup label="출발 시각" labelFor="tcache-departure-time">
        <InputGroup
          id="tcache-departure-time"
          type="datetime-local"
          required
          value={state.departureTimeLocal}
          onChange={(event) =>
            onChange({ departureTimeLocal: event.currentTarget.value })
          }
        />
      </FormGroup>
      <details className="tcache-builder-advanced">
        <summary>고급 옵션</summary>
        <Checkbox
          checked={state.computeAlternativeRoutes}
          label="대체 경로 요청"
          onChange={(event) =>
            onChange({ computeAlternativeRoutes: event.currentTarget.checked })
          }
        />
        <div className="tcache-builder-advanced-grid">
          <FormGroup label="languageCode" labelFor="tcache-language-code">
            <InputGroup
              id="tcache-language-code"
              value={state.languageCode}
              onChange={(event) =>
                onChange({ languageCode: event.currentTarget.value })
              }
            />
          </FormGroup>
          <FormGroup label="regionCode" labelFor="tcache-region-code">
            <InputGroup
              id="tcache-region-code"
              value={state.regionCode}
              onChange={(event) =>
                onChange({ regionCode: event.currentTarget.value })
              }
            />
          </FormGroup>
        </div>
      </details>
    </section>
  );
}
