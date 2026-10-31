/**
 * Arranque común de las páginas de la tienda.
 */
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { emitDataChanged } from './utils/events.js';
import { nameFromStorageKey } from './utils/storage.js';

let crossTabSyncEnabled = false;

/**
 * Propaga los cambios hechos en otras pestañas (por ejemplo, el panel
 * administrativo abierto en paralelo) como eventos de datos locales.
 */
export function enableCrossTabSync() {
  if (crossTabSyncEnabled) return;
  crossTabSyncEnabled = true;
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      ['products', 'orders', 'sales', 'cart'].forEach(emitDataChanged);
      return;
    }
    const name = nameFromStorageKey(event.key);
    if (name) emitDataChanged(name);
  });
}

/**
 * @param {{active?: string}} options sección activa del menú
 *   ("inicio", "catalogo", "carrito", "checkout"…).
 */
export function initStorefront({ active = '' } = {}) {
  enableCrossTabSync();
  const header = document.getElementById('app-header');
  const footer = document.getElementById('app-footer');
  if (header) renderHeader(header, { active });
  if (footer) renderFooter(footer);
}
