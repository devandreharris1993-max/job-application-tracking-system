import { useEffect, useState } from 'react';

/** Returns `value` only after it has stayed unchanged for `delayMs` — used so a search field
 * can update immediately in the UI while the list query waits until typing pauses. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
