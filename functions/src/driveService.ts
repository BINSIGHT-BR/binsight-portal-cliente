import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

const ROOT_FOLDER = 'BInsight Connect';
const DOCS_FOLDER = 'Documentos';

let driveApi: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (!driveApi) {
    const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPES });
    driveApi = google.drive({ version: 'v3', auth });
  }
  return driveApi;
}

async function findFolder(parentId: string, name: string): Promise<string | null> {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await getDrive().files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const res = await getDrive().files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Falha ao criar pasta: ${name}`);
  return res.data.id;
}

async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findFolder(parentId, name);
  if (existing) return existing;
  return createFolder(parentId, name);
}

async function getOrCreateRootFolder(): Promise<string> {
  const q = `name = '${ROOT_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await getDrive().files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (res.data.files?.[0]?.id) return res.data.files[0].id;
  const created = await getDrive().files.create({
    requestBody: {
      name: ROOT_FOLDER,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('Falha ao criar pasta raiz BInsight Connect.');
  return created.data.id;
}

export async function ensureNfFolder(cnpjDigits: string, year: number): Promise<string> {
  const rootId = await getOrCreateRootFolder();
  const docsId = await ensureFolder(rootId, DOCS_FOLDER);
  const cnpjId = await ensureFolder(docsId, cnpjDigits);
  const nfId = await ensureFolder(cnpjId, 'NF');
  return ensureFolder(nfId, String(year));
}

export async function uploadNfFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ fileId: string; fileName: string }> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error('Upload Drive falhou.');
  return { fileId: res.data.id, fileName: res.data.name ?? fileName };
}

export async function getTemporaryDownloadUrl(fileId: string): Promise<{ url: string; fileName: string; mimeType: string }> {
  const drive = getDrive();
  const meta = await drive.files.get({
    fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true,
  });
  const content = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  const buffer = Buffer.from(content.data as ArrayBuffer);
  const base64 = buffer.toString('base64');
  const mimeType = meta.data.mimeType ?? 'application/octet-stream';
  const fileName = meta.data.name ?? 'nf.pdf';
  return {
    url: `data:${mimeType};base64,${base64}`,
    fileName,
    mimeType,
  };
}

export function extractYearFromDateBR(dataBR: string): number {
  const m = dataBR.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return +m[3];
  return new Date().getFullYear();
}
