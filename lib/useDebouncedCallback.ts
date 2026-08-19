"use client";

import { useRef, useCallback } from "react";

/**
 * Returns a debounced version of `fn`, keyed so that e.g. edits to two
 * different table cells don't cancel each other's pending save.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (key: string, ...args: Args) => void,
  delay = 500,
) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  return useCallback(
    (key: string, ...args: Args) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timers.current.delete(key);
        fn(key, ...args);
      }, delay);
      timers.current.set(key, timer);
    },
    [fn, delay],
  );
}
