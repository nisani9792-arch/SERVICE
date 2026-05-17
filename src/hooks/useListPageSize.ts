"use client";

import { useEffect, useState } from "react";

function readPageSize(desktop: number, mobile: number): number {
  if (typeof window === "undefined") return desktop;
  return window.matchMedia("(max-width: 767px)").matches ? mobile : desktop;
}

/** Smaller pages on phone for faster list loads. */
export function useListPageSize(desktop = 80, mobile = 36) {
  const [pageSize, setPageSize] = useState(() => readPageSize(desktop, mobile));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPageSize(mq.matches ? mobile : desktop);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [desktop, mobile]);

  return pageSize;
}
