import { useTripData } from '@/features/map-workspace/hooks/useTrip';
import { useId, useRef, useState, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { NL, useL } from '@/shared/i18n';
import { useTripEditController } from '../hooks/useTrip';
import {
  createImportTripFileCommand,
  downloadTripFile,
  readTripFile,
  TripFileError,
  type ParsedTripFile,
} from './tripFiles';
import './trip-files.css';
import { printTripSchedule } from './printTripSchedule';

type DayImportProps = { dayId: string; dayTitle: string; disabled?: boolean };
export function DayFileImport({ dayId, dayTitle, disabled }: DayImportProps) {
  const L = useL();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="trip-file-import-action"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M12 18v-7m-3 3 3-3 3 3" />
        </svg>
        {L('map:tripFiles.importSubmit')}
      </button>
      {open && (
        <ImportDialog
          dayId={dayId}
          dayTitle={dayTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function ImportDialog({
  dayId,
  dayTitle,
  onClose,
}: DayImportProps & { onClose: () => void }) {
  const L = useL();
  const controller = useTripEditController();
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const importing = useRef(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedTripFile | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const choose = async (file: File) => {
    const version = ++generation.current;
    setReading(true);
    setError(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const data = await readTripFile(file);
      if (generation.current === version) {
        setParsed(data);
      }
    } catch (cause) {
      if (generation.current !== version) {
        return;
      }
      setError(
        cause instanceof TripFileError
          ? cause.code === 'tooLarge'
            ? L('map:tripFiles.tooLarge')
            : cause.code === 'noPlaces'
              ? L('map:tripFiles.noPlaces')
              : L('map:tripFiles.invalidFile')
          : L('map:tripFiles.failed'),
      );
    } finally {
      if (generation.current === version) {
        setReading(false);
      }
    }
  };
  const apply = async () => {
    if (!parsed || importing.current) {
      return;
    }
    importing.current = true;
    setSaving(true);
    setError(null);
    try {
      if (
        await controller.executeBatch([
          createImportTripFileCommand(dayId, parsed),
        ])
      ) {
        onClose();
      } else {
        setError(L('map:tripFiles.failed'));
      }
    } catch {
      setError(L('map:tripFiles.failed'));
    } finally {
      importing.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog
      className="trip-file-dialog"
      labelledBy={titleId}
      busy={saving}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      onClose={() => {
        if (!importing.current) {
          onClose();
        }
      }}
    >
      <h2 id={titleId}>{L('map:tripFiles.importTitle')}</h2>
      <p>
        <strong>{dayTitle}</strong>
      </p>
      <p className="trip-file-description">
        {L('map:tripFiles.importDescription')}
      </p>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
        aria-label={L('map:tripFiles.chooseFile')}
        disabled={reading || saving}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            void choose(file);
          }
        }}
      />
      <Button
        disabled={reading || saving}
        onClick={() => fileInput.current?.click()}
      >
        {L('map:tripFiles.chooseFile')}
      </Button>
      {fileName && <p className="trip-file-name">{fileName}</p>}
      {reading && <LoadingSpinner />}
      {parsed && (
        <div className="trip-file-preview">
          <strong>
            {L('map:tripFiles.ready', {
              places: parsed.places.length,
              routes: parsed.routes.length,
            })}
          </strong>
          {parsed.places.some((place) => !place.placeId) && (
            <p>{L('map:tripFiles.missingPlaceIds')}</p>
          )}
        </div>
      )}
      {error && (
        <p className="trip-file-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={saving} onClick={onClose}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!parsed || reading || saving}
          loading={saving}
          onClick={() => void apply()}
        >
          {L('map:tripFiles.importSubmit')}
        </Button>
      </footer>
    </Dialog>
  );
}

export function TripExportDialog({ onClose }: { onClose: () => void }) {
  const L = useL();
  const trip = useTripData();
  const titleId = useId();
  const [format, setFormat] = useState<'kml' | 'kmz' | 'pdf'>('kmz');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportFile = async () => {
    if (exporting) {
      return;
    }
    setError(null);
    setExporting(true);
    try {
      if (format === 'pdf') {
        await printTripSchedule(trip);
      } else {
        downloadTripFile(trip, format);
      }
      onClose();
    } catch {
      setError(L('map:tripFiles.failed'));
    } finally {
      setExporting(false);
    }
  };
  return (
    <Dialog
      className="trip-file-dialog"
      labelledBy={titleId}
      busy={exporting}
      onClose={onClose}
    >
      <h2 id={titleId}>{L('map:tripFiles.exportAction')}</h2>
      <p>
        <strong>{trip.title}</strong>
      </p>
      <p className="trip-file-description">
        {L('map:tripFiles.exportDescription')}
      </p>
      <fieldset disabled={exporting}>
        <legend>{L('map:tripFiles.format')}</legend>
        <label>
          <input
            type="radio"
            name={titleId}
            checked={format === 'kmz'}
            onChange={() => setFormat('kmz')}
          />
          {NL('KMZ')}
        </label>
        <label>
          <input
            type="radio"
            name={titleId}
            checked={format === 'kml'}
            onChange={() => setFormat('kml')}
          />
          {NL('KML')}
        </label>
        <label>
          <input
            type="radio"
            name={titleId}
            checked={format === 'pdf'}
            onChange={() => setFormat('pdf')}
          />
          {NL('PDF')}{' '}
          {L(
            'routeOptimization:routeSchedulePreview.beforeSchedule.tooltip.schedule',
          )}
        </label>
      </fieldset>
      {error && (
        <p className="trip-file-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={exporting} onClick={onClose}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={exporting}
          loading={exporting}
          onClick={() => void exportFile()}
        >
          {L('map:tripFiles.exportAction')}
        </Button>
      </footer>
    </Dialog>
  );
}
