import type { SheetAuthProfile } from './connectPortalApi';

const STORAGE_KEY = 'binsight_connect_sheet_auth';

export interface StoredSheetAuth {
  sessionToken: string;
  expiresAt: number;
  profile: SheetAuthProfile;
}

export function loadStoredSheetAuth(): StoredSheetAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSheetAuth;
    if (!parsed.sessionToken || !parsed.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSheetAuth(session: StoredSheetAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSheetAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}
