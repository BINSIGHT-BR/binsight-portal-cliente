import { PedidoMapa } from '../types';
import { USE_OAUTH_SHEETS } from '../constants/columns';
import { resolveClientDocEmails } from './clientDocAccess';
import { uploadOrderDocument, type ClientDocKind } from './clientDrive';
import { updateMapaOrder } from './mapaSheet';
import { maybeNotifyDocumentUploaded } from './pedidoNotify';

export async function uploadAndLinkOrderDocument(
  accessToken: string,
  kind: ClientDocKind,
  file: File,
  pedido: PedidoMapa,
  changedBy: string
): Promise<PedidoMapa> {
  if (!USE_OAUTH_SHEETS) {
    throw new Error('Upload Drive disponível apenas em modo OAuth.');
  }

  const shareEmails = await resolveClientDocEmails(accessToken, pedido.cnpj);
  if (shareEmails.length === 0) {
    throw new Error(
      'Nenhum e-mail ATIVO no cadastro para este CNPJ. Aprove o cliente em Acessos Clientes antes de enviar NF/boleto.'
    );
  }

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

  const updated = await updateMapaOrder(accessToken, patch, changedBy);
  void maybeNotifyDocumentUploaded(accessToken, kind, updated);
  return updated;
}
