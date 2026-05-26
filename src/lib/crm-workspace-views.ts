export type CrmWorkspaceView = "command" | "workbench" | "triage" | "rapid" | "review" | "trash";

const VALID = new Set<CrmWorkspaceView>([
  "command",
  "workbench",
  "triage",
  "rapid",
  "review",
  "trash"
]);

export function parseWorkspaceView(raw: string | null | undefined): CrmWorkspaceView {
  if (raw && VALID.has(raw as CrmWorkspaceView)) return raw as CrmWorkspaceView;
  return "command";
}

export function defaultWorkspaceViewForDevice(isMobile: boolean): CrmWorkspaceView {
  return isMobile ? "workbench" : "command";
}
