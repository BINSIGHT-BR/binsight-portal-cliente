import { getAccessToken, isGoogleAuthExpiredError, refreshGoogleAccessToken } from './firebase';

async function activeToken(preferred: string): Promise<string> {
  return (await getAccessToken()) ?? preferred;
}

export async function withTokenRetry<T>(
  accessToken: string,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(await activeToken(accessToken));
  } catch (err) {
    if (isGoogleAuthExpiredError(err)) {
      return fn(await refreshGoogleAccessToken());
    }
    throw err;
  }
}

export async function fetchSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erro ao ler planilha (${res.status}): ${body}`);
  }
  const data = await res.json();
  return (data.values as string[][] | undefined) ?? [];
}

export async function updateSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erro ao gravar planilha (${res.status}): ${body}`);
  }
}

export async function appendSheetRows(
  accessToken: string,
  spreadsheetId: string,
  tab: string,
  values: unknown[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${tab}!A2`
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erro ao incluir linha (${res.status}): ${body}`);
  }
}

export async function listSheetTitles(accessToken: string, spreadsheetId: string): Promise<string[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erro ao listar abas (${res.status}): ${body}`);
  }
  const data = await res.json();
  return (
    (data.sheets as { properties?: { title?: string } }[] | undefined)?.map(
      (s) => s.properties?.title ?? ''
    ) ?? []
  );
}

export async function resolveSheetTitle(
  accessToken: string,
  spreadsheetId: string,
  baseName: string
): Promise<string> {
  const titles = await listSheetTitles(accessToken, spreadsheetId);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const found = titles.find((t) => norm(t) === norm(baseName));
  return found ?? baseName;
}

async function getSheetId(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<number> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Erro ao ler metadados da planilha (${res.status})`);
  const data = await res.json();
  const sheet = (
    data.sheets as { properties?: { title?: string; sheetId?: number } }[] | undefined
  )?.find((s) => s.properties?.title === sheetName);
  if (sheet?.properties?.sheetId === undefined) {
    throw new Error(`Aba não encontrada: ${sheetName}`);
  }
  return sheet.properties.sheetId;
}

export async function deleteSheetRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowNum: number
): Promise<void> {
  const sheetId = await getSheetId(accessToken, spreadsheetId, sheetName);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erro ao excluir linha (${res.status}): ${body}`);
  }
}

export async function getLastDataRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  colRange = 'A:A'
): Promise<number> {
  const rows = await fetchSheetRange(accessToken, spreadsheetId, `${sheetName}!${colRange}`);
  return Math.max(1, rows.length);
}

export function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
