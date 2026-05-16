const STORAGE_KEY = "service_operator_name";

export function getStoredOperatorName(): string | null {
  if (typeof localStorage === "undefined") return null;
  const name = localStorage.getItem(STORAGE_KEY)?.trim();
  if (!name || name.length < 2) return null;
  return name.slice(0, 80);
}

export function setStoredOperatorName(name: string): void {
  const trimmed = name.trim().slice(0, 80);
  if (trimmed.length >= 2) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  }
}

export function clearStoredOperatorName(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
