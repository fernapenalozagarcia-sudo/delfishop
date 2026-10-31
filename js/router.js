/**
 * Utilidades de navegación entre páginas.
 * Las rutas se resuelven a partir de la raíz del proyecto, por lo que
 * funcionan igual desde index.html, pages/ o pages/admin/.
 */
const ROOT = new URL('../', import.meta.url);

export const ROUTES = Object.freeze({
  home: 'index.html',
  catalog: 'pages/catalogo.html',
  product: 'pages/producto.html',
  cart: 'pages/carrito.html',
  checkout: 'pages/checkout.html',
  confirmation: 'pages/confirmacion-pedido.html',
  adminDashboard: 'pages/admin/dashboard.html',
  adminInventory: 'pages/admin/inventario.html',
  adminProducts: 'pages/admin/productos.html',
  adminProductForm: 'pages/admin/formulario-producto.html',
  adminOrders: 'pages/admin/pedidos.html',
  adminSales: 'pages/admin/ventas.html',
});

/** Construye una URL absoluta a una ruta conocida con parámetros opcionales. */
export function routeUrl(routeName, params = {}) {
  const path = ROUTES[routeName];
  if (!path) throw new Error(`Ruta desconocida: ${routeName}`);
  return buildUrl(path, params);
}

/** Construye una URL a partir de una ruta relativa a la raíz del proyecto. */
export function buildUrl(path, params = {}) {
  const url = new URL(path, ROOT);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

export function assetUrl(path) {
  return new URL(`assets/${path}`, ROOT).href;
}

export function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function navigateTo(routeName, params) {
  window.location.assign(routeUrl(routeName, params));
}

/** Actualiza los parámetros de la URL actual sin recargar la página. */
export function replaceQueryParams(params) {
  const url = new URL(window.location.href);
  url.search = '';
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    url.searchParams.set(key, String(value));
  }
  window.history.replaceState(null, '', url.href);
}

/** Indica si la página actual corresponde a la ruta indicada. */
export function isCurrentRoute(routeName) {
  const target = new URL(ROUTES[routeName], ROOT).pathname;
  const current = window.location.pathname;
  return current === target || (routeName === 'home' && current === new URL('./', ROOT).pathname);
}
