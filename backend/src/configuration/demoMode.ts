function readBoolean(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`${name} must be true or false.`);
}

export function isDemoQueryEnabled(): boolean {
  return readBoolean(
    'DEMO_QUERY_ENABLED',
    process.env.NODE_ENV !== 'production',
  );
}
