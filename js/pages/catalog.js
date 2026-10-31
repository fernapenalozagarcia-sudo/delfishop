import { initStorefront } from '../app.js';
import { h, mount, debounce } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoney, pluralize } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import { onDataChanged } from '../utils/events.js';
import { getQueryParams, replaceQueryParams, routeUrl } from '../router.js';
import { CATEGORIES, getCategoryName, getSubcategoryName } from '../data/categories.js';
import {
  countActiveFilters,
  criteriaFromParams,
  criteriaToParams,
  EMPTY_CRITERIA,
  PRICE_RANGES,
  SORT_OPTIONS,
  sortSizes,
} from '../domain/catalogFilters.js';
import { queryProducts } from '../services/productService.js';
import { createProductCard } from '../components/productCard.js';
import { emptyState, errorState } from '../components/states.js';

initStorefront({ active: 'catalogo' });

const PAGE_SIZE = 12;

const els = {
  title: document.getElementById('catalog-title'),
  description: document.getElementById('catalog-description'),
  breadcrumb: document.getElementById('breadcrumb'),
  categoryChips: document.getElementById('category-chips'),
  subcategoryChips: document.getElementById('subcategory-chips'),
  form: document.getElementById('filters-form'),
  panel: document.getElementById('filters-panel'),
  backdrop: document.getElementById('filters-backdrop'),
  toggle: document.getElementById('filters-toggle'),
  close: document.getElementById('filters-close'),
  apply: document.getElementById('filters-apply'),
  clear: document.getElementById('clear-filters'),
  count: document.getElementById('results-count'),
  sort: document.getElementById('sort-select'),
  active: document.getElementById('active-filters'),
  results: document.getElementById('product-results'),
  loadMore: document.getElementById('load-more'),
};

let criteria = sanitizeCriteria(criteriaFromParams(getQueryParams()));
let facets = { sizes: [], colors: [], maxPrice: 0 };
let facetsCategory = null;
let visibleCount = PAGE_SIZE;
let lastItems = [];

function sanitizeCriteria(c) {
  const category = CATEGORIES.find((cat) => cat.id === c.categoria);
  return {
    ...c,
    categoria: category ? category.id : '',
    subcategoria: category && category.subcategories.includes(c.subcategoria) ? c.subcategoria : '',
  };
}

function priceError(c) {
  return c.min !== '' && c.max !== '' && Number(c.min) > Number(c.max) ? 'El precio mínimo no puede ser mayor que el máximo.' : '';
}

/** Criterios efectivos: si el rango de precio es incoherente no se aplica. */
function effectiveCriteria() {
  return priceError(criteria) ? { ...criteria, min: '', max: '' } : criteria;
}

function setCriteria(changes, { rebuildFilters = false } = {}) {
  const previousCategory = criteria.categoria;
  criteria = sanitizeCriteria({ ...criteria, ...changes });
  visibleCount = PAGE_SIZE;
  replaceQueryParams(criteriaToParams(criteria));
  const categoryChanged = previousCategory !== criteria.categoria;
  update({ rebuildFilters: rebuildFilters || categoryChanged });
}

// ---------- Encabezado y navegación por categorías ----------

function renderHeading() {
  const category = CATEGORIES.find((c) => c.id === criteria.categoria);
  let title = 'Todo el catálogo';
  let description = 'Explora todas nuestras prendas para la familia.';
  if (category) {
    title = criteria.subcategoria ? `${getSubcategoryName(criteria.subcategoria)} · ${category.name}` : category.name;
    description = category.description;
  } else if (criteria.ofertas) {
    title = 'Ofertas';
    description = 'Precios especiales en prendas seleccionadas, hasta agotar existencias.';
  } else if (criteria.novedades) {
    title = 'Novedades';
    description = 'Los lanzamientos más recientes de la temporada.';
  } else if (criteria.destacados) {
    title = 'Destacados';
    description = 'Las piezas favoritas de nuestros clientes.';
  }
  if (criteria.q) {
    title = `Resultados para “${criteria.q}”`;
    description = category ? `Buscando en ${category.name}.` : 'Buscando en todo el catálogo.';
  }
  els.title.textContent = title;
  els.description.textContent = description;
  document.title = `${title} · OLMO`;

  mount(
    els.breadcrumb,
    h('li', {}, h('a', { href: routeUrl('home'), text: 'Inicio' })),
    category
      ? [
          h('li', {}, h('a', { href: routeUrl('catalog'), text: 'Catálogo' })),
          h('li', {}, h('span', { 'aria-current': 'page', text: category.name })),
        ]
      : h('li', {}, h('span', { 'aria-current': 'page', text: 'Catálogo' })),
  );
}

function chip(label, pressed, onClick) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), text: label, onClick });
}

function renderCategoryChips() {
  mount(
    els.categoryChips,
    chip('Todo', !criteria.categoria, () => setCriteria({ categoria: '', subcategoria: '' })),
    CATEGORIES.map((c) => chip(c.name, criteria.categoria === c.id, () => setCriteria({ categoria: c.id, subcategoria: '' }))),
  );

  const category = CATEGORIES.find((c) => c.id === criteria.categoria);
  els.subcategoryChips.hidden = !category;
  if (!category) {
    els.subcategoryChips.replaceChildren();
    return;
  }
  mount(
    els.subcategoryChips,
    chip('Todas', !criteria.subcategoria, () => setCriteria({ subcategoria: '' })),
    category.subcategories.map((sub) => chip(getSubcategoryName(sub), criteria.subcategoria === sub, () => setCriteria({ subcategoria: sub }))),
  );
}

// ---------- Panel de filtros ----------

function filterGroup(title, ...content) {
  return h('fieldset', { class: 'filter-group' }, h('legend', { class: 'filter-group__title', text: title }), content);
}

function checkboxOption({ name, value, label, checked, onChange, className = 'option option--sm' }) {
  const id = `f-${name}-${String(value).replace(/\W+/g, '_')}`;
  return h(
    'span',
    { class: className },
    h('input', { type: 'checkbox', id, name, value, class: 'option__input', checked, onChange }),
    h('label', { for: id, class: 'option__label', text: label }),
  );
}

function toggleInList(list, value, on) {
  const set = new Set(list);
  if (on) set.add(value);
  else set.delete(value);
  return [...set];
}

function buildFilters() {
  const focusedId = document.activeElement?.id;

  // Las opciones seleccionadas se conservan aunque no existan en la categoría actual.
  const sizes = sortSizes([...new Set([...facets.sizes, ...criteria.tallas])]);
  const colorMap = new Map(facets.colors.map((c) => [c.name, c.hex]));
  criteria.colores.forEach((name) => colorMap.has(name) || colorMap.set(name, '#cccccc'));
  const colors = [...colorMap.entries()].map(([name, hex]) => ({ name, hex }));

  const searchInput = h('input', {
    type: 'search',
    id: 'filter-q',
    name: 'q',
    class: 'input',
    placeholder: 'Nombre, descripción o categoría',
    value: criteria.q,
    maxlength: '80',
    autocomplete: 'off',
  });
  searchInput.addEventListener('input', debounce(() => setCriteria({ q: searchInput.value.trim() }), 300));

  const categorySelect = h(
    'select',
    { id: 'filter-categoria', name: 'categoria', class: 'select', onChange: (e) => setCriteria({ categoria: e.target.value, subcategoria: '' }) },
    h('option', { value: '', text: 'Todas las categorías' }),
    CATEGORIES.map((c) => h('option', { value: c.id, text: c.name, selected: criteria.categoria === c.id })),
  );

  const currentRange = PRICE_RANGES.find((r) => String(r.min) === String(criteria.min) && String(r.max ?? '') === String(criteria.max));
  const rangeOptions = h(
    'div',
    { class: 'filter-ranges' },
    PRICE_RANGES.map((range) => {
      const id = `f-rango-${range.id}`;
      return h(
        'label',
        { class: 'radio', for: id },
        h('input', {
          type: 'radio',
          id,
          name: 'rango',
          value: range.id,
          checked: currentRange?.id === range.id,
          onChange: () => setCriteria({ min: String(range.min), max: range.max === null ? '' : String(range.max) }, { rebuildFilters: true }),
        }),
        h('span', { text: range.label }),
      );
    }),
  );

  const priceMessage = h('p', { class: 'field__error', id: 'price-error', role: 'alert', text: priceError(criteria), hidden: !priceError(criteria) });
  const minInput = h('input', { type: 'number', id: 'filter-min', name: 'min', class: 'input input--sm', min: 0, step: 50, inputmode: 'numeric', placeholder: '0', value: criteria.min });
  const maxInput = h('input', {
    type: 'number',
    id: 'filter-max',
    name: 'max',
    class: 'input input--sm',
    min: 0,
    step: 50,
    inputmode: 'numeric',
    placeholder: facets.maxPrice ? String(Math.ceil(facets.maxPrice / 100) * 100) : 'Máx.',
    value: criteria.max,
  });
  const onPriceInput = debounce(() => {
    const clean = (v) => (v === '' || Number(v) < 0 || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v))));
    setCriteria({ min: clean(minInput.value), max: clean(maxInput.value) });
    const error = priceError(criteria);
    priceMessage.textContent = error;
    priceMessage.hidden = !error;
    [minInput, maxInput].forEach((input) => (error ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid')));
    rangeOptions.querySelectorAll('input').forEach((radio) => {
      const range = PRICE_RANGES.find((r) => r.id === radio.value);
      radio.checked = String(range.min) === criteria.min && String(range.max ?? '') === criteria.max;
    });
  }, 400);
  minInput.addEventListener('input', onPriceInput);
  maxInput.addEventListener('input', onPriceInput);

  mount(
    els.form,
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-q', text: 'Buscar' }), searchInput),
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-categoria', text: 'Categoría' }), categorySelect),
    filterGroup(
      'Precio',
      rangeOptions,
      h(
        'div',
        { class: 'filter-price' },
        h('div', { class: 'field' }, h('label', { class: 'field__hint', for: 'filter-min', text: 'Mínimo ($)' }), minInput),
        h('span', { class: 'filter-price__sep', 'aria-hidden': 'true', text: '–' }),
        h('div', { class: 'field' }, h('label', { class: 'field__hint', for: 'filter-max', text: 'Máximo ($)' }), maxInput),
      ),
      priceMessage,
    ),
    filterGroup(
      'Talla',
      sizes.length
        ? h(
            'div',
            { class: 'option-group' },
            sizes.map((size) =>
              checkboxOption({
                name: 'tallas',
                value: size,
                label: size,
                checked: criteria.tallas.includes(size),
                onChange: (e) => setCriteria({ tallas: toggleInList(criteria.tallas, size, e.target.checked) }),
              }),
            ),
          )
        : h('p', { class: 'field__hint', text: 'Sin tallas disponibles.' }),
    ),
    filterGroup(
      'Color',
      h(
        'div',
        { class: 'filter-colors' },
        colors.map((color) => {
          const id = `f-color-${color.name.replace(/\W+/g, '_')}`;
          return h(
            'label',
            { class: 'color-option', for: id },
            h('input', {
              type: 'checkbox',
              id,
              name: 'colores',
              value: color.name,
              checked: criteria.colores.includes(color.name),
              onChange: (e) => setCriteria({ colores: toggleInList(criteria.colores, color.name, e.target.checked) }),
            }),
            h('span', { class: 'color-dot', style: { '--swatch': color.hex } }),
            h('span', { text: color.name }),
          );
        }),
      ),
    ),
    filterGroup(
      'Disponibilidad',
      h(
        'label',
        { class: 'checkbox', for: 'f-disponibles' },
        h('input', { type: 'checkbox', id: 'f-disponibles', checked: criteria.disponibles, onChange: (e) => setCriteria({ disponibles: e.target.checked }) }),
        h('span', { text: 'Solo productos disponibles' }),
      ),
    ),
    filterGroup(
      'Colección',
      [
        ['destacados', 'Destacados'],
        ['novedades', 'Novedades'],
        ['ofertas', 'En oferta'],
      ].map(([key, label]) =>
        h(
          'label',
          { class: 'checkbox', for: `f-${key}` },
          h('input', { type: 'checkbox', id: `f-${key}`, checked: criteria[key], onChange: (e) => setCriteria({ [key]: e.target.checked }) }),
          h('span', { text: label }),
        ),
      ),
    ),
  );

  if (focusedId) document.getElementById(focusedId)?.focus();
}

// ---------- Filtros activos ----------

function renderActiveFilters() {
  const chips = [];
  const remove = (label, changes) =>
    chips.push(
      h(
        'button',
        { type: 'button', class: 'chip chip--removable', 'aria-label': `Quitar filtro: ${label}`, onClick: () => setCriteria(changes, { rebuildFilters: true }) },
        h('span', { text: label }),
        icon('x', { size: 14 }),
      ),
    );

  if (criteria.q) remove(`“${criteria.q}”`, { q: '' });
  if (criteria.categoria) remove(getCategoryName(criteria.categoria), { categoria: '', subcategoria: '' });
  if (criteria.subcategoria) remove(getSubcategoryName(criteria.subcategoria), { subcategoria: '' });
  if (!priceError(criteria)) {
    if (criteria.min !== '' && criteria.max !== '') remove(`${formatMoney(criteria.min)} – ${formatMoney(criteria.max)}`, { min: '', max: '' });
    else if (criteria.min !== '') remove(`Desde ${formatMoney(criteria.min)}`, { min: '' });
    else if (criteria.max !== '') remove(`Hasta ${formatMoney(criteria.max)}`, { max: '' });
  }
  criteria.tallas.forEach((s) => remove(`Talla ${s}`, { tallas: criteria.tallas.filter((x) => x !== s) }));
  criteria.colores.forEach((c) => remove(c, { colores: criteria.colores.filter((x) => x !== c) }));
  if (criteria.disponibles) remove('Disponibles', { disponibles: false });
  if (criteria.destacados) remove('Destacados', { destacados: false });
  if (criteria.novedades) remove('Novedades', { novedades: false });
  if (criteria.ofertas) remove('En oferta', { ofertas: false });

  if (chips.length > 1) {
    chips.push(h('button', { type: 'button', class: 'link-button', text: 'Limpiar todo', onClick: clearFilters }));
  }
  mount(els.active, chips);
  els.active.hidden = chips.length === 0;

  const n = countActiveFilters(criteria);
  els.toggle.textContent = n ? `Filtros (${n})` : 'Filtros';
}

function clearFilters() {
  criteria = { ...EMPTY_CRITERIA, tallas: [], colores: [], orden: criteria.orden };
  visibleCount = PAGE_SIZE;
  replaceQueryParams(criteriaToParams(criteria));
  update({ rebuildFilters: true });
}

// ---------- Resultados ----------

function renderResults(items) {
  lastItems = items;
  els.results.removeAttribute('aria-busy');
  els.count.textContent = items.length ? `${pluralize(items.length, 'producto')} ${items.length === 1 ? 'encontrado' : 'encontrados'}` : 'Sin resultados';
  els.apply.textContent = items.length ? `Ver ${pluralize(items.length, 'resultado')}` : 'Ver resultados';

  if (!items.length) {
    mount(
      els.results,
      emptyState({
        icon: 'search',
        title: 'No encontramos productos',
        message: criteria.q
          ? `No hay productos que coincidan con “${criteria.q}” y los filtros seleccionados. Prueba con otras palabras o quita algunos filtros.`
          : 'Ningún producto coincide con la combinación de filtros. Quita algunos filtros para ver más opciones.',
        actions: [
          { label: 'Limpiar filtros', onClick: clearFilters },
          { label: 'Ver todo el catálogo', href: routeUrl('catalog'), variant: 'btn--outline' },
        ],
      }),
    );
    els.loadMore.replaceChildren();
    return;
  }

  mount(els.results, h('div', { class: 'product-grid' }, items.slice(0, visibleCount).map(createProductCard)));

  if (items.length > visibleCount) {
    mount(
      els.loadMore,
      h('p', { class: 'load-more__text', text: `Mostrando ${visibleCount} de ${items.length}` }),
      h('button', {
        type: 'button',
        class: 'btn btn--outline',
        text: 'Mostrar más productos',
        onClick: () => {
          visibleCount += PAGE_SIZE;
          renderResults(lastItems);
        },
      }),
    );
  } else {
    els.loadMore.replaceChildren();
  }
}

async function update({ rebuildFilters = false } = {}) {
  renderHeading();
  renderCategoryChips();
  els.sort.value = criteria.orden;
  try {
    const result = await queryProducts(effectiveCriteria());
    facets = result.facets;
    if (rebuildFilters || facetsCategory !== criteria.categoria) {
      facetsCategory = criteria.categoria;
      buildFilters();
    }
    renderActiveFilters();
    renderResults(result.items);
  } catch (error) {
    els.count.textContent = '';
    mount(els.results, errorState({ message: getErrorMessage(error), onRetry: () => update({ rebuildFilters: true }) }));
  }
}

// ---------- Panel móvil ----------

function setPanelOpen(open) {
  els.panel.classList.toggle('is-open', open);
  els.backdrop.hidden = !open;
  els.toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open);
  if (open) els.close.focus();
  else els.toggle.focus();
}

els.close.append(icon('x'));
els.toggle.addEventListener('click', () => setPanelOpen(true));
els.close.addEventListener('click', () => setPanelOpen(false));
els.apply.addEventListener('click', () => setPanelOpen(false));
els.backdrop.addEventListener('click', () => setPanelOpen(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && els.panel.classList.contains('is-open')) setPanelOpen(false);
});
els.clear.addEventListener('click', clearFilters);
els.form.addEventListener('submit', (e) => e.preventDefault());

mount(els.sort, SORT_OPTIONS.map((o) => h('option', { value: o.id, text: o.label })));
els.sort.addEventListener('change', () => setCriteria({ orden: els.sort.value }));

update({ rebuildFilters: true });
onDataChanged(['products'], () => update({ rebuildFilters: true }));
