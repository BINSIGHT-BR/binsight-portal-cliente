import { withTokenRetry } from './googleSheets';
import { fetchDriveFileViaSheetAuth, isSheetSessionToken } from './connectPortalApi';

/** Extrai ID do arquivo a partir de webViewLink / webContentLink do Drive. */
export function extractDriveFileId(url: string): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export interface DriveFileView {
  fileId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  previewUrl: string;
}

export async function fetchDriveFileForView(
  accessToken: string,
  driveUrl: string
): Promise<DriveFileView> {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error('Documento inválido ou indisponível.');

  if (isSheetSessionToken(accessToken)) {
    const { name, mimeType, blob } = await fetchDriveFileViaSheetAuth(accessToken, driveUrl);
    const previewUrl = URL.createObjectURL(blob);
    return { fileId, name, mimeType, blob, previewUrl };
  }

  return withTokenRetry(accessToken, async (token) => {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      if (metaRes.status === 403) {
        throw new Error(
          'Sem permissão para este documento. Entre com o e-mail Google cadastrado no portal BInsight.'
        );
      }
      throw new Error(`Não foi possível abrir o documento (${metaRes.status}).`);
    }
    const meta = (await metaRes.json()) as { name?: string; mimeType?: string };

    const mediaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!mediaRes.ok) {
      throw new Error('Falha ao carregar o arquivo para visualização.');
    }
    const blob = await mediaRes.blob();
    const previewUrl = URL.createObjectURL(blob);

    return {
      fileId,
      name: meta.name ?? 'documento',
      mimeType: meta.mimeType ?? blob.type ?? 'application/octet-stream',
      blob,
      previewUrl,
    };
  });
}

export function canPreviewMime(mimeType: string): boolean {
  return (
    mimeType.includes('pdf') ||
    mimeType.startsWith('image/') ||
    mimeType.includes('xml') ||
    mimeType.includes('text/')
  );
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function orderDomId(rowNum: number, mapaKind?: string): string {
  return `order-${mapaKind ?? 'pedido'}-${rowNum}`;
}
