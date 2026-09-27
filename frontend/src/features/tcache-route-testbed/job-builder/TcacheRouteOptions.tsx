import {
  Button,
  ButtonGroup,
  Checkbox,
  FormGroup,
  InputGroup,
} from '@blueprintjs/core';
import type { TcacheJobBuilderState } from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import type { TcacheRouteMode } from '@/features/tcache-route-testbed/model/types';
import { useL, L, NL } from '@/shared/i18n';

interface TcacheRouteOptionsProps {
  state: TcacheJobBuilderState;
  onChange: (patch: Partial<TcacheJobBuilderState>) => void;
}

const MODES: { value: TcacheRouteMode; label: string }[] = [
  {
    value: 'DRIVING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.car');
    },
  },
  {
    value: 'WALKING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.walk');
    },
  },
  {
    value: 'BICYCLING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.bicycle');
    },
  },
  {
    value: 'TRANSIT',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.publicTransportation');
    },
  },
];

export function TcacheRouteOptions({
  state,
  onChange,
}: TcacheRouteOptionsProps) {
  const L = useL();
  return (
    <section
      className="tcache-builder-options"
      aria-labelledby="tcache-options-title"
    >
      <h2 id="tcache-options-title">
        {L('testbed:tcacheRouteOptions.title.requestSettings')}
      </h2>
      <FormGroup
        label={L('testbed:tcacheRouteOptions.text.meansTransportation')}
      >
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
      <FormGroup
        label={L('testbed:tcacheRouteOptions.text.departureTime')}
        labelFor="tcache-departure-time"
      >
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
        <summary>
          {L('testbed:tcacheRouteOptions.text.advancedOptions')}
        </summary>
        <Checkbox
          checked={state.computeAlternativeRoutes}
          label={L('testbed:tcacheRouteOptions.text.alternateRouteRequest')}
          onChange={(event) =>
            onChange({ computeAlternativeRoutes: event.currentTarget.checked })
          }
        />
        <div className="tcache-builder-advanced-grid">
          <FormGroup label={NL('languageCode')} labelFor="tcache-language-code">
            <InputGroup
              id="tcache-language-code"
              value={state.languageCode}
              onChange={(event) =>
                onChange({ languageCode: event.currentTarget.value })
              }
            />
          </FormGroup>
          <FormGroup label={NL('regionCode')} labelFor="tcache-region-code">
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
