"use client";

import { useCallback, useRef } from "react";

/** Stable Set reference when membership for tracked ids is unchanged. */
export function useStableSelectionSet(selectedIds: Set<string>): Set<string> {
  const ref = useRef<{ ids: Set<string>; signature: string }>({
    ids: selectedIds,
    signature: selectionSignature(selectedIds)
  });

  const signature = selectionSignature(selectedIds);
  if (ref.current.signature !== signature) {
    ref.current = { ids: selectedIds, signature };
  }

  return ref.current.ids;
}

function selectionSignature(ids: Set<string>): string {
  if (ids.size === 0) return "";
  return Array.from(ids).sort().join("|");
}

/** Returns a callback wrapper whose identity stays stable across renders. */
export function useStableHandler<T extends (...args: never[]) => unknown>(handler: T): T {
  const ref = useRef(handler);
  ref.current = handler;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
