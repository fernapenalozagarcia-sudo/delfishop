import { h } from '../utils/dom.js';
import { formatMoney, pluralize } from '../utils/format.js';
import { productImage } from './productImage.js';

/**
 * Lista de totales. Ahorros y costo de entrega solo se muestran cuando existen.
 * @param {{itemCount:number, subtotal:number, savings:number, shipping:number|null, total:number}} totals
 */
export function totalsList(totals) {
  const row = (label, value, className = '') =>
    h('div', { class: ['summary-row', className] }, h('dt', { text: label }), h('dd', {}, value));

  return h(
    'dl',
    { class: 'summary-list' },
    row(`Subtotal (${pluralize(totals.itemCount, 'artículo')})`, formatMoney(totals.subtotal)),
    totals.savings > 0 && row('Ahorro en ofertas', `−${formatMoney(totals.savings)}`, 'summary-row--savings'),
    totals.shipping !== null && totals.shipping !== undefined && row('Envío', totals.shipping === 0 ? 'Gratis' : formatMoney(totals.shipping)),
    row('Total', [formatMoney(totals.total), h('span', { class: 'currency-code', text: 'MXN' })], 'summary-row--total'),
  );
}

/** Lista compacta de artículos de un pedido o carrito. */
export function itemsMiniList(items) {
  return h(
    'ul',
    { class: 'mini-items' },
    items.map((item) =>
      h(
        'li',
        { class: 'mini-item' },
        h('div', { class: 'mini-item__media' }, productImage({ src: item.image ?? item.product?.images?.[0], alt: '', width: 120 }), h('span', { class: 'mini-item__qty', text: item.quantity, 'aria-hidden': 'true' })),
        h(
          'div',
          { class: 'mini-item__info' },
          h('p', { class: 'mini-item__name', text: item.name ?? item.product?.name }),
          h('p', { class: 'mini-item__meta', text: `Talla ${item.size} · ${item.color}` }),
          h('p', { class: 'mini-item__meta', text: `${item.quantity} × ${formatMoney(item.unitPrice)}` }),
        ),
        h('p', { class: 'mini-item__total', text: formatMoney(item.lineTotal) }),
      ),
    ),
  );
}
