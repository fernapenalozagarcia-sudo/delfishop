import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import { routeUrl } from '../router.js';
import {
  getAllowedTransitions,
  getStatusFlow,
  getStatusLabel,
  isFinalStatus,
  ORDER_STATUS,
  ORDER_STATUS_META,
} from '../domain/orderStatus.js';
import { getOrderById, updateOrderStatus } from '../services/orderService.js';
import { getSaleByOrderId } from '../services/salesService.js';
import { orderStatusBadge } from './badges.js';
import { confirmDialog, openDialog } from './dialog.js';
import { itemsMiniList, totalsList } from './orderSummary.js';
import { showToast } from './toast.js';

function addressLines(address) {
  return [address.street, address.neighborhood, `${address.city}, ${address.state}`, `C.P. ${address.postalCode}`, address.references && `Referencias: ${address.references}`].filter(Boolean);
}

function timeline(order) {
  const reached = new Map(order.statusHistory.map((entry) => [entry.status, entry]));
  const flow = getStatusFlow(order);
  const cancelled = order.status === ORDER_STATUS.CANCELLED;
  const steps = cancelled ? [...flow.filter((s) => reached.has(s)), ORDER_STATUS.CANCELLED] : flow;

  return h(
    'ol',
    { class: 'timeline', 'aria-label': 'Progreso del pedido' },
    steps.map((status) => {
      const entry = reached.get(status);
      const current = order.status === status;
      return h(
        'li',
        { class: ['timeline__step', entry && 'is-done', current && 'is-current', status === ORDER_STATUS.CANCELLED && 'is-cancelled'], 'aria-current': current ? 'step' : null },
        h('span', { class: 'timeline__dot', 'aria-hidden': 'true' }, entry && icon(status === ORDER_STATUS.CANCELLED ? 'x' : 'check', { size: 12 })),
        h('span', { class: 'timeline__label', text: getStatusLabel(status) }),
        h('span', { class: 'timeline__date', text: entry ? formatDateTime(entry.at) : '—' }),
      );
    }),
  );
}

/**
 * Diálogo con el detalle completo del pedido y los controles de cambio de estado.
 * Solo ofrece las transiciones permitidas por las reglas de negocio.
 */
export async function openOrderDetail(orderId) {
  const order = await getOrderById(orderId);
  if (!order) {
    showToast('El pedido no existe.', { type: 'error' });
    return;
  }
  const sale = await getSaleByOrderId(order.id);
  const allowed = getAllowedTransitions(order);

  const note = h('textarea', { id: 'status-note', class: 'textarea', rows: '2', maxlength: '300', placeholder: 'Ej. Pago confirmado por transferencia' });
  const actionMessage = h('div', { class: 'form-message', 'aria-live': 'assertive' });

  let dialogRef;
  async function changeStatus(nextStatus, button) {
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      const confirmed = await confirmDialog({
        title: `¿Cancelar el pedido ${order.id}?`,
        message: 'El pedido no se contabilizará como venta y sus unidades volverán al inventario. Esta acción no se puede deshacer.',
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Volver',
      });
      if (!confirmed) return;
    }
    button.disabled = true;
    try {
      const updated = await updateOrderStatus(order.id, nextStatus, { note: note.value });
      dialogRef.close();
      const extra = nextStatus === ORDER_STATUS.COMPLETED ? ' Se registró como venta completada.' : nextStatus === ORDER_STATUS.CANCELLED ? ' Las unidades volvieron al inventario.' : '';
      showToast(`Pedido ${updated.id}: ${getStatusLabel(updated.status)}.${extra}`, { type: nextStatus === ORDER_STATUS.CANCELLED ? 'info' : 'success' });
    } catch (error) {
      button.disabled = false;
      actionMessage.replaceChildren(h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: getErrorMessage(error) })));
    }
  }

  const actions = allowed.map((status) => {
    const meta = ORDER_STATUS_META[status];
    const button = h('button', {
      type: 'button',
      class: ['btn', 'btn--sm', status === ORDER_STATUS.CANCELLED ? 'btn--danger-outline' : 'btn--primary'],
      text: meta.action,
    });
    button.addEventListener('click', () => changeStatus(status, button));
    return button;
  });

  const body = h(
    'div',
    { class: 'order-detail' },
    h(
      'div',
      { class: 'order-detail__head' },
      orderStatusBadge(order.status),
      h('span', { class: 'table__secondary', text: `Creado el ${formatDateTime(order.createdAt)}` }),
    ),
    timeline(order),
    sale &&
      h('p', { class: 'alert alert--success' }, icon('checkCircle', { size: 18 }), h('span', {}, `Venta registrada (${sale.id}) el ${formatDateTime(sale.completedAt)}. `, h('a', { href: routeUrl('adminSales'), text: 'Ver ventas' }))),
    order.status === ORDER_STATUS.CANCELLED &&
      h('p', { class: 'alert alert--danger' }, icon('info', { size: 18 }), h('span', { text: 'Pedido cancelado: no cuenta como venta y sus unidades se devolvieron al inventario.' })),
    !isFinalStatus(order.status) &&
      h('p', { class: 'alert alert--info' }, icon('info', { size: 18 }), h('span', { text: 'Este pedido aún no cuenta como venta. Se registrará como venta al marcarlo como completado.' })),
    h(
      'div',
      { class: 'order-detail__grid' },
      h(
        'section',
        { 'aria-labelledby': 'od-customer' },
        h('h3', { class: 'order-detail__title', id: 'od-customer', text: 'Cliente y entrega' }),
        h(
          'dl',
          { class: 'detail-list' },
          [
            ['Nombre', order.customer.name],
            ['Teléfono', order.customer.phone],
            ['Correo', order.customer.email || '—'],
            ['Entrega', order.delivery.label],
            ['Dirección', order.delivery.address ? addressLines(order.delivery.address).join(', ') : 'No aplica'],
            ['Notas', order.notes || '—'],
          ].map(([t, d]) => h('div', { class: 'detail-list__row' }, h('dt', { text: t }), h('dd', { text: d }))),
        ),
      ),
      h(
        'section',
        { 'aria-labelledby': 'od-items' },
        h('h3', { class: 'order-detail__title', id: 'od-items', text: 'Productos' }),
        itemsMiniList(order.items),
        h('hr', { class: 'divider' }),
        totalsList(order.totals),
      ),
    ),
    h(
      'section',
      { class: 'order-detail__history', 'aria-labelledby': 'od-history' },
      h('h3', { class: 'order-detail__title', id: 'od-history', text: 'Historial' }),
      h(
        'ul',
        { class: 'history-list' },
        [...order.statusHistory].reverse().map((entry) =>
          h('li', {}, h('strong', { text: getStatusLabel(entry.status) }), h('span', { class: 'table__secondary', text: ` · ${formatDateTime(entry.at)}` }), entry.note && h('p', { class: 'table__secondary', text: entry.note })),
        ),
      ),
    ),
    allowed.length > 0 &&
      h(
        'section',
        { class: 'order-detail__actions', 'aria-labelledby': 'od-actions' },
        h('h3', { class: 'order-detail__title', id: 'od-actions', text: 'Actualizar estado' }),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'status-note' }, 'Nota del cambio', h('span', { class: 'field__optional', text: ' (opcional)' })), note),
        actionMessage,
        h('div', { class: 'order-detail__buttons' }, actions),
      ),
  );

  dialogRef = openDialog({ title: `Pedido ${order.id}`, size: 'lg', body });
}
