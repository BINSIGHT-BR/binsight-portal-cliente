import {
  CONSOLIDADO_TAB,
  getMapaSpreadsheetId,
  SPREADSHEET_BINSIGHT_CUSTOMERS,
  SPREADSHEET_MASTER_DISTRIBUIDORES,
} from '../constants/columns';
import { fetchSheetRange, withTokenRetry } from './googleSheets';
import { normalizeCNPJ } from './ordersCore';

export interface CustomerLookup {
  nome: string;
  vendedor?: string;
  source: 'customers' | 'mapa' | 'none';
}

export interface MapaFormOptions {
  distribuidores: string[];
  vendedores: { nome: string; email: string }[];
}

let optionsCache: { at: number; data: MapaFormOptions } | null = null;
let mapaClientCache: { at: number; map: Map<string, { nome: string; vendedor: string }> } | null = null;

const CACHE_MS = 5 * 60 * 1000;

export async function fetchMapaFormOptions(accessToken: string): Promise<MapaFormOptions> {
  if (optionsCache && Date.now() - optionsCache.at < CACHE_MS) {
    return optionsCache.data;
  }

  return withTokenRetry(accessToken, async (token) => {
    const mapaId = getMapaSpreadsheetId();

    const [distRows, vendRows] = await Promise.all([
      fetchSheetRange(token, SPREADSHEET_MASTER_DISTRIBUIDORES, 'DISTRIBUIDORES!D2:D500').catch(
        () => []
      ),
      fetchSheetRange(token, mapaId, 'VENDEDORES!A2:D200').catch(() => []),
    ]);

    const seen = new Set<string>();
    const distribuidores: string[] = [];
    for (const r of distRows) {
      const name = String(r[0] ?? '').trim();
      if (!name) continue;
      const key = name.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      distribuidores.push(name);
    }
    distribuidores.sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const vendedores = vendRows
      .map((r) => ({
        email: String(r[0] ?? '').trim().toLowerCase(),
        nome: String(r[1] ?? '').trim(),
        ativo: String(r[2] ?? '').trim().toUpperCase(),
      }))
      .filter((v) => v.nome && v.ativo !== 'FALSE' && v.ativo !== 'NÃO' && v.ativo !== 'NAO')
      .map(({ email, nome }) => ({ email, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const data = { distribuidores, vendedores };
    optionsCache = { at: Date.now(), data };
    return data;
  });
}

async function getMapaClientIndex(accessToken: string): Promise<Map<string, { nome: string; vendedor: string }>> {
  if (mapaClientCache && Date.now() - mapaClientCache.at < CACHE_MS) {
    return mapaClientCache.map;
  }

  return withTokenRetry(accessToken, async (token) => {
    const mapaId = getMapaSpreadsheetId();
    const rows = await fetchSheetRange(
      token,
      mapaId,
      `${CONSOLIDADO_TAB}!C2:D5000`
    ).catch(() => []);

    const map = new Map<string, { nome: string; vendedor: string }>();
    for (const row of rows) {
      const digits = normalizeCNPJ(String(row[0] ?? ''));
      const nome = String(row[1] ?? '').trim();
      if (digits.length >= 11 && nome) {
        map.set(digits, { nome, vendedor: '' });
      }
    }

    mapaClientCache = { at: Date.now(), map };
    return map;
  });
}

export async function lookupCustomerByCnpj(
  accessToken: string,
  cnpjRaw: string
): Promise<CustomerLookup> {
  const digits = normalizeCNPJ(cnpjRaw);
  if (digits.length < 11) {
    return { nome: '', source: 'none' };
  }

  return withTokenRetry(accessToken, async (token) => {
    try {
      const rows = await fetchSheetRange(
        token,
        SPREADSHEET_BINSIGHT_CUSTOMERS,
        'CUSTOMERS!A2:J3000'
      );
      for (const row of rows) {
        if (normalizeCNPJ(String(row[0] ?? '')) === digits) {
          const nome = String(row[1] ?? '').trim();
          const vendedor = String(row[6] ?? '').trim();
          if (nome) return { nome, vendedor: vendedor || undefined, source: 'customers' };
        }
      }
    } catch {
      /* fallback mapa */
    }

    const mapaIndex = await getMapaClientIndex(token);
    const fromMapa = mapaIndex.get(digits);
    if (fromMapa?.nome) {
      return { nome: fromMapa.nome, source: 'mapa' };
    }

    return { nome: '', source: 'none' };
  });
}

export function resolveVendedorForUser(
  options: MapaFormOptions,
  userEmail: string
): string {
  const email = userEmail.trim().toLowerCase();
  const match = options.vendedores.find((v) => v.email === email);
  return match?.nome ?? '';
}

/** CNPJ formatado 00.000.000/0000-00 enquanto digita. */
export function formatCnpjInput(raw: string): string {
  const d = normalizeCNPJ(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
