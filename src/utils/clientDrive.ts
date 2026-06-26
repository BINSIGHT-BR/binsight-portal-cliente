import { resolveMonthlyTabFromDate } from '../constants/columns';
import { withTokenRetry } from './googleSheets';
import { normalizeCNPJ } from './ordersCore';

const ROOT = 'BInsight Connect';
const CLIENTES = 'Clientes';

interface DriveFile {
  id: string;
  name?: string;
  webViewLink?: string;
}

function escapeDriveQuery(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveJson<T>(
  token: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API (${res.status}): ${body}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

async function findFolder(token: string, parentId: string, name: string): Promise<string | null> {
  const q = `'${parentId}' in parents and name = '${escapeDriveQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const data = await driveJson<{ files?: DriveFile[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&pageSize=1`
  );
  return data.files?.[0]?.id ?? null;
}

async function createFolder(token: string, parentId: string, name: string): Promise<string> {
  const data = await driveJson<DriveFile>(token, 'https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!data.id) throw new Error(`Falha ao criar pasta: ${name}`);
  return data.id;
}

async function ensureFolder(token: string, parentId: string, name: string): Promise<string> {
  const existing = await findFolder(token, parentId, name);
  if (existing) return existing;
  return createFolder(token, parentId, name);
}

async function getOrCreateRoot(token: string): Promise<string> {
  const q = `name = '${ROOT}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const data = await driveJson<{ files?: DriveFile[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive&pageSize=1`
  );
  if (data.files?.[0]?.id) return data.files[0].id;
  return createFolder(token, 'root', ROOT);
}

/** BInsight Connect / Clientes / {CNPJ} / {ano} / {mes} */
export async function ensureClientOrderFolder(
  token: string,
  cnpj: string,
  dataBR: string
): Promise<string> {
  const digits = normalizeCNPJ(cnpj);
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const year = m ? m[3] : String(new Date().getFullYear());
  const monthName = resolveMonthlyTabFromDate(dataBR).trim() || 'Sem mes';

  const rootId = await getOrCreateRoot(token);
  const clientesId = await ensureFolder(token, rootId, CLIENTES);
  const cnpjId = await ensureFolder(token, clientesId, digits);
  const yearId = await ensureFolder(token, cnpjId, year);
  return ensureFolder(token, yearId, monthName);
}

export async function shareDriveFileWithEmails(
  token: string,
  fileId: string,
  emails: string[]
): Promise<void> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (const email of unique) {
    try {
      await driveJson(
        token,
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'user',
            role: 'reader',
            emailAddress: email,
          }),
        }
      );
    } catch (err) {
      console.warn('[drive] Falha ao compartilhar com', email, err);
    }
  }
}

export async function uploadClientDocument(
  accessToken: string,
  file: File,
  folderId: string,
  shareWithEmails: string[]
): Promise<{ fileId: string; webViewLink: string; fileName: string }> {
  return withTokenRetry(accessToken, async (token) => {
    const boundary = 'binsightconnectboundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const metadata = JSON.stringify({ name: file.name, parents: [folderId] });
    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      delimiter +
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelim;

    const created = await driveJson<DriveFile>(
      token,
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      }
    );

    if (!created.id) throw new Error('Upload Drive falhou.');

    if (shareWithEmails.length) {
      await shareDriveFileWithEmails(token, created.id, shareWithEmails);
    }

    let webViewLink = created.webViewLink ?? '';
    if (!webViewLink) {
      const meta = await driveJson<DriveFile>(
        token,
        `https://www.googleapis.com/drive/v3/files/${created.id}?fields=webViewLink,webContentLink`
      );
      webViewLink = meta.webViewLink ?? `https://drive.google.com/file/d/${created.id}/view`;
    }

    return {
      fileId: created.id,
      webViewLink,
      fileName: created.name ?? file.name,
    };
  });
}

export type ClientDocKind = 'nf' | 'boleto';

export async function uploadOrderDocument(
  accessToken: string,
  kind: ClientDocKind,
  file: File,
  pedido: { cnpj: string; data: string; numPedidoCli: string; numNF: string; rowNum: number },
  shareWithEmails: string[]
): Promise<{ webViewLink: string; fileName: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const allowed = ['pdf', 'xml', 'png', 'jpg', 'jpeg'];
  if (!allowed.includes(ext)) {
    throw new Error('Envie PDF, XML ou imagem.');
  }

  const folderId = await withTokenRetry(accessToken, (token) =>
    ensureClientOrderFolder(token, pedido.cnpj, pedido.data)
  );

  const prefix = kind === 'nf' ? 'NF' : 'Boleto';
  const ref = pedido.numPedidoCli || pedido.numNF || `linha${pedido.rowNum}`;
  const safeRef = ref.replace(/[^\w.-]+/g, '_').slice(0, 40);
  const renamed = new File([file], `${prefix}_${safeRef}_${Date.now()}.${ext}`, {
    type: file.type,
  });

  return uploadClientDocument(accessToken, renamed, folderId, shareWithEmails);
}
