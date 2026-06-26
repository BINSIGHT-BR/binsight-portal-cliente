import { SPREADSHEET_BINSIGHT_CUSTOMERS } from '../constants/columns';
import { fetchRegistryRecords, allCnpjsFromRecord } from './registrySheet';
import { fetchSheetRange, withTokenRetry } from './googleSheets';
import { normalizeCNPJ } from './ordersCore';

/** E-mails com acesso ao Drive do cliente: portal ATIVO + e-mail contato na planilha CUSTOMERS. */
export async function resolveClientDocEmails(
  accessToken: string,
  cnpj: string
): Promise<string[]> {
  const digits = normalizeCNPJ(cnpj);
  if (digits.length < 11) return [];

  const emails = new Set<string>();

  const records = await fetchRegistryRecords(accessToken);
  for (const r of records) {
    if (r.status !== 'ATIVO') continue;
    const cnpjs = allCnpjsFromRecord(r).map(normalizeCNPJ);
    if (cnpjs.includes(digits) && r.email) {
      emails.add(r.email.trim().toLowerCase());
    }
  }

  await withTokenRetry(accessToken, async (token) => {
    try {
      const rows = await fetchSheetRange(
        token,
        SPREADSHEET_BINSIGHT_CUSTOMERS,
        'CUSTOMERS!A2:J3000'
      );
      for (const row of rows) {
        if (normalizeCNPJ(String(row[0] ?? '')) !== digits) continue;
        const contact = String(row[8] ?? '').trim().toLowerCase();
        if (contact.includes('@')) emails.add(contact);
      }
    } catch {
      /* CUSTOMERS opcional */
    }
  });

  return Array.from(emails);
}
