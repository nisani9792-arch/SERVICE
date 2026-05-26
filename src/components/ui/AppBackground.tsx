"use client";

/** Ambient mesh gradient — soft slate/indigo light backdrop. */
export function AppBackground() {
  return (
    <div
      className="app-mesh pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-50"
      aria-hidden
    >
      <div className="app-mesh-blob app-mesh-blob-a opacity-40" />
      <div className="app-mesh-blob app-mesh-blob-b opacity-35" />
      <div className="app-mesh-blob app-mesh-blob-c opacity-30" />
    </div>
  );
}
