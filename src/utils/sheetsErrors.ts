import { getRegistrySpreadsheetId } from '../constants/columns';

/** Mensagem amigável para erros comuns do Google Sheets/Drive. */
export function formatSheetsAccessError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  const registryId = getRegistrySpreadsheetId();

  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('permission')) {
    return (
      'Sem permissão para acessar a planilha de acessos.\n\n' +
      '1. Clique em **Conectar planilhas** no topo do portal (pop-up do Google).\n' +
      '2. Entre com a conta **financeiro@binsight.com.br** (ou a sua @binsight).\n' +
      '3. Se ainda falhar, peça **Editor** na planilha Registry:\n' +
      `   https://docs.google.com/spreadsheets/d/${registryId}/edit`
    );
  }

  if (msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.includes('invalid_grant')) {
    return 'Sessão Google expirou. Clique em **Conectar planilhas** no topo e tente de novo.';
  }

  return msg;
}
