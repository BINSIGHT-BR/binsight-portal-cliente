import { getStagesForPedido } from './timeline';
import { PedidoCliente, PedidoMapa } from '../types';

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

/** HTML inline (table-based) da timeline do pedido — compatível com clientes de e-mail. */
export function buildTimelineEmailHtml(pedido: PedidoMapa | PedidoCliente): string {
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
