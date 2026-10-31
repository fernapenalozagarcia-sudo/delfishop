/**
 * Servicio de inventario.
 * Política de existencias de la demo:
 *  - Al generar un pedido se apartan (descuentan) sus unidades.
 *  - Si el pedido se cancela, las unidades se devuelven una sola vez.
 * Integración futura: GET /inventory, PATCH /inventory/:productId.
 */
import { productsRepository } from '../data/localRepository.js';
import { getStockStatus, STOCK_STATUS } from '../domain/inventoryRules.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import { isNonNegativeInteger } from '../utils/validation.js';

/** Productos (publicados o no) con su estado de inventario. */
export async function getInventory() {
  return productsRepository.list().map((p) => ({ ...p, stockStatus: getStockStatus(p) }));
}

export async function getInventorySummary() {
  const inventory = await getInventory();
  return {
    totalProducts: inventory.length,
    publishedProducts: inventory.filter((p) => p.published).length,
    totalUnits: inventory.reduce((sum, p) => sum + p.stock, 0),
    lowStock: inventory.filter((p) => p.stockStatus === STOCK_STATUS.LOW).length,
    outOfStock: inventory.filter((p) => p.stockStatus === STOCK_STATUS.OUT).length,
    inventoryValue: inventory.reduce((sum, p) => sum + p.stock * p.price, 0),
  };
}

export async function getAvailableStock(productId) {
  return productsRepository.get(productId)?.stock ?? 0;
}

/** Fija las existencias y el mínimo de un producto. */
export async function updateStock(productId, { stock, minStock }) {
  const errors = {};
  if (!isNonNegativeInteger(stock) || Number(stock) > 99999) errors.stock = 'Indica una cantidad entera entre 0 y 99,999.';
  if (!isNonNegativeInteger(minStock) || Number(minStock) > 9999) errors.minStock = 'Indica un mínimo entero entre 0 y 9,999.';
  if (Object.keys(errors).length) throw new ValidationError('Revisa los valores de inventario.', errors);

  const updated = productsRepository.update(productId, {
    stock: Number(stock),
    minStock: Number(minStock),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new NotFoundError('El producto no existe o fue eliminado.');
  return updated;
}

function groupQuantities(items) {
  const totals = new Map();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  return totals;
}

/**
 * Descuenta las unidades de un pedido. Valida todas las líneas antes de
 * modificar nada para que la operación sea atómica.
 * @returns {() => void} función que deshace la reserva si un paso posterior falla.
 */
export async function reserveStock(items) {
  const products = productsRepository.list();
  const byId = new Map(products.map((p) => [p.id, p]));
  const problems = [];

  for (const [productId, quantity] of groupQuantities(items)) {
    const product = byId.get(productId);
    if (!product || !product.published) problems.push('Un producto de tu carrito ya no está disponible.');
    else if (product.stock < quantity) {
      problems.push(
        product.stock === 0
          ? `"${product.name}" se agotó.`
          : `Solo quedan ${product.stock} unidades de "${product.name}".`,
      );
    }
  }
  if (problems.length) throw new AppError(problems.join(' '), { code: 'INSUFFICIENT_STOCK', details: problems });

  const snapshot = structuredClone(products);
  const now = new Date().toISOString();
  for (const [productId, quantity] of groupQuantities(items)) {
    const product = byId.get(productId);
    product.stock -= quantity;
    product.updatedAt = now;
  }
  productsRepository.saveAll(products);
  return () => productsRepository.saveAll(snapshot);
}

/** Devuelve al inventario las unidades de un pedido cancelado. */
export async function releaseStock(items) {
  const products = productsRepository.list();
  const now = new Date().toISOString();
  let changed = false;
  for (const [productId, quantity] of groupQuantities(items)) {
    const product = products.find((p) => p.id === productId);
    // Si el producto fue eliminado del catálogo no hay a dónde devolver las unidades.
    if (!product) continue;
    product.stock += quantity;
    product.updatedAt = now;
    changed = true;
  }
  if (changed) productsRepository.saveAll(products);
}
