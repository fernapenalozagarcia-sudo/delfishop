import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { routeUrl } from '../router.js';
import { CONFIG } from '../config.js';
import { onDataChanged } from '../utils/events.js';
import { enableCrossTabSync } from '../app.js';
import { getOrderStats } from '../services/orderService.js';
import { getInventorySummary } from '../services/inventoryService.js';
import { resetDemoData } from '../data/localRepository.js';
import { confirmDialog } from './dialog.js';
import { showToast } from './toast.js';

const FLASH_KEY = 'olmo:admin-flash';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: 'adminDashboard' },
  { id: 'inventario', label: 'Inventario', icon: 'package', route: 'adminInventory', badge: 'inventory' },
  { id: 'productos', label: 'Productos', icon: 'shirt', route: 'adminProducts' },
  { id: 'pedidos', label: 'Pedidos', icon: 'clipboard', route: 'adminOrders', badge: 'orders' },
  { id: 'ventas', label: 'Ventas', icon: 'trendingUp', route: 'adminSales' },
];

/** Mensaje que se mostrará en la siguiente página del panel (p. ej. tras guardar). */
export function setFlashMessage(message, type = 'success') {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
}

function showFlashMessage() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    const { message, type } = JSON.parse(raw);
    showToast(message, { type });
  } catch {
    /* mensaje dañado: se ignora */
  }
}

async function handleReset() {
  const confirmed = await confirmDialog({
    title: '¿Restablecer los datos de demostración?',
    message: 'Se borrarán los productos, pedidos, ventas y el carrito guardados en este navegador, y se cargarán de nuevo los datos de ejemplo.',
    confirmLabel: 'Restablecer datos',
  });
  if (!confirmed) return;
  resetDemoData();
  setFlashMessage('Los datos de demostración se restablecieron.', 'info');
  window.location.reload();
}

/**
 * Monta el menú lateral y la barra superior del panel administrativo.
 * @param {{active: string}} options
 */
export function initAdmin({ active }) {
  enableCrossTabSync();
  const sidebar = document.getElementById('admin-sidebar');
  const topbar = document.getElementById('admin-topbar');
  const badges = {};

  const navList = h(
    'ul',
    { class: 'admin-nav' },
    NAV.map((item) => {
      const badge = item.badge ? h('span', { class: `admin-nav__badge admin-nav__badge--${item.badge}`, hidden: true }) : null;
      if (badge) badges[item.badge] = badge;
      return h(
        'li',
        {},
        h(
          'a',
          { class: 'admin-nav__link', href: routeUrl(item.route), 'aria-current': item.id === active ? 'page' : null },
          icon(item.icon, { size: 20 }),
          h('span', { text: item.label }),
          badge,
        ),
      );
    }),
  );

  mount(
    sidebar,
    h(
      'div',
      { class: 'admin-sidebar__brand' },
      h('a', { class: 'admin-brand', href: routeUrl('adminDashboard') }, h('span', { class: 'brand__mark', 'aria-hidden': 'true', text: 'O' }), h('span', {}, h('span', { class: 'admin-brand__name', text: CONFIG.store.name }), h('span', { class: 'admin-brand__label', text: 'Administración' }))),
    ),
    h('nav', { 'aria-label': 'Panel administrativo' }, navList),
    h(
      'div',
      { class: 'admin-sidebar__footer' },
      h('a', { class: 'admin-nav__link', href: routeUrl('home') }, icon('store', { size: 20 }), h('span', { text: 'Ver tienda' })),
      h('button', { type: 'button', class: 'admin-nav__link admin-nav__button', onClick: handleReset }, icon('refresh', { size: 20 }), h('span', { text: 'Restablecer demo' })),
    ),
  );

  const toggle = h('button', { type: 'button', class: 'icon-button admin-menu-toggle', 'aria-label': 'Abrir menú', 'aria-expanded': 'false', 'aria-controls': 'admin-sidebar' }, icon('menu', { size: 22 }));
  const setOpen = (open) => {
    document.body.classList.toggle('admin-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    mount(toggle, icon(open ? 'x' : 'menu', { size: 22 }));
  };
  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('admin-nav-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('admin-nav-open')) setOpen(false);
  });
  const scrim = h('div', { class: 'admin-scrim', onClick: () => setOpen(false) });
  document.body.append(scrim);

  mount(
    topbar,
    toggle,
    h(
      'p',
      { class: 'admin-topbar__notice' },
      icon('info', { size: 16 }),
      h('span', { text: 'Modo demostración: sin autenticación. Los datos se guardan solo en este navegador.' }),
    ),
    h('a', { class: 'btn btn--outline btn--sm', href: routeUrl('home') }, icon('external', { size: 16 }), 'Ver tienda'),
  );

  async function updateBadges() {
    const [{ counts }, inventory] = await Promise.all([getOrderStats(), getInventorySummary()]);
    const pending = counts.pendiente ?? 0;
    badges.orders.textContent = String(pending);
    badges.orders.hidden = pending === 0;
    badges.orders.setAttribute('aria-label', `${pending} pedidos pendientes`);
    const alerts = inventory.lowStock + inventory.outOfStock;
    badges.inventory.textContent = String(alerts);
    badges.inventory.hidden = alerts === 0;
    badges.inventory.setAttribute('aria-label', `${alerts} productos requieren reposición`);
  }

  updateBadges();
  onDataChanged(['orders', 'products'], updateBadges);
  showFlashMessage();
}
