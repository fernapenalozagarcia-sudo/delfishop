import { initAdmin } from '../../components/adminLayout.js';
import { dataTable, searchInput } from '../../components/adminUi.js';
import { orderStatusBadge } from '../../components/badges.js';
import { openOrderDetail } from '../../components/orderDetail.js';
import { confirmDialog } from '../../components/dialog.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { showToast } from '../../components/toast.js';
import { debounce, h, mount } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { formatDateTime, formatMoney, formatNumber, pluralize } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';
import { onDataChanged } from '../../utils/events.js';
import { getQueryParams, replaceQueryParams } from '../../router.js';
import { getAllowedTransitions, ORDER_STATUS, ORDER_STATUS_META, ORDER_STATUS_ORDER } from '../../domain/orderStatus.js';
import { getOrders, getOrderStats, updateOrderStatus } from '../../services/orderService.js';

initAdmin({ active: 'pedidos' });

const els = {
  tabs: document.getElementById('status-tabs'),
  filters: document.getElementById('order-filters'),
  count: document.getElementById('order-count'),
  table: document.getElementById('order-table'),
};

const params = getQueryParams();
const filters = {
  estado: ORDER_STATUS_ORDER.includes(params.get('estado')) ? params.get('estado') : '',
  q: params.get('q') ?? '',
};

function setFilter(changes) {
  Object.assign(filters, changes);
  replaceQueryParams(filters);
  render();
}

function renderTabs(stats) {
  const tab = (value, label, count) =>
    h(
      'button',
      { type: 'button', class: 'status-tab', 'aria-pressed': String(filters.estado === value), onClick: () => setFilter({ estado: value }) },
      h('span', { text: label }),
      h('span', { class: 'status-tab__count', text: formatNumber(count) }),
    );
  mount(els.tabs, tab('', 'Todos', stats.total), ORDER_STATUS_ORDER.map((s) => tab(s, ORDER_STATUS_META[s].label, stats.counts[s])));
}

/** Siguiente paso habitual del flujo (sin incluir la cancelación). */
function nextStep(order) {
  return getAllowedTransitions(order).find((s) => s !== ORDER_STATUS.CANCELLED) ?? null;
}

async function quickAdvance(order, status, button) {
  const confirmed = await confirmDialog({
    title: `${ORDER_STATUS_META[status].action}`,
    message: `El pedido ${order.id} de ${order.customer.name} pasará de «${ORDER_STATUS_META[order.status].label}» a «${ORDER_STATUS_META[status].label}».${status === ORDER_STATUS.COMPLETED ? ' Se registrará como venta completada.' : ''}`,
    confirmLabel: 'Confirmar cambio',
    tone: 'primary',
  });
  if (!confirmed) return;
  button.disabled = true;
  try {
    await updateOrderStatus(order.id, status);
    showToast(`Pedido ${order.id}: ${ORDER_STATUS_META[status].label}.${status === ORDER_STATUS.COMPLETED ? ' Venta registrada.' : ''}`);
  } catch (error) {
    button.disabled = false;
    showToast(getErrorMessage(error), { type: 'error' });
  }
}

function itemsSummary(items) {
  const visible = items.slice(0, 2).map((i) => h('li', { text: `${i.quantity} × ${i.name}` }));
  return h('ul', { class: 'table__items' }, visible, items.length > 2 && h('li', { class: 'table__secondary', text: `y ${items.length - 2} más` }));
}

function renderTable(orders) {
  els.table.removeAttribute('aria-busy');
  els.count.textContent = pluralize(orders.length, 'pedido');
  if (!orders.length) {
    mount(els.table, emptyState({ icon: 'clipboard', title: 'No hay pedidos', message: filters.estado || filters.q ? 'Ningún pedido coincide con los filtros.' : 'Los pedidos generados en la tienda aparecerán aquí.' }));
    return;
  }
  mount(
    els.table,
    dataTable({
      caption: 'Pedidos',
      columns: [
        { label: 'Pedido' },
        { label: 'Fecha' },
        { label: 'Cliente' },
        { label: 'Productos' },
        { label: 'Total', className: 'num' },
        { label: 'Estado' },
        { label: 'Acciones', className: 'num' },
      ],
      rows: orders.map((order) => {
        const next = nextStep(order);
        const advance = next && h('button', { type: 'button', class: 'btn btn--primary btn--sm', text: ORDER_STATUS_META[next].action.replace(' pedido', '') });
        advance?.addEventListener('click', () => quickAdvance(order, next, advance));
        return h(
          'tr',
          { class: order.status === ORDER_STATUS.PENDING ? 'row--alert' : null },
          h('td', {}, h('button', { type: 'button', class: 'link-button table__primary', text: order.id, onClick: () => openOrderDetail(order.id) }), h('p', { class: 'table__secondary', text: order.delivery.label })),
          h('td', { class: 'nowrap', text: formatDateTime(order.createdAt) }),
          h('td', {}, h('p', { text: order.customer.name }), h('p', { class: 'table__secondary', text: order.customer.phone })),
          h('td', {}, itemsSummary(order.items)),
          h('td', { class: 'num', text: formatMoney(order.totals.total) }),
          h('td', {}, orderStatusBadge(order.status)),
          h(
            'td',
            {},
            h(
              'div',
              { class: 'table__actions' },
              h('button', { type: 'button', class: 'btn btn--outline btn--sm', 'aria-label': `Ver detalle del pedido ${order.id}`, onClick: () => openOrderDetail(order.id) }, icon('eye', { size: 16 }), 'Detalle'),
              advance,
            ),
          ),
        );
      }),
    }),
  );
}

async function render() {
  try {
    const [stats, orders] = await Promise.all([getOrderStats(), getOrders({ status: filters.estado, q: filters.q })]);
    renderTabs(stats);
    renderTable(orders);
  } catch (error) {
    mount(els.table, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

mount(els.filters, searchInput({ id: 'ord-q', label: 'Buscar', placeholder: 'Número, cliente, teléfono o producto', value: filters.q, onInput: debounce((e) => setFilter({ q: e.target.value.trim() }), 250) }));
mount(els.table, loadingState('Cargando pedidos…'));
render().then(() => {
  const id = params.get('id');
  if (id) openOrderDetail(id);
});
onDataChanged(['orders'], render);
