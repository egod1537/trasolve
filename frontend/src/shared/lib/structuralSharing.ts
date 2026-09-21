type JsonRecord = Record<string, unknown>;

/**
 * Reuses every unchanged branch from `current` while adopting changed values
 * from `next`. API/domain payloads passed here must be JSON-like values.
 */
export function reuseJsonValue<T>(current: T, next: T): T {
  if (areJsonValuesEqual(current, next)) {
    return current;
  }

  if (Array.isArray(current) && Array.isArray(next)) {
    return next.map((value, index) =>
      index < current.length ? reuseJsonValue(current[index], value) : value,
    ) as T;
  }

  if (isJsonRecord(current) && isJsonRecord(next)) {
    const shared: JsonRecord = {};
    for (const key of Object.keys(next)) {
      shared[key] = Object.hasOwn(current, key)
        ? reuseJsonValue(current[key], next[key])
        : next[key];
    }
    return shared as T;
  }

  return next;
}

export function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => areJsonValuesEqual(value, right[index]))
    );
  }
  if (isJsonRecord(left) && isJsonRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.hasOwn(right, key) &&
          areJsonValuesEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
