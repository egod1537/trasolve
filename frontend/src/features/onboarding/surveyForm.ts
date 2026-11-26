const DEFAULT_DEBUG_SURVEY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSc9k1m2H9wuyXLGHX6AtHPkHSlNyyKmWTZqIz3HcOvkeqsxnA/viewform';
const DEFAULT_PRODUCTION_SURVEY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdYRw9rUEueKlAOpwjV7IeYDTCqxy7yuiOFaiKpsTY9y1LFgQ/viewform';

const configuredSurveyFormUrl = import.meta.env.DEV
  ? import.meta.env.VITE_SURVEY_FORM_DEBUG_URL || DEFAULT_DEBUG_SURVEY_FORM_URL
  : import.meta.env.VITE_SURVEY_FORM_PRODUCTION_URL ||
    DEFAULT_PRODUCTION_SURVEY_FORM_URL;

export const surveyFormUrl = normalizeGoogleFormUrl(configuredSurveyFormUrl);

export function getEmbeddedSurveyFormUrl(formUrl: string): string {
  const url = new URL(formUrl);
  if (url.hostname === 'docs.google.com') {
    url.searchParams.set('embedded', 'true');
  }
  return url.toString();
}

function normalizeGoogleFormUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    const googleForm =
      (url.hostname === 'docs.google.com' &&
        url.pathname.startsWith('/forms/')) ||
      url.hostname === 'forms.gle';
    return url.protocol === 'https:' && googleForm ? url.toString() : null;
  } catch {
    return null;
  }
}
