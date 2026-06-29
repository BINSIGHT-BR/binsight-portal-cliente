import { PedidoMapa } from '../types';
import { USE_OAUTH_SHEETS } from '../constants/columns';
import { resolveClientDocEmails } from './clientDocAccess';
import { trashDriveFile, uploadOrderDocument, type ClientDocKind } from './clientDrive';
import { extractDriveFileId } from './driveDocumentView';
import { updateMapaOrder } from './mapaSheet';
import { notifyDocumentsAfterChange } from './pedidoNotify';

export type DocumentNotifyResult = {
  emailed: string[];
  skippedReason?: string;
  /** Upload ok, mas nenhum cliente ATIVO no portal para este CNPJ. */
  noPortalClient?: boolean;
};

async function notifyAfterDocChange(
  accessToken: string,
  before: PedidoMapa,
  after: PedidoMapa
): Promise<DocumentNotifyResult> {
  try {
    return await notifyDocumentsAfterChange(accessToken, before, after);
  } catch (err) {
    console.warn('[documents] Falha ao enviar e-mail:', err);
    return {
      emailed: [],
      skippedReason: err instanceof Error ? err.message : 'Falha ao enviar e-mail.',
    };
  }
}

export async function uploadAndLinkOrderDocument(
  accessToken: string,
  kind: ClientDocKind,
  file: File,
  pedido: PedidoMapa,
  changedBy: string
): Promise<{ pedido: PedidoMapa; notify: DocumentNotifyResult }> {
  if (!USE_OAUTH_SHEETS) {
    throw new Error('Upload Drive disponível apenas em modo OAuth.');
  }

  const shareEmails = await resolveClientDocEmails(accessToken, pedido.cnpj);

  const { webViewLink } = await uploadOrderDocument(
    accessToken,
    kind,
    file,
    pedido,
    shareEmails
  );

  const patch: PedidoMapa = {
    ...pedido,
    ...(kind === 'nf'
      ? { nfDriveUrl: webViewLink, emissao: 'Sim' }
      : { boletoDriveUrl: webViewLink }),
  };

  const before = { ...pedido };
  const updated = await updateMapaOrder(accessToken, patch, changedBy, false, true);
  const notify = await notifyAfterDocChange(accessToken, before, updated);
  if (shareEmails.length === 0) {
    notify.noPortalClient = true;
    if (!notify.emailed.length && !notify.skippedReason) {
      notify.skippedReason =
        'Cliente ainda não cadastrado no portal — verá o documento após aprovação. E-mail não enviado.';
    }
  }
  return { pedido: updated, notify };
}

export async function removeAndUnlinkOrderDocument(
  accessToken: string,
  kind: ClientDocKind,
  pedido: PedidoMapa,
  changedBy: string
): Promise<PedidoMapa> {
  if (!USE_OAUTH_SHEETS) {
    throw new Error('Remoção via Drive disponível apenas em modo OAuth.');
  }

  const url = kind === 'nf' ? pedido.nfDriveUrl : pedido.boletoDriveUrl;
  if (!url?.trim()) {
    throw new Error('Nenhum documento vinculado para remover.');
  }

  const fileId = extractDriveFileId(url);
  if (fileId) {
    try {
      await trashDriveFile(accessToken, fileId);
    } catch (err) {
      console.warn('[drive] Arquivo não removido do Drive; link será desvinculado.', err);
    }
  }

  const patch: PedidoMapa = {
    ...pedido,
    ...(kind === 'nf' ? { nfDriveUrl: '' } : { boletoDriveUrl: '' }),
  };

  const before = { ...pedido };
  const updated = await updateMapaOrder(accessToken, patch, changedBy, false, true);
  return updated;
}
