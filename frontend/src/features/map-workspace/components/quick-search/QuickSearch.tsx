import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useId, useRef } from 'react';
import { CloseIcon } from '@/shared/ui/icons';
import { Dialog } from '@/shared/ui/Dialog';
import { NL, useL } from '@/shared/i18n';
import { useCommandConsole } from '../../command-console/useCommandConsole';
import { CommandOutputView } from '../../command-console/CommandOutputView';
import '../../styles/quick-search.css';
export function getQuickSearchShortcutLabel(): string {
  return typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    ? NL('⌘ K')
    : NL('Ctrl K');
}
export function QuickSearch({
  open,
  shortcutLabel,
  onOpen,
  onClose,
}: {
  open: boolean;
  shortcutLabel: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const L = useL();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useCommandConsole({ open, onOpen, onClose, inputRef });
  if (!open) {
    return null;
  }
  return (
    <Dialog
      className="quick-search-card"
      backdropClassName="quick-search-overlay"
      labelledBy={`${id}-title`}
      onClose={onClose}
      initialFocusRef={inputRef}
    >
      <h2 id={`${id}-title`} className="sr-only">
        {L('map:quickSearch.title.quickSearch')}
      </h2>
      <form
        className="quick-search-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          state.submit();
        }}
      >
        <span className="command-symbol" aria-hidden="true">
          {NL('⌘')}
        </span>
        <input
          ref={inputRef}
          value={state.query}
          placeholder={NL('search "..." | ai "..." | help')}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={state.candidates.length > 0}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={
            state.candidates.length
              ? `${id}-option-${state.selected}`
              : undefined
          }
          aria-label={L('map:quickSearch.title.quickSearch')}
          onChange={(event) => state.change(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (event.key === 'Tab' && state.candidates.length) {
              event.preventDefault();
              state.complete();
            }
            if (
              event.key === 'ArrowDown' &&
              !event.ctrlKey &&
              state.candidates.length
            ) {
              event.preventDefault();
              state.setSelected((i) => (i + 1) % state.candidates.length);
            }
            if (
              event.key === 'ArrowUp' &&
              !event.ctrlKey &&
              state.candidates.length
            ) {
              event.preventDefault();
              state.setSelected(
                (i) =>
                  (i + state.candidates.length - 1) % state.candidates.length,
              );
            }
            if (
              event.ctrlKey &&
              (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              event.preventDefault();
              state.recall(event.key === 'ArrowUp' ? 1 : -1);
            }
          }}
        />
        <kbd>{shortcutLabel}</kbd>
        <button
          type="button"
          className="quick-search-close"
          aria-label={L('common:action.close')}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </form>
      {state.definition && (
        <div className="command-assist">
          <code>{state.definition.syntax}</code>
        </div>
      )}
      {state.error && (
        <p className="command-error" role="alert">
          {state.error}
        </p>
      )}
      <ScrollArea
        className="quick-search-body"
        contentClassName="quick-search-body-content"
      >
        <ul
          id={`${id}-suggestions`}
          className="command-completions"
          role="listbox"
          aria-label={L('map:quickSearch.title.quickSearch')}
        >
          {state.candidates.map((candidate, index) => (
            <li
              key={candidate.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={state.selected === index}
              onMouseDown={(event) => event.preventDefault()}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  state.change(candidate.value);
                  inputRef.current?.focus();
                }}
              >
                <code>{candidate.label}</code>
                <small>{candidate.detail}</small>
              </button>
            </li>
          ))}
        </ul>
        <section
          className="command-outputs"
          aria-live="polite"
          aria-label={L('map:quickSearch.title.quickSearch')}
        >
          {[...state.records].reverse().map((record) => (
            <CommandOutputView
              key={record.id}
              record={record}
              onExecute={(request, expected) =>
                void state.run(request, expected)
              }
            />
          ))}
        </section>
      </ScrollArea>
      <footer className="quick-search-footer">
        <span>
          <kbd>{NL('Tab')}</kbd>
          {L('common:action.select')}
        </span>
        <span>
          <kbd>{NL('Enter')}</kbd>
          {L('common:action.apply')}
        </span>
        <span>
          <kbd>{NL('Esc')}</kbd>
          {L('common:action.close')}
        </span>
        {state.busy && (
          <button type="button" onClick={() => state.runtime.cancel()}>
            {L('common:action.cancel')}
          </button>
        )}
      </footer>
    </Dialog>
  );
}
