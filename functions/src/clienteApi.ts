import { onRequest } from 'firebase-functions/v2/https';
import {
  authenticateRequest,
  ForbiddenError,
  HttpError,
  canEditOrders,
  requireFinanceOrAdmin,
  seesAllOrders,
} from './auth';
import { computeAlerts } from './alertsService';
import {
  applyPedidosQuery,
  createOrder,
  deleteOrder,
  enrichPedidosWithNfFlag,
  fetchAllOrders,
  filterOrdersForAuth,
  getOrderByRowNum,
  normalizeCNPJ,
  updateOrder,
} from './ordersService';
import {
  createRegistryRecord,
  deleteRegistryRecord,
  fetchRegistryRecords,
  registerClientAccess,
  toClientPortalUser,
  updateRegistryRecord,
} from './registryService';
import { ClientAccessStatus, PedidosQueryParams } from './constants';
import { fetchStatusHistoryForRow } from './statusHistory';
import { parseMultipartUpload } from './multipartParser';
import { ensureNfFolder, extractDriveFileId, extractYearFromDateBR, fetchDriveFileBuffer, getTemporaryDownloadUrl, trashDriveFile, uploadNfFile } from './driveService';
import { deleteNfForPedido, getNfForPedido, upsertNfIndex } from './nfIndexService';
import { resetClientPassword } from './passwordService';
import { sendClientePedidoEmails } from './emailService';
import { NotifyRecipient } from './constants';
import { notifyFromSheetColumnEdit } from './sheetNotifyBridge';

function validateNotifySecret(secret: string): boolean {
  const expected = (process.env.NOTIFY_SECRET ?? '').trim();
  if (!expected) {
    console.warn('[notify] NOTIFY_SECRET não configurado na função.');
    return false;
  }
  return secret.trim() === expected;
}

function parseNotifyRecipients(raw: unknown): NotifyRecipient[] {
  if (!Array.isArray(raw)) return [];
  const out: NotifyRecipient[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const email = item.trim().toLowerCase();
      if (email) out.push({ email, displayName: '' });
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const email = String(obj.email ?? '').trim().toLowerCase();
      const displayName = String(obj.displayName ?? obj.nome ?? '').trim();
      if (email) out.push({ email, displayName });
    }
  }
  return out;
}

const ALLOWED_ORIGINS = [
  'https://connect-binsight.web.app',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function setCors(req: { headers: { origin?: string } }, res: { set: (k: string, v: string) => void }) {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

function json(res: { status: (n: number) => { json: (b: unknown) => void } }, status: number, body: unknown) {
  res.status(status).json(body);
}

function parsePath(url: string): string[] {
  const path = url.split('?')[0].replace(/\/+$/, '');
  const idx = path.indexOf('/api/');
  if (idx === -1) return [];
  return path.slice(idx + 5).split('/').filter(Boolean);
}

function parseQuery(url: string): Record<string, string> {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return {};
  const params = new URLSearchParams(url.slice(qIdx + 1));
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function pedidosQueryFromParams(params: Record<string, string>): PedidosQueryParams {
  return {
    status: params.status,
    distribuidor: params.distribuidor,
    statusPgto: params.statusPgto,
    search: params.search ?? params.q,
    dateFrom: params.dateFrom ?? params.dataInicio,
    dateTo: params.dateTo ?? params.dataFim,
  };
}

function decodeEmailParam(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

async function assertPedidoAccess(
  auth: Awaited<ReturnType<typeof authenticateRequest>>,
  pedido: { rowNum: number; cnpj: string }
): Promise<void> {
  if (auth.portalUser.role !== 'cliente') return;
  if (auth.clientStatus !== 'ativo') throw new ForbiddenError('Acesso pendente ou revogado.');
  const set = new Set(auth.portalUser.cnpjs.map(normalizeCNPJ));
  if (!set.has(normalizeCNPJ(pedido.cnpj))) {
    throw new ForbiddenError('Pedido não pertence ao seu CNPJ.');
  }
}

export const clienteApi = onRequest(
  {
    region: 'southamerica-east1',
    cors: false,
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: '512MiB',
    /** Hosting + browser enviam Bearer Firebase; validação na função (authenticateRequest). */
    invoker: 'public',
  },
  async (req, res) => {
    setCors(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const parts = parsePath(req.url || req.path || '');
      const resource = parts[0] ?? '';
      const sub = parts[1];
      const action = parts[2];
      const query = parseQuery(req.url || '');

      if (resource === 'notify' && sub === 'cliente-pedido' && req.method === 'POST') {
        const body = (req.body ?? {}) as Record<string, unknown>;
        if (!validateNotifySecret(String(body.secret ?? ''))) {
          throw new HttpError(401, 'Unauthorized');
        }
        const recipients = parseNotifyRecipients(body.recipients);
        const result = await sendClientePedidoEmails({
          recipients,
          pedidoRef: String(body.pedidoRef ?? 'Pedido'),
          nomeCliente: String(body.nomeCliente ?? ''),
          subject: String(body.subject ?? '[BInsight] Atualização do seu pedido'),
          message: String(body.message ?? ''),
          timelineHtml: body.timelineHtml ? String(body.timelineHtml) : undefined,
        });
        if (recipients.length > 0 && result.sent === 0) {
          throw new HttpError(
            500,
            `E-mail não enviado: ${result.failed.join('; ') || 'Gmail/SMTP indisponível'}`
          );
        }
        json(res, 200, { ok: true, sent: result.sent, failed: result.failed });
        return;
      }

      if (resource === 'notify' && sub === 'cliente-pedido-row' && req.method === 'POST') {
        const body = (req.body ?? {}) as Record<string, unknown>;
        if (!validateNotifySecret(String(body.secret ?? ''))) {
          throw new HttpError(401, 'Unauthorized');
        }
        await notifyFromSheetColumnEdit({
          spreadsheetId: String(body.spreadsheetId ?? ''),
          sheetName: String(body.sheetName ?? ''),
          rowNum: Number(body.rowNum ?? 0),
          column: Number(body.column ?? 0),
          oldValue: String(body.oldValue ?? ''),
          newValue: String(body.newValue ?? ''),
        });
        json(res, 200, { ok: true });
        return;
      }

      const auth = await authenticateRequest(req);

      if (resource === 'me' && req.method === 'GET') {
        json(res, 200, {
          portalUser: auth.portalUser,
          clientStatus: auth.clientStatus,
        });
        return;
      }

      if (resource === 'alertas' && req.method === 'GET') {
        requireFinanceOrAdmin(auth);
        const all = await fetchAllOrders();
        json(res, 200, { alertas: computeAlerts(all) });
        return;
      }

      if (resource === 'register' && req.method === 'POST') {
        if (auth.portalUser.role !== 'cliente' || auth.clientStatus !== 'none') {
          throw new ForbiddenError('Cadastro disponível apenas para contas externas novas.');
        }
        const nome = String(req.body?.nome ?? auth.portalUser.displayName ?? '').trim();
        const cnpj = String(req.body?.cnpj ?? '').trim();
        const additionalCnpjs = Array.isArray(req.body?.additionalCnpjs)
          ? req.body.additionalCnpjs.map(String)
          : [];
        const record = await registerClientAccess(auth.email, nome, cnpj, additionalCnpjs);
        json(res, 200, { ok: true, record: toClientPortalUser(record) });
        return;
      }

      if (resource === 'pedidos') {
        if (req.method === 'GET' && !sub) {
          if (auth.portalUser.role === 'cliente' && auth.clientStatus !== 'ativo') {
            throw new ForbiddenError('Acesso pendente ou revogado.');
          }
          let all = await fetchAllOrders();
          all = filterOrdersForAuth(auth, all);
          all = applyPedidosQuery(all, pedidosQueryFromParams(query));
          all = await enrichPedidosWithNfFlag(all);
          json(res, 200, { pedidos: all });
          return;
        }

        if (req.method === 'GET' && sub && action === 'historico') {
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          if (!seesAllOrders(auth)) {
            throw new ForbiddenError('Acesso restrito à equipe BInsight.');
          }
          const pedido = await getOrderByRowNum(rowNum, query.tab?.trim() || undefined);
          if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
          const historico = await fetchStatusHistoryForRow(rowNum);
          json(res, 200, { historico });
          return;
        }

        if (req.method === 'GET' && sub && action === 'document' && parts[3]) {
          const rowNum = parseInt(sub, 10);
          const docKind = parts[3];
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          if (docKind !== 'nf' && docKind !== 'boleto') {
            throw new HttpError(400, 'Tipo de documento inválido.');
          }
          const pedido = await getOrderByRowNum(rowNum, query.tab?.trim() || undefined);
          if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
          await assertPedidoAccess(auth, pedido);
          const driveUrl = docKind === 'nf' ? pedido.nfDriveUrl : pedido.boletoDriveUrl;
          if (!driveUrl?.trim()) {
            throw new HttpError(404, 'Documento ainda não disponível.');
          }
          const fileId = extractDriveFileId(driveUrl);
          if (!fileId) throw new HttpError(400, 'Link do documento inválido.');
          let file;
          try {
            file = await fetchDriveFileBuffer(fileId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao abrir documento no Drive.';
            throw new HttpError(404, msg);
          }
          json(res, 200, {
            fileName: file.fileName,
            mimeType: file.mimeType,
            dataBase64: file.buffer.toString('base64'),
          });
          return;
        }

        if (req.method === 'GET' && sub && action === 'nf') {
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          const pedido = await getOrderByRowNum(rowNum, query.tab?.trim() || undefined);
          if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
          await assertPedidoAccess(auth, pedido);
          const nf = await getNfForPedido(rowNum);
          if (!nf) throw new HttpError(404, 'NF não disponível para este pedido.');
          const download = await getTemporaryDownloadUrl(nf.fileId);
          json(res, 200, {
            fileName: download.fileName,
            mimeType: download.mimeType,
            dataUrl: download.url,
            expiresIn: 300,
          });
          return;
        }

        if (req.method === 'POST' && sub && action === 'nf') {
          if (!canEditOrders(auth)) {
            throw new ForbiddenError('Sem permissão para enviar NF.');
          }
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          const pedido = await getOrderByRowNum(rowNum, query.tab?.trim() || undefined);
          if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');

          const upload = await parseMultipartUpload(req);
          const ext = upload.fileName.split('.').pop()?.toLowerCase() ?? 'pdf';
          if (!['pdf', 'xml'].includes(ext)) {
            throw new HttpError(400, 'Apenas arquivos PDF ou XML são permitidos.');
          }

          const cnpjDigits = normalizeCNPJ(pedido.cnpj);
          const year = extractYearFromDateBR(pedido.data);
          const folderId = await ensureNfFolder(cnpjDigits, year);
          const safeName = `${cnpjDigits}_${pedido.numNF || rowNum}_${Date.now()}.${ext}`;
          const { fileId, fileName } = await uploadNfFile(folderId, safeName, upload.mimeType, upload.buffer);

          const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          await upsertNfIndex({
            rowNum,
            cnpj: cnpjDigits,
            numNF: pedido.numNF,
            fileId,
            fileName,
            mimeType: upload.mimeType,
            uploadedAt: now,
            uploadedBy: auth.email,
          });

          json(res, 200, { ok: true, fileId, fileName });
          return;
        }

        if (req.method === 'DELETE' && sub && action === 'nf') {
          if (!canEditOrders(auth)) {
            throw new ForbiddenError('Sem permissão para remover NF.');
          }
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          const pedido = await getOrderByRowNum(rowNum, query.tab?.trim() || undefined);
          if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');

          const nf = await deleteNfForPedido(rowNum);
          if (nf?.fileId) {
            try {
              await trashDriveFile(nf.fileId);
            } catch (err) {
              console.warn('[drive] NF removida do índice; arquivo no Drive não excluído.', err);
            }
          }

          if (pedido.nfDriveUrl?.trim()) {
            await updateOrder(auth, rowNum, { nfDriveUrl: '' });
          }

          json(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && !sub) {
          if (!canEditOrders(auth)) {
            throw new ForbiddenError('Sem permissão para criar pedidos.');
          }
          const pedido = await createOrder(auth, req.body ?? {});
          json(res, 200, { pedido });
          return;
        }

        if (req.method === 'PATCH' && sub) {
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');

          if (auth.portalUser.role === 'cliente') {
            const existing = await getOrderByRowNum(rowNum);
            if (!existing) throw new HttpError(404, 'Pedido não encontrado.');
            await assertPedidoAccess(auth, existing);
          } else if (!canEditOrders(auth)) {
            throw new ForbiddenError('Sem permissão para editar pedidos.');
          }

          const pedido = await updateOrder(auth, rowNum, req.body ?? {});
          json(res, 200, { pedido });
          return;
        }

        if (req.method === 'DELETE' && sub && !action) {
          if (!canEditOrders(auth)) {
            throw new ForbiddenError('Sem permissão para excluir pedidos.');
          }
          const rowNum = parseInt(sub, 10);
          if (!rowNum) throw new HttpError(400, 'Número de linha inválido.');
          await deleteOrder(rowNum);
          json(res, 200, { ok: true });
          return;
        }
      }

      if (resource === 'acessos') {
        requireFinanceOrAdmin(auth);

        if (req.method === 'GET' && !sub) {
          const records = await fetchRegistryRecords();
          json(res, 200, { acessos: records.map(toClientPortalUser) });
          return;
        }

        if (req.method === 'POST' && !sub) {
          const email = String(req.body?.email ?? '').trim();
          const nome = String(req.body?.nome ?? '').trim();
          const cnpj = String(req.body?.cnpj ?? '').trim();
          const additionalCnpjs = Array.isArray(req.body?.additionalCnpjs)
            ? (req.body.additionalCnpjs as string[])
            : [];
          const record = await createRegistryRecord(email, nome, cnpj, additionalCnpjs);
          json(res, 200, { ok: true, record: toClientPortalUser(record) });
          return;
        }

        if (req.method === 'PATCH' && sub && !action) {
          const email = decodeEmailParam(sub);
          const status = req.body?.status
            ? (String(req.body.status).trim().toUpperCase() as ClientAccessStatus)
            : undefined;
          if (status && status !== 'ATIVO' && status !== 'REVOGADO' && status !== 'PENDENTE') {
            throw new HttpError(400, 'Status inválido. Use ATIVO, REVOGADO ou PENDENTE.');
          }
          await updateRegistryRecord(email, {
            status,
            approvedBy: status ? auth.email : undefined,
            nome: req.body?.nome ? String(req.body.nome) : undefined,
            cnpj: req.body?.cnpj ? String(req.body.cnpj) : undefined,
            additionalCnpjs: Array.isArray(req.body?.additionalCnpjs)
              ? (req.body.additionalCnpjs as string[])
              : undefined,
          });
          json(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && sub && action === 'reset-password') {
          const email = decodeEmailParam(sub);
          const result = await resetClientPassword(email);
          json(res, 200, result);
          return;
        }

        if (req.method === 'DELETE' && sub) {
          const email = decodeEmailParam(sub);
          await deleteRegistryRecord(email);
          json(res, 200, { ok: true });
          return;
        }
      }

      throw new HttpError(404, 'Rota não encontrada.');
    } catch (err) {
      if (err instanceof HttpError) {
        json(res, err.status, { error: err.message });
        return;
      }
      if (err instanceof ForbiddenError) {
        json(res, 403, { error: err.message });
        return;
      }
      console.error('[clienteApi]', err);
      const raw = err instanceof Error ? err.message : 'Erro interno';
      const msg =
        /PERMISSION_DENIED|permission|403/i.test(raw)
          ? 'Sem permissão para ler a planilha. Compartilhe Mapa e Registry como Editor com a conta de serviço do Firebase (ver BACKEND_SETUP.md).'
          : raw;
      json(res, 500, { error: msg });
    }
  }
);
