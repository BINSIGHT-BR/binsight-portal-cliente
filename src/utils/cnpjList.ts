import { isValidMapaCnpj, normalizeCNPJ } from './ordersCore';

/** Normaliza e deduplica CNPJs mantendo a ordem de entrada. */
export function dedupeCnpjs(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const c = normalizeCNPJ(String(raw ?? '').trim());
    if (c.length !== 14 || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export function validateCnpjInputs(
  values: string[]
): { ok: true; primary: string; additional: string[]; all: string[] } | { ok: false; error: string } {
  const trimmed = values.map((v) => String(v ?? '').trim());
  if (!trimmed.some(Boolean)) {
    return { ok: false, error: 'Informe pelo menos um CNPJ válido (14 dígitos).' };
  }

  for (let i = 0; i < trimmed.length; i++) {
    if (!trimmed[i]) continue;
    if (!isValidMapaCnpj(trimmed[i])) {
      return {
        ok: false,
        error:
          i === 0
            ? 'Informe um CNPJ válido (14 dígitos).'
            : `CNPJ ${i + 1}: informe 14 dígitos válidos.`,
      };
    }
  }

  const all = dedupeCnpjs(trimmed);
  if (all.length === 0) {
    return { ok: false, error: 'Informe pelo menos um CNPJ válido (14 dígitos).' };
  }

  return { ok: true, primary: all[0], additional: all.slice(1), all };
}
