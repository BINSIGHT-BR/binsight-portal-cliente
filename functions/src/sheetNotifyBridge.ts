import { PedidoMapa } from './constants';
import { fetchOrderRowFromSpreadsheet, normalizeStatusPgto } from './ordersService';
import { maybeNotifyPedidoChanges } from './pedidoNotify';

const SHEET_NOTIFY_COLUMNS: Record<
  number,
  keyof Pick<PedidoMapa, 'statusPgto' | 'status' | 'obsCliente' | 'nfDriveUrl' | 'boletoDriveUrl'>
> = {
  16: 'statusPgto',
  17: 'status',
  28: 'obsCliente',
  29: 'nfDriveUrl',
  30: 'boletoDriveUrl',
};

/** Dispara e-mail após edição direta na planilha (onEdit Apps Script → Cloud Function). */
export async function notifyFromSheetColumnEdit(params: {
  spreadsheetId: string;
  sheetName: string;
  rowNum: number;
  column: number;
  oldValue: string;
  newValue: string;
}): Promise<void> {
  const field = SHEET_NOTIFY_COLUMNS[params.column];
  if (!field) return;

  const after = await fetchOrderRowFromSpreadsheet(
    params.spreadsheetId,
    params.sheetName,
    params.rowNum
  );
  if (!after) return;

  const oldRaw = String(params.oldValue ?? '');
  const before: PedidoMapa = {
    ...after,
    [field]: field === 'statusPgto' ? normalizeStatusPgto(oldRaw) : oldRaw,
  };

  await maybeNotifyPedidoChanges(before, after);
}
