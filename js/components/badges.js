import { h } from '../utils/dom.js';
import { ORDER_STATUS_META } from '../domain/orderStatus.js';
import { getStockStatus, STOCK_STATUS_META } from '../domain/inventoryRules.js';

export function badge(text, tone = 'neutral', extraClass = '') {
  return h('span', { class: ['badge', `badge--${tone}`, extraClass], text });
}

export function orderStatusBadge(status) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: 'neutral' };
  return badge(meta.label, meta.tone, 'badge--dot');
}

export function stockStatusBadge(product) {
  const meta = STOCK_STATUS_META[getStockStatus(product)];
  return badge(meta.label, meta.tone, 'badge--dot');
}
