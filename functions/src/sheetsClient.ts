import { google, sheets_v4 } from 'googleapis';

let sheetsApi: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (!sheetsApi) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsApi = google.sheets({ version: 'v4', auth });
  }
  return sheetsApi;
}

export async function fetchSheetRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

export async function appendSheetRows(
  spreadsheetId: string,
  sheetName: string,
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  await getSheets().spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  await getSheets().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function resolveSheetTitle(
  spreadsheetId: string,
  baseName: string
): Promise<string> {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];
  const found = titles.find(
    (t) =>
      t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') ===
      baseName.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  );
  return found ?? baseName;
}

export async function deleteSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowNum: number
): Promise<void> {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Aba não encontrada: ${sheetName}`);

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNum - 1,
              endIndex: rowNum,
            },
          },
        },
      ],
    },
  });
}

export async function getLastDataRow(
  spreadsheetId: string,
  sheetName: string,
  colRange = 'A:A'
): Promise<number> {
  const rows = await fetchSheetRange(spreadsheetId, `${sheetName}!${colRange}`);
  return Math.max(1, rows.length);
}

export async function listSheetTitles(spreadsheetId: string): Promise<string[]> {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];
}
