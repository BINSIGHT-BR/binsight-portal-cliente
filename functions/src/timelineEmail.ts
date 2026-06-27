import { PedidoMapa } from './constants';

type TimelineStageId = 'confirmado' | 'credito' | 'faturado' | 'rota' | 'entregue' | 'licenca';
type TipoProdutoPedido = 'hardware' | 'software';

interface TimelineStage {
  id: TimelineStageId;
  label: string;
  description?: string;
}

const TIMELINE_HARDWARE: TimelineStage[] = [
  { id: 'confirmado', label: 'Pedido Confirmado', description: 'Pedido registrado no sistema' },
  { id: 'credito', label: 'Análise de Crédito', description: 'Validação financeira' },
  { id: 'faturado', label: 'Pedido Faturado', description: 'NF emitida' },
  { id: 'rota', label: 'Em processo de entrega', description: 'Despachado ou aguardando retirada' },
  { id: 'entregue', label: 'Entregue', description: 'Recebido pelo cliente' },
];

const TIMELINE_SOFTWARE: TimelineStage[] = [
  { id: 'confirmado', label: 'Pedido Confirmado', description: 'Pedido registrado no sistema' },
  { id: 'credito', label: 'Análise de Crédito', description: 'Validação financeira' },
  { id: 'faturado', label: 'Pedido Faturado', description: 'NF emitida' },
  { id: 'licenca', label: 'Licença disponibilizada', description: 'Chaves ou acesso liberado' },
];

const ENTREGUE_APOS_FATURADO_DIAS = 20;

function parseSheetDate(val: string): Date | null {
  if (!val) return null;
  const br = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  return null;
}

function daysSinceDate(d: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - t.getTime()) / 86400000);
}

function isComissaoPaga(statusComissao?: string): boolean {
  const z = (statusComissao ?? '').trim().toUpperCase();
  return z === 'PAGA' || z.includes('PAGA');
}

function isPedidoEntregue(input: {
  status: string;
  statusComissao?: string;
  data?: string;
}): boolean {
  if (isComissaoPaga(input.statusComissao)) return true;
  const q = (input.status ?? '').trim().toUpperCase();
  if (q.includes('FATURADO')) {
    const d = parseSheetDate(input.data ?? '');
    if (d && daysSinceDate(d) > ENTREGUE_APOS_FATURADO_DIAS) return true;
  }
  return q.includes('ENTREGUE') || q.includes('FINALIZADO');
}

function emissaoIsSim(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'sim' || v === '✔' || v === 's' || v === 'yes';
}

function statusIncludes(status: string, ...needles: string[]): boolean {
  const s = status.toUpperCase();
  return needles.some((n) => s.includes(n));
}

function inferTipoFromDesc(desc: string): TipoProdutoPedido {
  const d = desc.toLowerCase();
  return ['licença', 'licenca', 'software', 'saas'].some((k) => d.includes(k))
    ? 'software'
    : 'hardware';
}

function getTimelineStages(tipo: TipoProdutoPedido): TimelineStage[] {
  return tipo === 'software' ? TIMELINE_SOFTWARE : TIMELINE_HARDWARE;
}

function resolveTimelineProgress(
  pedido: PedidoMapa,
  tipo: TipoProdutoPedido
): { current: TimelineStageId; completed: TimelineStageId[] } {
  const status = pedido.status ?? '';
  const obs = pedido.obsCliente ?? '';
  const emissao = pedido.emissao ?? '';
  const statusComissao = pedido.statusComissao ?? '';
  const obsLower = obs.toLowerCase();
  const entregue = isPedidoEntregue({
    status,
    statusComissao,
    data: pedido.data,
  });

  const completed: TimelineStageId[] = ['confirmado'];

  if (statusIncludes(status, 'PENDENTE') && !statusIncludes(status, 'FATURADO')) {
    if (obsLower.includes('crédito') || obsLower.includes('credito')) {
      completed.push('credito');
      return { current: 'credito', completed };
    }
    return { current: 'confirmado', completed };
  }

  completed.push('credito');

  if (obsLower.includes('cancelado') || statusIncludes(status, 'CANCELADO')) {
    return { current: 'credito', completed };
  }

  if (emissaoIsSim(emissao) || statusIncludes(status, 'FATURADO', 'FINALIZADO')) {
    completed.push('faturado');
  } else {
    return { current: 'credito', completed };
  }

  if (entregue) {
    if (tipo === 'software') {
      completed.push('licenca');
      return { current: 'licenca', completed };
    }
    completed.push('rota', 'entregue');
    return { current: 'entregue', completed };
  }

  if (statusIncludes(status, 'FATURADO')) {
    if (tipo === 'software') {
      return { current: 'faturado', completed };
    }
    completed.push('rota');
    return { current: 'rota', completed };
  }

  if (tipo === 'software') {
    if (
      obsLower.includes('licença') ||
      obsLower.includes('licenca') ||
      statusIncludes(status, 'FINALIZADO', 'ENTREGUE')
    ) {
      completed.push('licenca');
      return { current: 'licenca', completed };
    }
    return { current: 'faturado', completed };
  }

  if (
    obsLower.includes('processo de entrega') ||
    obsLower.includes('rota') ||
    statusIncludes(status, 'TRANSITO', 'ROTA')
  ) {
    completed.push('rota');
    if (statusIncludes(status, 'ENTREGUE') || obsLower.includes('entregue')) {
      completed.push('entregue');
      return { current: 'entregue', completed };
    }
    return { current: 'rota', completed };
  }

  if (statusIncludes(status, 'ENTREGUE') || obsLower.includes('entregue')) {
    completed.push('rota', 'entregue');
    return { current: 'entregue', completed };
  }

  return { current: 'faturado', completed };
}

function getStagesForPedido(pedido: PedidoMapa) {
  const tipo: TipoProdutoPedido =
    pedido.mapaTab === 'ASSINATURAS' || inferTipoFromDesc(pedido.descricaoProduto) === 'software'
      ? 'software'
      : 'hardware';
  const stages = getTimelineStages(tipo);
  const progress = resolveTimelineProgress(pedido, tipo);
  return { stages, ...progress };
}

const PURPLE = '#7c3aed';
const PURPLE_LIGHT = '#ede9fe';
const SLATE_200 = '#e2e8f0';
const SLATE_400 = '#94a3b8';
const SLATE_700 = '#334155';

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTimelineEmailHtml(pedido: PedidoMapa): string {
  const { stages, current, completed } = getStagesForPedido(pedido);
  const currentIdx = stages.findIndex((s) => s.id === current);
  const progressPct =
    stages.length <= 1 || currentIdx <= 0
      ? 0
      : Math.round((currentIdx / (stages.length - 1)) * 100);

  const stageCells = stages
    .map((stage, idx) => {
      const isCompleted = completed.includes(stage.id) && stage.id !== current;
      const isCurrent = stage.id === current;
      const isPast = idx < currentIdx;

      let circleBg = '#ffffff';
      let circleBorder = SLATE_200;
      let circleColor = SLATE_400;
      let labelColor = SLATE_400;
      let inner = String(idx + 1);

      if (isCompleted || isPast) {
        circleBg = PURPLE;
        circleBorder = PURPLE;
        circleColor = '#ffffff';
        labelColor = SLATE_700;
        inner = '&#10003;';
      } else if (isCurrent) {
        circleBg = '#ffffff';
        circleBorder = PURPLE;
        circleColor = PURPLE;
        labelColor = PURPLE;
        inner = String(idx + 1);
      }

      const desc =
        isCurrent && stage.description
          ? `<p style="margin:4px 0 0;font-size:9px;color:#64748b;line-height:1.3;">${escHtml(stage.description)}</p>`
          : '';

      return `<td align="center" valign="top" style="width:${Math.floor(100 / stages.length)}%;padding:0 2px;">
        <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center" valign="middle" width="32" height="32"
              style="width:32px;height:32px;border-radius:16px;background:${circleBg};border:2px solid ${circleBorder};color:${circleColor};font-size:${inner === '&#10003;' ? '14px' : '11px'};font-weight:bold;line-height:28px;text-align:center;${isCurrent ? `box-shadow:0 0 0 3px ${PURPLE_LIGHT};` : ''}">
              ${inner}
            </td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.03em;color:${labelColor};line-height:1.2;text-align:center;">
          ${escHtml(stage.label)}
        </p>
        ${desc}
      </td>`;
    })
    .join('');

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:20px 0;font-family:Arial,sans-serif;">
    <tr>
      <td style="padding:0 12px 8px;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">
        Andamento do pedido
      </td>
    </tr>
    <tr>
      <td style="padding:0 12px 4px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="height:4px;background:${SLATE_200};border-radius:2px;padding:0;">
              <table cellpadding="0" cellspacing="0" border="0" width="${progressPct}%" style="width:${progressPct}%;min-width:${progressPct > 0 ? '8px' : '0'};">
                <tr><td style="height:4px;background:${PURPLE};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 4px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${stageCells}</tr>
        </table>
      </td>
    </tr>
  </table>`;
}
