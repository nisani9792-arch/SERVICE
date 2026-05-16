/** Client hint for instant unlock UX — server still validates on POST. */
export function getClientGateCode(): string {
  return (process.env.NEXT_PUBLIC_GATE_ACCESS_CODE ?? "JUSIC").trim().toUpperCase();
}
