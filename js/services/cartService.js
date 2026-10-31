/**
 * Carrito de compras persistido en localStorage.
 * Solo guarda referencias (producto, talla, color, cantidad); los precios y las
 * existencias se leen siempre del catálogo actual para mantenerlos consistentes.
 * Con backend, el carrito puede seguir siendo local y validarse en POST /orders.
 */
import { CONFIG } from '../config.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { AppError, ValidationError } from '../utils/errors.js';
import { calculateTotals, lineTotal } from '../domain/pricing.js';
import { getProductById } from './productService.js';

const CART_KEY = 'cart';
const MAX_PER_LINE = CONFIG.checkout.maxUnitsPerLine;

const lineKey = (productId, size, color) => `${productId}|${size}|${color}`;

function readCart() {
  const data = readJSON(CART_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item) => item && typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0,
  );
}

function writeCart(items) {
  writeJSON(CART_KEY, items);
}

export function getCartItems() {
  return readCart();
}

/** Número total de unidades (para el indicador del header). */
export function getCartCount() {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

/** Unidades de un producto en el carrito, sumando todas sus variantes. */
export function getQuantityInCart(productId, { excludeKey } = {}) {
  return readCart()
    .filter((item) => item.productId === productId && item.key !== excludeKey)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function validateVariant(product, size, color) {
  const errors = {};
  if (!product.sizes.includes(size)) errors.size = 'Selecciona una talla.';
  if (!product.colors.some((c) => c.name === color)) errors.color = 'Selecciona un color.';
  if (Object.keys(errors).length) throw new ValidationError('Selecciona talla y color antes de continuar.', errors);
}

/** Máximo que puede tener una línea sin superar las existencias ni el límite por línea. */
function maxForLine(product, key) {
  const otherLines = getQuantityInCart(product.id, { excludeKey: key });
  return Math.max(0, Math.min(product.stock - otherLines, MAX_PER_LINE));
}

/**
 * Agrega un producto (o suma unidades a la misma variante).
 * @returns {Promise<{quantity:number}>} cantidad resultante en la línea.
 */
export async function addToCart({ productId, size, color, quantity = 1 }) {
  const product = await getProductById(productId);
  if (!product) throw new AppError('Este producto ya no está disponible.');
  validateVariant(product, size, color);

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new ValidationError('Indica una cantidad válida.', { quantity: 'Indica una cantidad válida.' });
  if (product.stock <= 0) throw new AppError('Este producto está agotado.');

  const key = lineKey(productId, size, color);
  const items = readCart();
  const existing = items.find((item) => item.key === key);
  const current = existing?.quantity ?? 0;
  const max = maxForLine(product, key);

  if (current + qty > max) {
    const available = max - current;
    throw new AppError(
      available > 0
        ? `Solo puedes agregar ${available} ${available === 1 ? 'unidad más' : 'unidades más'} de este producto.`
        : 'Ya tienes en el carrito todas las unidades disponibles de este producto.',
      { code: 'INSUFFICIENT_STOCK' },
    );
  }

  if (existing) existing.quantity = current + qty;
  else items.push({ key, productId, size, color, quantity: qty, addedAt: new Date().toISOString() });
  writeCart(items);
  return { quantity: current + qty };
}

export async function updateCartItemQuantity(key, quantity) {
  const items = readCart();
  const item = items.find((i) => i.key === key);
  if (!item) throw new AppError('El artículo ya no está en el carrito.');
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new AppError('La cantidad mínima es 1.');

  const product = await getProductById(item.productId);
  if (!product) throw new AppError('Este producto ya no está disponible.');
  const max = maxForLine(product, key);
  if (qty > max) throw new AppError(`Solo hay ${max} ${max === 1 ? 'unidad disponible' : 'unidades disponibles'}.`);

  item.quantity = qty;
  writeCart(items);
}

export function removeFromCart(key) {
  writeCart(readCart().filter((item) => item.key !== key));
}

export function clearCart() {
  writeCart([]);
}

/**
 * Carrito con datos actuales del catálogo, problemas detectados y totales.
 * issue: "unavailable" (eliminado, oculto o agotado), "variant" (talla/color ya
 * no existe) o "exceeds" (la cantidad supera las existencias actuales).
 */
export async function getCartDetails() {
  const items = readCart();
  const lines = [];
  const stockUsed = new Map();

  for (const item of items) {
    const product = await getProductById(item.productId);
    let issue = null;
    let issueMessage = '';
    let maxQuantity = 0;

    if (!product || product.stock <= 0) {
      issue = 'unavailable';
      issueMessage = product ? 'Este producto se agotó.' : 'Este producto ya no está disponible.';
    } else {
      const used = stockUsed.get(product.id) ?? 0;
      maxQuantity = Math.max(0, Math.min(product.stock - used, MAX_PER_LINE));
      stockUsed.set(product.id, used + item.quantity);
      if (!product.sizes.includes(item.size) || !product.colors.some((c) => c.name === item.color)) {
        issue = 'variant';
        issueMessage = 'La talla o el color elegido ya no está disponible.';
      } else if (item.quantity > maxQuantity) {
        issue = 'exceeds';
        issueMessage =
          maxQuantity > 0
            ? `Solo quedan ${maxQuantity} ${maxQuantity === 1 ? 'unidad' : 'unidades'}. Ajusta la cantidad.`
            : 'No quedan unidades disponibles de este producto.';
      }
    }

    const unitPrice = product?.price ?? 0;
    lines.push({
      ...item,
      product,
      unitPrice,
      compareAtPrice: product?.compareAtPrice ?? null,
      lineTotal: lineTotal(unitPrice, item.quantity),
      maxQuantity,
      issue,
      issueMessage,
    });
  }

  const billable = lines.filter((l) => l.issue !== 'unavailable');
  return {
    lines,
    totals: calculateTotals(billable),
    hasIssues: lines.some((l) => l.issue),
  };
}
