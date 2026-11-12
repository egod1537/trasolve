export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    )
  ) {
    return '/';
  }
  const parsed = new URL(value, 'https://trasolve.invalid');
  if (
    parsed.origin !== 'https://trasolve.invalid' ||
    parsed.pathname === '/auth/consent' ||
    parsed.pathname.startsWith('/api/')
  ) {
    return '/';
  }
  return parsed.pathname + parsed.search + parsed.hash;
}
