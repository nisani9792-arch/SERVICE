/** Server-side gate code (must match what operators type on the lock screen). */
export function getGateAccessCode(): string {
  return (process.env.GATE_ACCESS_CODE ?? "JUSIC").trim().toUpperCase();
}
