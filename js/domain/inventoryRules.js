export const STOCK_STATUS = Object.freeze({
  AVAILABLE: 'disponible',
  LOW: 'bajo',
  OUT: 'agotado',
});

export const STOCK_STATUS_META = Object.freeze({
  disponible: { label: 'Disponible', tone: 'success' },
  bajo: { label: 'Existencias bajas', tone: 'warning' },
  agotado: { label: 'Agotado', tone: 'danger' },
});

/** Estado del inventario de un producto según sus existencias y su mínimo. */
export function getStockStatus(product) {
  if (product.stock <= 0) return STOCK_STATUS.OUT;
  if (product.stock <= product.minStock) return STOCK_STATUS.LOW;
  return STOCK_STATUS.AVAILABLE;
}

/** Texto de disponibilidad para la tienda. */
export function getAvailabilityLabel(product) {
  const status = getStockStatus(product);
  if (status === STOCK_STATUS.OUT) return 'Agotado';
  if (status === STOCK_STATUS.LOW) return `Últimas ${product.stock} ${product.stock === 1 ? 'pieza' : 'piezas'}`;
  return 'Disponible';
}

export function needsRestock(product) {
  return getStockStatus(product) !== STOCK_STATUS.AVAILABLE;
}
