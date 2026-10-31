import { initAdmin } from '../../components/adminLayout.js';
import { dataTable, searchInput, selectFilter } from '../../components/adminUi.js';
import { badge, stockStatusBadge } from '../../components/badges.js';
import { confirmDialog } from '../../components/dialog.js';
import { productImage } from '../../components/productImage.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { showToast } from '../../components/toast.js';
import { debounce, h, mount } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { formatMoney, formatNumber, normalizeText, pluralize } from '../../utils/format.js';
import { getErrorMessage } from '../../utils/errors.js';
import { onDataChanged } from '../../utils/events.js';
import { getQueryParams, replaceQueryParams, routeUrl } from '../../router.js';
import { CATEGORIES, getCategoryName, getSubcategoryName } from '../../data/categories.js';
import { deleteProduct, getProducts, setProductPublished } from '../../services/productService.js';
import { getOrders } from '../../services/orderService.js';

initAdmin({ active: 'productos' });

const els = {
  filters: document.getElementById('product-filters'),
  count: document.getElementById('product-count'),
  table: document.getElementById('product-table'),
  newButton: document.getElementById('new-product'),
};
els.newButton.prepend(icon('plus', { size: 18 }));

const params = getQueryParams();
const filters = {
  q: params.get('q') ?? '',
  categoria: params.get('categoria') ?? '',
  publicacion: params.get('publicacion') ?? '',
  destacado: params.get('destacado') ?? '',
};

function setFilter(changes) {
  Object.assign(filters, changes);
  replaceQueryParams(filters);
  render();
}

function buildFilters() {
  mount(
    els.filters,
    searchInput({ id: 'prod-q', label: 'Buscar', placeholder: 'Nombre, SKU o descripción', value: filters.q, onInput: debounce((e) => setFilter({ q: e.target.value.trim() }), 250) }),
    selectFilter({
      id: 'prod-cat',
      label: 'Categoría',
      value: filters.categoria,
      options: [{ value: '', label: 'Todas' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))],
      onChange: (e) => setFilter({ categoria: e.target.value }),
    }),
    selectFilter({
      id: 'prod-pub',
      label: 'Publicación',
      value: filters.publicacion,
      options: [
        { value: '', label: 'Todos' },
        { value: 'publicado', label: 'Publicados' },
        { value: 'oculto', label: 'No publicados' },
      ],
      onChange: (e) => setFilter({ publicacion: e.target.value }),
    }),
    selectFilter({
      id: 'prod-feat',
      label: 'Destacado',
      value: filters.destacado,
      options: [
        { value: '', label: 'Todos' },
        { value: 'si', label: 'Destacados' },
        { value: 'no', label: 'No destacados' },
      ],
      onChange: (e) => setFilter({ destacado: e.target.value }),
    }),
    h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm admin-toolbar__clear',
      text: 'Limpiar filtros',
      onClick: () => {
        Object.assign(filters, { q: '', categoria: '', publicacion: '', destacado: '' });
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
    if (term && !normalizeText(`${p.name} ${p.sku} ${p.description}`).includes(term)) return false;
    if (filters.categoria && p.category !== filters.categoria) return false;
    if (filters.publicacion === 'publicado' && !p.published) return false;
    if (filters.publicacion === 'oculto' && p.published) return false;
    if (filters.destacado === 'si' && !p.featured) return false;
    if (filters.destacado === 'no' && p.featured) return false;
    return true;
  });
}

async function togglePublished(product) {
  try {
    await setProductPublished(product.id, !product.published);
    showToast(product.published ? `«${product.name}» ya no se muestra en la tienda.` : `«${product.name}» ahora está publicado.`, { type: product.published ? 'info' : 'success' });
  } catch (error) {
    showToast(getErrorMessage(error), { type: 'error' });
  }
}

async function handleDelete(product) {
  const orders = await getOrders();
  const related = orders.filter((o) => o.items.some((i) => i.productId === product.id)).length;
  const confirmed = await confirmDialog({
    title: `¿Eliminar «${product.name}»?`,
    message:
      related > 0
        ? `Este producto aparece en ${pluralize(related, 'pedido')}. Los pedidos conservarán su copia del producto, pero se eliminará del catálogo y del inventario. Si solo quieres ocultarlo, desactiva su publicación.`
        : 'El producto se eliminará del catálogo y del inventario. Esta acción no se puede deshacer. Si solo quieres ocultarlo, desactiva su publicación.',
    confirmLabel: 'Eliminar producto',
  });
  if (!confirmed) return;
  try {
    await deleteProduct(product.id);
    showToast(`«${product.name}» se eliminó del catálogo.`, { type: 'info' });
  } catch (error) {
    showToast(getErrorMessage(error), { type: 'error' });
  }
}

function publishSwitch(product) {
  return h(
    'button',
    {
      type: 'button',
      class: 'switch',
      role: 'switch',
      'aria-checked': String(product.published),
      'aria-label': `Publicar ${product.name} en la tienda`,
      onClick: () => togglePublished(product),
    },
    h('span', { class: 'switch__thumb' }),
    h('span', { class: 'switch__text', text: product.published ? 'Publicado' : 'Oculto' }),
  );
}

function renderTable(list) {
  els.table.removeAttribute('aria-busy');
  els.count.textContent = pluralize(list.length, 'producto');
  if (!list.length) {
    mount(
      els.table,
      emptyState({
        icon: 'shirt',
        title: 'No hay productos que coincidan',
        message: 'Ajusta los filtros o registra un producto nuevo.',
        actions: [{ label: 'Nuevo producto', href: routeUrl('adminProductForm') }],
      }),
    );
    return;
  }
  mount(
    els.table,
    dataTable({
      caption: 'Productos registrados',
      columns: [
        { label: 'Producto' },
        { label: 'Categoría' },
        { label: 'Precio', className: 'num' },
        { label: 'Existencias', className: 'num' },
        { label: 'Publicación' },
        { label: 'Acciones', className: 'num' },
      ],
      rows: list.map((p) =>
        h(
          'tr',
          {},
          h(
            'td',
            {},
            h(
              'div',
              { class: 'table__product' },
              productImage({ src: p.images[0], alt: '', width: 96, className: 'table__thumb' }),
              h(
                'div',
                {},
                h('a', { class: 'table__primary', href: routeUrl('adminProductForm', { id: p.id }), text: p.name }),
                h('p', { class: 'table__secondary', text: p.sku }),
                h('p', { class: 'table__tags' }, p.featured && badge('Destacado', 'accent'), p.isNew && badge('Nuevo', 'neutral'), p.compareAtPrice > p.price && badge('Oferta', 'danger')),
              ),
            ),
          ),
          h('td', {}, h('p', { text: getCategoryName(p.category) }), h('p', { class: 'table__secondary', text: getSubcategoryName(p.subcategory) })),
          h('td', { class: 'num' }, h('p', { text: formatMoney(p.price) }), p.compareAtPrice > p.price && h('s', { class: 'table__secondary', text: formatMoney(p.compareAtPrice) })),
          h('td', { class: 'num' }, h('p', { text: formatNumber(p.stock) }), stockStatusBadge(p)),
          h('td', {}, publishSwitch(p)),
          h(
            'td',
            {},
            h(
              'div',
              { class: 'table__actions' },
              p.published && h('a', { class: 'icon-button icon-button--sm', href: routeUrl('product', { id: p.id }), target: '_blank', rel: 'noopener', 'aria-label': `Ver ${p.name} en la tienda (pestaña nueva)`, title: 'Ver en la tienda' }, icon('eye', { size: 18 })),
              h('a', { class: 'icon-button icon-button--sm', href: routeUrl('adminProductForm', { id: p.id }), 'aria-label': `Editar ${p.name}`, title: 'Editar' }, icon('edit', { size: 18 })),
              h('button', { type: 'button', class: 'icon-button icon-button--sm icon-button--danger', 'aria-label': `Eliminar ${p.name}`, title: 'Eliminar', onClick: () => handleDelete(p) }, icon('trash', { size: 18 })),
            ),
          ),
        ),
      ),
    }),
  );
}

async function render() {
  try {
    const products = await getProducts({ includeUnpublished: true });
    renderTable(applyFilters(products).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  } catch (error) {
    mount(els.table, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

buildFilters();
mount(els.table, loadingState('Cargando productos…'));
render();
onDataChanged(['products'], render);
