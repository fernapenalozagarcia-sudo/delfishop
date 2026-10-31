import { initAdmin } from '../../components/adminLayout.js';
import { dataTable, kpiCard } from '../../components/adminUi.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { h, mount } from '../../utils/dom.js';
import { formatDateTime, formatMoney, formatNumber, pluralize, toDateInputValue } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';
import { onDataChanged } from '../../utils/events.js';
import { getQueryParams, replaceQueryParams, routeUrl } from '../../router.js';
import { getDeliveryMethod } from '../../domain/pricing.js';
import { getSales, getSalesSummary } from '../../services/salesService.js';

initAdmin({ active: 'ventas' });

const els = {
  form: document.getElementById('sales-filters'),
  kpis: document.getElementById('sales-kpis'),
  count: document.getElementById('sales-count'),
  table: document.getElementById('sales-table'),
};

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '');
const params = getQueryParams();
const filters = {
  desde: isDate(params.get('desde')) ? params.get('desde') : '',
  hasta: isDate(params.get('hasta')) ? params.get('hasta') : '',
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateInputValue(d);
}

const PRESETS = [
  { id: 'hoy', label: 'Hoy', range: () => [daysAgo(0), daysAgo(0)] },
  { id: '7', label: 'Últimos 7 días', range: () => [daysAgo(6), daysAgo(0)] },
  { id: '30', label: 'Últimos 30 días', range: () => [daysAgo(29), daysAgo(0)] },
  {
    id: 'mes',
    label: 'Este mes',
    range: () => {
      const now = new Date();
      return [toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), daysAgo(0)];
    },
  },
  { id: 'todo', label: 'Todo', range: () => ['', ''] },
];

const rangeError = () => (filters.desde && filters.hasta && filters.desde > filters.hasta ? 'La fecha inicial no puede ser posterior a la final.' : '');

function buildFilters() {
  const from = h('input', { type: 'date', id: 'sales-from', name: 'desde', class: 'input input--sm', value: filters.desde, max: daysAgo(0) });
  const to = h('input', { type: 'date', id: 'sales-to', name: 'hasta', class: 'input input--sm', value: filters.hasta, max: daysAgo(0) });
  const error = h('p', { class: 'field__error admin-toolbar__error', role: 'alert', hidden: true });

  const apply = () => {
    filters.desde = isDate(from.value) ? from.value : '';
    filters.hasta = isDate(to.value) ? to.value : '';
    const message = rangeError();
    error.textContent = message;
    error.hidden = !message;
    [from, to].forEach((input) => (message ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid')));
    replaceQueryParams(filters);
    render();
  };
  from.addEventListener('change', apply);
  to.addEventListener('change', apply);

  const activePreset = PRESETS.find((p) => {
    const [a, b] = p.range();
    return a === filters.desde && b === filters.hasta;
  });

  mount(
    els.form,
    h('div', { class: 'field admin-filter' }, h('label', { class: 'field__label', for: 'sales-from', text: 'Desde' }), from),
    h('div', { class: 'field admin-filter' }, h('label', { class: 'field__label', for: 'sales-to', text: 'Hasta' }), to),
    h(
      'div',
      { class: 'chip-list admin-toolbar__presets', role: 'group', 'aria-label': 'Periodos rápidos' },
      PRESETS.map((p) =>
        h('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(activePreset?.id === p.id),
          text: p.label,
          onClick: () => {
            [filters.desde, filters.hasta] = p.range();
            replaceQueryParams(filters);
            buildFilters();
            render();
          },
        }),
      ),
    ),
    error,
  );
}

els.form.addEventListener('submit', (e) => e.preventDefault());

async function render() {
  if (rangeError()) {
    mount(els.table, emptyState({ icon: 'calendar', title: 'Rango de fechas no válido', message: rangeError() }));
    els.kpis.replaceChildren();
    els.count.textContent = '';
    return;
  }
  try {
    const query = { from: filters.desde, to: filters.hasta };
    const [summary, sales] = await Promise.all([getSalesSummary(query), getSales(query)]);
    mount(
      els.kpis,
      kpiCard({ label: 'Ventas completadas', value: formatNumber(summary.count), icon: 'checkCircle', tone: 'success' }),
      kpiCard({ label: 'Importe total', value: formatMoney(summary.total), hint: 'MXN, incluye envío', icon: 'wallet', tone: 'accent' }),
      kpiCard({ label: 'Ticket promedio', value: formatMoney(summary.averageTicket), icon: 'trendingUp' }),
      kpiCard({ label: 'Unidades vendidas', value: formatNumber(summary.units), icon: 'package' }),
    );

    els.table.removeAttribute('aria-busy');
    els.count.textContent = filters.desde || filters.hasta ? `${pluralize(sales.length, 'venta')} en el periodo seleccionado` : `${pluralize(sales.length, 'venta')} en total`;
    if (!sales.length) {
      mount(els.table, emptyState({ icon: 'trendingUp', title: 'Sin ventas en este periodo', message: 'Las ventas se registran cuando un pedido se marca como completado.' }));
      return;
    }

    mount(
      els.table,
      dataTable({
        caption: 'Ventas completadas',
        columns: [
          { label: 'Venta' },
          { label: 'Pedido' },
          { label: 'Completada' },
          { label: 'Cliente' },
          { label: 'Entrega' },
          { label: 'Artículos', className: 'num' },
          { label: 'Total', className: 'num' },
        ],
        rows: sales.map((s) =>
          h(
            'tr',
            {},
            h('td', { class: 'nowrap table__primary', text: s.id }),
            h('td', { class: 'nowrap' }, h('a', { href: routeUrl('adminOrders', { id: s.orderId }), text: s.orderId })),
            h('td', { class: 'nowrap', text: formatDateTime(s.completedAt) }),
            h('td', { text: s.customerName }),
            h('td', { text: getDeliveryMethod(s.deliveryMethodId)?.label ?? '—' }),
            h('td', { class: 'num', text: formatNumber(s.itemCount) }),
            h('td', { class: 'num', text: formatMoney(s.total) }),
          ),
        ),
        footer: h(
          'tr',
          { class: 'table__total' },
          h('th', { scope: 'row', colspan: '5', text: 'Total del periodo' }),
          h('td', { class: 'num', text: formatNumber(summary.units) }),
          h('td', { class: 'num', text: formatMoney(summary.total) }),
        ),
      }),
    );
  } catch (error) {
    mount(els.table, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

buildFilters();
mount(els.table, loadingState('Cargando ventas…'));
render();
onDataChanged(['sales', 'orders'], render);
