"use client";

/** Ambient mesh gradient layer — Gemini-inspired fluid backdrop. */
export function AppBackground() {
  return (
    <div className="app-mesh pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="app-mesh-blob app-mesh-blob-a" />
      <div className="app-mesh-blob app-mesh-blob-b" />
      <div className="app-mesh-blob app-mesh-blob-c" />
    </div>
  );
}
