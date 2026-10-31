import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoneyShort } from '../utils/format.js';
import { routeUrl, getQueryParams } from '../router.js';
import { CONFIG } from '../config.js';
import { CATEGORIES } from '../data/categories.js';
import { getCartCount } from '../services/cartService.js';
import { onDataChanged } from '../utils/events.js';

function brandMark() {
  return h(
    'a',
    { class: 'brand', href: routeUrl('home'), 'aria-label': `${CONFIG.store.name}, ir al inicio` },
    h('span', { class: 'brand__mark', 'aria-hidden': 'true', text: 'O' }),
    h('span', { class: 'brand__text' }, h('span', { class: 'brand__name', text: CONFIG.store.name }), h('span', { class: 'brand__tagline', text: CONFIG.store.tagline })),
  );
}

function navItems() {
  return [
    { id: 'catalogo', label: 'Todo', href: routeUrl('catalog') },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.name, href: routeUrl('catalog', { categoria: c.id }) })),
    { id: 'novedades', label: 'Novedades', href: routeUrl('catalog', { novedades: 1, orden: 'novedades' }) },
    { id: 'ofertas', label: 'Ofertas', href: routeUrl('catalog', { ofertas: 1, orden: 'descuento' }), highlight: true },
  ];
}

/** Determina qué enlace del menú corresponde a la página actual. */
function resolveActive(active) {
  if (active !== 'catalogo') return active;
  const params = getQueryParams();
  if (params.get('categoria')) return params.get('categoria');
  if (params.get('ofertas') === '1') return 'ofertas';
  if (params.get('novedades') === '1') return 'novedades';
  return 'catalogo';
}

function cartLabel(count) {
  return count === 0 ? 'Carrito vacío' : `Carrito: ${count} ${count === 1 ? 'artículo' : 'artículos'}`;
}

/**
 * Monta el header de la tienda.
 * @param {HTMLElement} container
 * @param {{active?: string}} options identificador de la sección activa.
 */
export function renderHeader(container, { active = '' } = {}) {
  const current = resolveActive(active);
  const initialQuery = active === 'catalogo' ? getQueryParams().get('q') ?? '' : '';

  const badge = h('span', { class: 'cart-link__count', 'aria-hidden': 'true' });
  const cartLink = h('a', { class: 'icon-button cart-link', href: routeUrl('cart') }, icon('bag', { size: 22 }), badge);

  const updateCart = () => {
    const count = getCartCount();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    cartLink.setAttribute('aria-label', cartLabel(count));
    if (active === 'carrito') cartLink.setAttribute('aria-current', 'page');
  };

  const navList = h(
    'ul',
    { class: 'site-nav__list' },
    navItems().map((item) =>
      h(
        'li',
        {},
        h('a', {
          class: ['site-nav__link', item.highlight && 'site-nav__link--highlight'],
          href: item.href,
          text: item.label,
          'aria-current': item.id === current ? 'page' : null,
        }),
      ),
    ),
  );

  const nav = h('nav', { class: 'site-nav', id: 'site-nav', 'aria-label': 'Categorías' }, h('div', { class: 'container' }, navList));

  const menuToggle = h(
    'button',
    { type: 'button', class: 'icon-button menu-toggle', 'aria-expanded': 'false', 'aria-controls': 'site-nav', 'aria-label': 'Abrir menú' },
    icon('menu', { size: 22 }),
  );
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    mount(menuToggle, icon(open ? 'x' : 'menu', { size: 22 }));
    nav.classList.toggle('is-open', open);
  });

  const searchInput = h('input', {
    type: 'search',
    name: 'q',
    id: 'header-search',
    class: 'search-field__input',
    placeholder: 'Buscar camisetas, vestidos, jeans…',
    autocomplete: 'off',
    maxlength: '80',
    value: initialQuery,
  });
  const searchForm = h(
    'form',
    { class: 'search-field header-search', role: 'search', action: routeUrl('catalog'), method: 'get' },
    h('label', { for: 'header-search', class: 'sr-only', text: 'Buscar productos' }),
    searchInput,
    h('button', { type: 'submit', class: 'search-field__button', 'aria-label': 'Buscar' }, icon('search', { size: 18 })),
  );
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = searchInput.value.trim();
    window.location.assign(routeUrl('catalog', { q }));
  });

  const freeFrom = CONFIG.checkout.deliveryMethods.find((m) => m.freeFrom)?.freeFrom;

  mount(
    container,
    h('a', { class: 'skip-link', href: '#main', text: 'Saltar al contenido principal' }),
    h(
      'div',
      { class: 'topbar' },
      h(
        'div',
        { class: 'container topbar__inner' },
        h('p', { class: 'topbar__message' }, icon('truck', { size: 16 }), freeFrom ? `Envío gratis desde ${formatMoneyShort(freeFrom)} · Recoge en tienda sin costo` : 'Recoge en tienda sin costo'),
        h(
          'a',
          { class: 'topbar__admin', href: routeUrl('adminDashboard') },
          icon('shield', { size: 16 }),
          h('span', { text: 'Panel administrativo' }),
        ),
      ),
    ),
    h(
      'header',
      { class: 'site-header' },
      h('div', { class: 'container site-header__inner' }, menuToggle, brandMark(), searchForm, h('div', { class: 'site-header__actions' }, cartLink)),
      nav,
    ),
  );

  updateCart();
  onDataChanged(['cart', 'products'], updateCart);
}
