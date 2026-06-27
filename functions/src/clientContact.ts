import { ClientPortalRecord } from './constants';

/** Nome + sobrenome do contato a partir do registry (cols I/J ou fallback col B). */
export function contactNamesFromRecord(r: Pick<ClientPortalRecord, 'nome' | 'nomeContato' | 'sobrenomeContato'>): {
  first: string;
  last: string;
} {
  if (r.nomeContato || r.sobrenomeContato) {
    return { first: r.nomeContato ?? '', last: r.sobrenomeContato ?? '' };
  }
  const parts = r.nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function displayContactName(r: Pick<ClientPortalRecord, 'nome' | 'nomeContato' | 'sobrenomeContato'>): string {
  const { first, last } = contactNamesFromRecord(r);
  const full = `${first} ${last}`.trim();
  return full || r.nome.trim();
}

/** Primeiro nome para saudação no e-mail. */
export function greetingFirstName(displayName: string): string {
  return displayName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
}
