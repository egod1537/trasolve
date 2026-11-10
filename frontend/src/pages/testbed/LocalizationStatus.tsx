import { useL, FALLBACK_LANGUAGE, type Language } from '@/shared/i18n';
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge';
import {
  type LocalizationRow,
  LANGUAGE_LABELS,
  localeList,
} from '@/pages/testbed/localizationResourceModel';

export function ValueCell({ value }: { value: string | undefined }) {
  const L = useL();
  if (value === undefined) {
    return (
      <span className="localization-value-placeholder">
        {L('testbed:localizationTestPage.value.missing')}
      </span>
    );
  }
  if (value === '') {
    return (
      <span className="localization-value-placeholder">
        {L('testbed:localizationTestPage.value.empty')}
      </span>
    );
  }
  return <span>{value}</span>;
}

export function RowStatus({
  row,
  language,
}: {
  row: LocalizationRow;
  language: Language;
}) {
  const L = useL();
  const badges: { label: string; tone: StatusTone }[] = [];
  if (row.missingLocales.length) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.missing', {
        localeList: localeList(row.missingLocales),
      }),
      tone: 'danger',
    });
  }
  if (row.emptyLocales.length) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.empty', {
        localeList: localeList(row.emptyLocales),
      }),
      tone: 'warning',
    });
  }
  const currentValue = row.values[language];
  const fallbackValue = row.values[FALLBACK_LANGUAGE];
  if (
    language !== FALLBACK_LANGUAGE &&
    (currentValue === undefined || currentValue === '') &&
    fallbackValue !== undefined &&
    fallbackValue !== ''
  ) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.fallbackEn', {
        language: LANGUAGE_LABELS[language],
      }),
      tone: 'accent',
    });
  }
  if (!badges.length) {
    badges.push({ label: L('testbed:appHeader.text.normal'), tone: 'success' });
  }

  return (
    <div className="localization-status-list">
      {badges.map((badge) => (
        <StatusBadge key={badge.label} tone={badge.tone}>
          {badge.label}
        </StatusBadge>
      ))}
    </div>
  );
}
