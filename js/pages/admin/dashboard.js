import { initAdmin } from '../../components/adminLayout.js';
import { dataTable, kpiCard } from '../../components/adminUi.js';
import { orderStatusBadge, stockStatusBadge } from '../../components/badges.js';
import { productImage } from '../../components/productImage.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { h, mount } from '../../utils/dom.js';
import { formatDateTime, formatMoney, formatNumber, pluralize, toDateInputValue } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';
import { onDataChanged } from '../../utils/events.js';
import { routeUrl } from '../../router.js';
import { ORDER_STATUS_META, ORDER_STATUS_ORDER } from '../../domain/orderStatus.js';
import { getInventory, getInventorySummary } from '../../services/inventoryService.js';
import { getOrders, getOrderStats } from '../../services/orderService.js';
import { getSales, getSalesSummary } from '../../services/salesService.js';

initAdmin({ active: 'dashboard' });

const els = {
  kpis: document.getElementById('kpi-grid'),
  chart: document.getElementById('sales-chart'),
  status: document.getElementById('status-breakdown'),
  recent: document.getElementById('recent-orders'),
  stock: document.getElementById('stock-alerts'),
  updated: document.getElementById('dashboard-updated'),
};

function renderKpis({ inventory, stats, sales }) {
  const { counts } = stats;
  const inProgress = (counts.en_preparacion ?? 0) + (counts.enviado ?? 0);
  mount(
    els.kpis,
    kpiCard({ label: 'Productos registrados', value: formatNumber(inventory.totalProducts), hint: `${inventory.publishedProducts} publicados`, icon: 'shirt', href: routeUrl('adminProducts') }),
    kpiCard({ label: 'Unidades en inventario', value: formatNumber(inventory.totalUnits), hint: `${inventory.lowStock} bajas · ${inventory.outOfStock} agotados`, icon: 'package', tone: inventory.lowStock + inventory.outOfStock ? 'warning' : 'neutral', href: routeUrl('adminInventory') }),
    kpiCard({ label: 'Pedidos pendientes', value: formatNumber(counts.pendiente), hint: 'Por confirmar', icon: 'clock', tone: counts.pendiente ? 'warning' : 'neutral', href: routeUrl('adminOrders', { estado: 'pendiente' }) }),
    kpiCard({ label: 'Pedidos confirmados', value: formatNumber(counts.confirmado), hint: `${inProgress} en preparación o enviados`, icon: 'clipboard', tone: 'info', href: routeUrl('adminOrders', { estado: 'confirmado' }) }),
    kpiCard({ label: 'Pedidos completados', value: formatNumber(counts.completado), hint: `${counts.cancelado} cancelados`, icon: 'checkCircle', tone: 'success', href: routeUrl('adminOrders', { estado: 'completado' }) }),
    kpiCard({ label: 'Ventas completadas', value: formatMoney(sales.total), hint: `${pluralize(sales.count, 'venta')} · ticket prom. ${formatMoney(sales.averageTicket)}`, icon: 'wallet', tone: 'accent', href: routeUrl('adminSales') }),
  );
  els.kpis.removeAttribute('aria-busy');
}

function renderChart(sales) {
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({ key: toDateInputValue(d), date: d, total: 0, count: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const sale of sales) {
    const day = byKey.get(toDateInputValue(sale.completedAt));
    if (day) {
      day.total += sale.total;
      day.count += 1;
    }
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  const total = days.reduce((s, d) => s + d.total, 0);
  const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
  const dayMonth = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

  mount(
    els.chart,
    h('p', { class: 'chart__total' }, h('strong', { text: formatMoney(total) }), ` en ${pluralize(days.reduce((s, d) => s + d.count, 0), 'venta')}`),
    h(
      'ol',
      { class: 'chart', 'aria-label': 'Importe vendido por día' },
      days.map((d) =>
        h(
          'li',
          { class: 'chart__col', title: `${dayMonth.format(d.date)}: ${formatMoney(d.total)}` },
          h('span', { class: 'chart__bar', style: { height: `${Math.max((d.total / max) * 100, d.total ? 4 : 0)}%` } }),
          h('span', { class: 'chart__label', 'aria-hidden': 'true', text: weekday.format(d.date).slice(0, 2) }),
          h('span', { class: 'sr-only', text: `${dayMonth.format(d.date)}: ${formatMoney(d.total)}` }),
        ),
      ),
    ),
  );
}

function renderStatus(stats) {
  const max = Math.max(...Object.values(stats.counts), 1);
  mount(
    els.status,
    h(
      'ul',
      { class: 'status-bars' },
      ORDER_STATUS_ORDER.map((status) =>
        h(
          'li',
          {},
          h('a', { class: 'status-bars__row', href: routeUrl('adminOrders', { estado: status }) },
            h('span', { class: 'status-bars__label', text: ORDER_STATUS_META[status].label }),
            h('span', { class: 'status-bars__track' }, h('span', { class: `status-bars__fill status-bars__fill--${ORDER_STATUS_META[status].tone}`, style: { width: `${(stats.counts[status] / max) * 100}%` } })),
            h('span', { class: 'status-bars__value', text: formatNumber(stats.counts[status]) }),
          ),
        ),
      ),
    ),
    h('p', { class: 'field__hint', text: `Total: ${pluralize(stats.total, 'pedido')}. Solo los completados cuentan como venta.` }),
  );
}

function renderRecent(orders) {
  if (!orders.length) {
    mount(els.recent, emptyState({ icon: 'clipboard', title: 'Aún no hay pedidos', message: 'Los pedidos generados en la tienda aparecerán aquí.' }));
    return;
  }
  mount(
    els.recent,
    dataTable({
      caption: 'Pedidos recientes',
      columns: [{ label: 'Pedido' }, { label: 'Fecha' }, { label: 'Cliente' }, { label: 'Total', className: 'num' }, { label: 'Estado' }],
      rows: orders.slice(0, 6).map((o) =>
        h(
          'tr',
          {},
          h('td', {}, h('a', { class: 'table__primary', href: routeUrl('adminOrders', { id: o.id }), text: o.id })),
          h('td', { class: 'nowrap', text: formatDateTime(o.createdAt) }),
          h('td', { text: o.customer.name }),
          h('td', { class: 'num', text: formatMoney(o.totals.total) }),
          h('td', {}, orderStatusBadge(o.status)),
        ),
      ),
    }),
  );
}

function renderStockAlerts(inventory) {
  const alerts = inventory.filter((p) => p.stockStatus !== 'disponible').sort((a, b) => a.stock - b.stock);
  if (!alerts.length) {
    mount(els.stock, emptyState({ icon: 'checkCircle', title: 'Todo en orden', message: 'Ningún producto está por debajo de su mínimo.' }));
    return;
  }
  mount(
    els.stock,
    h(
      'ul',
      { class: 'stock-alerts' },
      alerts.slice(0, 6).map((p) =>
        h(
          'li',
          { class: 'stock-alerts__item' },
          productImage({ src: p.images[0], alt: '', width: 80, className: 'table__thumb' }),
          h('div', { class: 'stock-alerts__info' }, h('p', { class: 'table__primary', text: p.name }), h('p', { class: 'table__secondary', text: `${p.stock} de mínimo ${p.minStock} · ${p.sku}` })),
          stockStatusBadge(p),
        ),
      ),
    ),
    alerts.length > 6 && h('p', { class: 'field__hint', text: `y ${alerts.length - 6} más…` }),
  );
}

async function render() {
  try {
    const [inventory, inventoryList, stats, salesSummary, sales, orders] = await Promise.all([
      getInventorySummary(),
      getInventory(),
      getOrderStats(),
      getSalesSummary(),
      getSales(),
      getOrders(),
    ]);
    renderKpis({ inventory, stats, sales: salesSummary });
    renderChart(sales);
    renderStatus(stats);
    renderRecent(orders);
    renderStockAlerts(inventoryList);
    els.updated.textContent = `Actualizado: ${formatDateTime(new Date().toISOString())}`;
  } catch (error) {
    mount(els.kpis, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

mount(els.kpis, loadingState('Calculando indicadores…'));
render();
onDataChanged(['products', 'orders', 'sales'], render);
