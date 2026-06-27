/** Rótulo do badge de contagem na navegação. */
export function formatNavBadgeCount(count: number, maxBeforePlus?: number): string {
  if (maxBeforePlus != null && count > maxBeforePlus) return `${maxBeforePlus}+`;
  if (count > 999) return '999+';
  return String(count);
}
