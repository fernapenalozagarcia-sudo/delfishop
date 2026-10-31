import { CONFIG } from '../config.js';
import { roundMoney } from '../utils/format.js';

/** Porcentaje de descuento entero, o 0 si no hay precio anterior válido. */
export function getDiscountPercent(product) {
  const { price, compareAtPrice } = product;
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function hasDiscount(product) {
  return getDiscountPercent(product) > 0;
}

export function getDeliveryMethod(methodId) {
  return CONFIG.checkout.deliveryMethods.find((m) => m.id === methodId) ?? null;
}

/** Costo de entrega para un subtotal dado; aplica envío gratuito si está configurado. */
export function getDeliveryCost(method, subtotal) {
  if (!method) return null;
  if (method.freeFrom && subtotal >= method.freeFrom) return 0;
  return method.cost;
}

/**
 * Cálculo único de totales, usado por carrito, checkout y pedidos.
 * @param {{unitPrice:number, compareAtPrice?:number|null, quantity:number}[]} lines
 * @param {string|null} deliveryMethodId si es null, no se calcula costo de entrega.
 */
export function calculateTotals(lines, deliveryMethodId = null) {
  let subtotal = 0;
  let savings = 0;
  let itemCount = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    subtotal += line.unitPrice * qty;
    if (line.compareAtPrice && line.compareAtPrice > line.unitPrice) {
      savings += (line.compareAtPrice - line.unitPrice) * qty;
    }
    itemCount += qty;
  }

  subtotal = roundMoney(subtotal);
  const method = getDeliveryMethod(deliveryMethodId);
  const shipping = getDeliveryCost(method, subtotal);

  return {
    itemCount,
    subtotal,
    savings: roundMoney(savings),
    shipping,
    total: roundMoney(subtotal + (shipping ?? 0)),
  };
}

export function lineTotal(unitPrice, quantity) {
  return roundMoney(unitPrice * quantity);
}
