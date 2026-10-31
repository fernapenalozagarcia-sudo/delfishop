import { initAdmin } from '../../components/adminLayout.js';
import { dataTable, kpiCard, searchInput, selectFilter } from '../../components/adminUi.js';
import { badge, stockStatusBadge } from '../../components/badges.js';
import { openDialog } from '../../components/dialog.js';
import { productImage } from '../../components/productImage.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { showToast } from '../../components/toast.js';
import { debounce, h, mount, readForm, showFieldErrors } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { formatMoney, formatNumber, normalizeText, pluralize } from '../../utils/format.js';
import { getErrorMessage, ValidationError } from '../../utils/errors.js';
import { onDataChanged } from '../../utils/events.js';
import { getQueryParams, replaceQueryParams, routeUrl } from '../../router.js';
import { CATEGORIES, getCategoryName } from '../../data/categories.js';
import { sortSizes } from '../../domain/catalogFilters.js';
import { STOCK_STATUS } from '../../domain/inventoryRules.js';
import { getInventory, getInventorySummary, updateStock } from '../../services/inventoryService.js';

initAdmin({ active: 'inventario' });

const els = {
  kpis: document.getElementById('inventory-kpis'),
  alert: document.getElementById('inventory-alert'),
  filters: document.getElementById('inventory-filters'),
  count: document.getElementById('inventory-count'),
  table: document.getElementById('inventory-table'),
};

const params = getQueryParams();
const filters = {
  q: params.get('q') ?? '',
  categoria: params.get('categoria') ?? '',
  estado: params.get('estado') ?? '',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'reponer', label: 'Requieren reposición' },
  { value: STOCK_STATUS.AVAILABLE, label: 'Disponible' },
  { value: STOCK_STATUS.LOW, label: 'Existencias bajas' },
  { value: STOCK_STATUS.OUT, label: 'Agotado' },
];

function setFilter(changes) {
  Object.assign(filters, changes);
  replaceQueryParams(filters);
  render();
}

function buildFilters() {
  mount(
    els.filters,
    searchInput({ id: 'inv-q', label: 'Buscar', placeholder: 'Nombre o SKU', value: filters.q, onInput: debounce((e) => setFilter({ q: e.target.value.trim() }), 250) }),
    selectFilter({
      id: 'inv-cat',
      label: 'Categoría',
      value: filters.categoria,
      options: [{ value: '', label: 'Todas' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))],
      onChange: (e) => setFilter({ categoria: e.target.value }),
    }),
    selectFilter({ id: 'inv-status', label: 'Estado', value: filters.estado, options: STATUS_OPTIONS, onChange: (e) => setFilter({ estado: e.target.value }) }),
    h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm admin-toolbar__clear',
      text: 'Limpiar filtros',
      onClick: () => {
        Object.assign(filters, { q: '', categoria: '', estado: '' });
        replaceQueryParams(filters);
        buildFilters();
        render();
      },
    }),
  );
}

function applyFilters(list) {
  const term = normalizeText(filters.q);
  return list.filter((p) => {
    if (term && !normalizeText(`${p.name} ${p.sku}`).includes(term)) return false;
    if (filters.categoria && p.category !== filters.categoria) return false;
    if (filters.estado === 'reponer') return p.stockStatus !== STOCK_STATUS.AVAILABLE;
    if (filters.estado && p.stockStatus !== filters.estado) return false;
    return true;
  });
}

function openAdjustDialog(product) {
  const form = h(
    'form',
    { class: 'dialog-form', novalidate: true },
    h(
      'div',
      { class: 'dialog-product' },
      productImage({ src: product.images[0], alt: '', width: 120, className: 'table__thumb' }),
      h('div', {}, h('p', { class: 'table__primary', text: product.name }), h('p', { class: 'table__secondary', text: `${product.sku} · actualmente ${product.stock} unidades` })),
    ),
    h(
      'div',
      { class: 'form-grid' },
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'adj-stock', text: 'Existencias' }),
        h('input', { id: 'adj-stock', name: 'stock', type: 'number', class: 'input', min: 0, step: 1, inputmode: 'numeric', value: product.stock, required: true }),
        h('p', { class: 'field__error', id: 'adj-stock-error', 'data-error-for': 'stock', hidden: true }),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'adj-min', text: 'Nivel mínimo' }),
        h('input', { id: 'adj-min', name: 'minStock', type: 'number', class: 'input', min: 0, step: 1, inputmode: 'numeric', value: product.minStock, required: true }),
        h('p', { class: 'field__error', id: 'adj-min-error', 'data-error-for': 'minStock', hidden: true }),
      ),
    ),
    h(
      'div',
      { class: 'quick-adjust' },
      h('span', { class: 'field__hint', text: 'Entrada rápida:' }),
      [5, 10, 25].map((n) =>
        h('button', {
          type: 'button',
          class: 'chip',
          text: `+${n}`,
          onClick: () => {
            const input = form.elements.namedItem('stock');
            input.value = String((Number(input.value) || 0) + n);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          },
        }),
      ),
    ),
    h('p', { class: 'field__hint', text: 'Un producto con existencias iguales o menores al mínimo se marca como «Existencias bajas».' }),
  );

  const save = h('button', { type: 'submit', class: 'btn btn--primary', text: 'Guardar cambios' });
  save.setAttribute('form', 'adjust-form');
  form.id = 'adjust-form';

  const { close } = openDialog({
    title: 'Ajustar inventario',
    body: form,
    footer: [h('button', { type: 'button', class: 'btn btn--ghost', text: 'Cancelar', onClick: () => close() }), save],
  });
  form.elements.namedItem('stock').select();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = readForm(form);
    try {
      await updateStock(product.id, data);
      close();
      showToast(`Inventario de «${product.name}» actualizado: ${data.stock} unidades.`);
    } catch (error) {
      if (error instanceof ValidationError) showFieldErrors(form, error.fieldErrors);
      else showToast(getErrorMessage(error), { type: 'error' });
    }
  });
}

function renderKpis(summary) {
  mount(
    els.kpis,
    kpiCard({ label: 'Unidades en inventario', value: formatNumber(summary.totalUnits), hint: pluralize(summary.totalProducts, 'producto'), icon: 'package' }),
    kpiCard({ label: 'Existencias bajas', value: formatNumber(summary.lowStock), hint: 'En o bajo el mínimo', icon: 'alert', tone: summary.lowStock ? 'warning' : 'neutral' }),
    kpiCard({ label: 'Agotados', value: formatNumber(summary.outOfStock), hint: 'Sin unidades', icon: 'x', tone: summary.outOfStock ? 'danger' : 'neutral' }),
    kpiCard({ label: 'Valor a precio de venta', value: formatMoney(summary.inventoryValue), hint: 'Referencia estimada', icon: 'wallet' }),
  );

  const needs = summary.lowStock + summary.outOfStock;
  mount(
    els.alert,
    needs > 0 &&
      h(
        'div',
        { class: 'alert alert--warning admin-alert', role: 'status' },
        icon('alert', { size: 18 }),
        h('span', { text: `${pluralize(needs, 'producto requiere', 'productos requieren')} reposición (${summary.outOfStock} agotados y ${summary.lowStock} con existencias bajas).` }),
        filters.estado !== 'reponer' && h('button', { type: 'button', class: 'link-button', text: 'Ver solo estos', onClick: () => { setFilter({ estado: 'reponer' }); buildFilters(); } }),
      ),
  );
}

function renderTable(list) {
  els.table.removeAttribute('aria-busy');
  els.count.textContent = pluralize(list.length, 'producto');
  if (!list.length) {
    mount(els.table, emptyState({ icon: 'package', title: 'Sin resultados', message: 'Ningún producto coincide con los filtros.' }));
    return;
  }
  mount(
    els.table,
    dataTable({
      caption: 'Inventario de productos',
      columns: [
        { label: 'Producto' },
        { label: 'SKU' },
        { label: 'Categoría' },
        { label: 'Tallas y colores' },
        { label: 'Existencias', className: 'num' },
        { label: 'Mínimo', className: 'num' },
        { label: 'Estado' },
        { label: 'Acciones', className: 'num' },
      ],
      rows: list.map((p) =>
        h(
          'tr',
          { class: p.stockStatus === STOCK_STATUS.OUT ? 'row--danger' : p.stockStatus === STOCK_STATUS.LOW ? 'row--alert' : null },
          h(
            'td',
            {},
            h(
              'div',
              { class: 'table__product' },
              productImage({ src: p.images[0], alt: '', width: 96, className: 'table__thumb' }),
              h('div', {}, h('p', { class: 'table__primary', text: p.name }), !p.published && badge('No publicado', 'neutral')),
            ),
          ),
          h('td', { class: 'nowrap', text: p.sku }),
          h('td', { text: getCategoryName(p.category) }),
          h(
            'td',
            {},
            h('p', { class: 'table__secondary', text: sortSizes(p.sizes).join(', ') }),
            h('p', { class: 'table__colors' }, p.colors.map((c) => h('span', { class: 'color-dot', title: c.name, style: { '--swatch': c.hex } }, h('span', { class: 'sr-only', text: c.name })))),
          ),
          h('td', { class: 'num table__stock', text: formatNumber(p.stock) }),
          h('td', { class: 'num', text: formatNumber(p.minStock) }),
          h('td', {}, stockStatusBadge(p)),
          h(
            'td',
            {},
            h(
              'div',
              { class: 'table__actions' },
              h('button', { type: 'button', class: 'btn btn--outline btn--sm', 'aria-label': `Ajustar existencias de ${p.name}`, onClick: () => openAdjustDialog(p) }, icon('package', { size: 16 }), 'Ajustar'),
              h('a', { class: 'icon-button icon-button--sm', href: routeUrl('adminProductForm', { id: p.id }), 'aria-label': `Editar ${p.name}`, title: 'Editar producto' }, icon('edit', { size: 18 })),
            ),
          ),
        ),
      ),
    }),
  );
}

async function render() {
  try {
    const [summary, inventory] = await Promise.all([getInventorySummary(), getInventory()]);
    renderKpis(summary);
    const order = { agotado: 0, bajo: 1, disponible: 2 };
    renderTable(applyFilters(inventory).sort((a, b) => order[a.stockStatus] - order[b.stockStatus] || a.name.localeCompare(b.name, 'es')));
  } catch (error) {
    mount(els.table, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

buildFilters();
mount(els.table, loadingState('Cargando inventario…'));
render();
onDataChanged(['products'], render);
