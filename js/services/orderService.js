/**
 * Servicio de pedidos.
 * Un pedido NO es una venta: se registra como "pendiente" y solo se contabiliza
 * como venta al llegar a "completado".
 * Integración futura: POST /orders, GET /orders, GET /orders/:id,
 * PATCH /orders/:id/status (el backend debe aplicar las mismas reglas).
 */
import { ordersRepository } from '../data/localRepository.js';
import { calculateTotals, getDeliveryMethod, lineTotal } from '../domain/pricing.js';
import { canTransition, getStatusLabel, ORDER_STATUS, ORDER_STATUS_ORDER } from '../domain/orderStatus.js';
import { normalizeCustomerInput, validateCheckout } from '../domain/checkoutValidation.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import { generateOrderNumber } from '../utils/id.js';
import { normalizeText } from '../utils/format.js';
import { getProductById } from './productService.js';
import { releaseStock, reserveStock } from './inventoryService.js';
import { registerSale } from './salesService.js';

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

/**
 * @param {{status?: string, q?: string}} filters
 */
export async function getOrders({ status = '', q = '' } = {}) {
  const term = normalizeText(q);
  return ordersRepository
    .list()
    .filter((o) => !status || o.status === status)
    .filter(
      (o) =>
        !term ||
        normalizeText(`${o.id} ${o.customer.name} ${o.customer.phone} ${o.items.map((i) => i.name).join(' ')}`).includes(term),
    )
    .sort(byNewest);
}

export async function getOrderById(id) {
  return ordersRepository.get(id);
}

/** Número de pedidos por estado. */
export async function getOrderStats() {
  const counts = Object.fromEntries(ORDER_STATUS_ORDER.map((s) => [s, 0]));
  for (const order of ordersRepository.list()) counts[order.status] = (counts[order.status] ?? 0) + 1;
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

function uniqueOrderNumber() {
  const existing = new Set(ordersRepository.list().map((o) => o.id));
  let id;
  do id = generateOrderNumber();
  while (existing.has(id));
  return id;
}

/**
 * Registra un pedido a partir de las líneas del carrito y los datos del cliente.
 * Los precios se toman del catálogo (nunca de la interfaz) y las existencias se
 * apartan en la misma operación.
 *
 * @param {{items: {productId:string,size:string,color:string,quantity:number}[],
 *          form: object, idempotencyKey: string}} payload
 */
export async function createOrder({ items, form, idempotencyKey }) {
  if (idempotencyKey) {
    const duplicate = ordersRepository.list().find((o) => o.idempotencyKey === idempotencyKey);
    if (duplicate) return duplicate;
  }

  const input = normalizeCustomerInput(form);
  const errors = validateCheckout(input);
  if (Object.keys(errors).length) throw new ValidationError('Revisa los datos marcados.', errors);

  if (!Array.isArray(items) || !items.length) throw new AppError('Tu carrito está vacío.');

  const orderItems = [];
  for (const item of items) {
    const product = await getProductById(item.productId);
    if (!product) throw new AppError('Un producto de tu carrito ya no está disponible. Revisa tu carrito.');
    if (!product.sizes.includes(item.size) || !product.colors.some((c) => c.name === item.color)) {
      throw new AppError(`La talla o el color de "${product.name}" ya no está disponible.`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new AppError('Hay una cantidad no válida en el carrito.');
    orderItems.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      image: product.images[0] ?? '',
      size: item.size,
      color: item.color,
      unitPrice: product.price,
      compareAtPrice: product.compareAtPrice,
      quantity: item.quantity,
      lineTotal: lineTotal(product.price, item.quantity),
    });
  }

  const method = getDeliveryMethod(input.deliveryMethodId);
  const totals = calculateTotals(orderItems, method.id);
  const now = new Date().toISOString();

  const order = {
    id: uniqueOrderNumber(),
    idempotencyKey: idempotencyKey || null,
    createdAt: now,
    updatedAt: now,
    status: ORDER_STATUS.PENDING,
    customer: input.customer,
    delivery: {
      methodId: method.id,
      label: method.label,
      cost: totals.shipping,
      address: method.requiresAddress ? input.address : null,
    },
    notes: input.notes,
    items: orderItems,
    totals,
    stockReleased: false,
    statusHistory: [{ status: ORDER_STATUS.PENDING, at: now, note: 'Pedido generado desde la tienda en línea.' }],
  };

  const rollbackStock = await reserveStock(orderItems);
  try {
    ordersRepository.insert(order);
  } catch (error) {
    rollbackStock();
    throw error;
  }
  return order;
}

/**
 * Cambia el estado de un pedido validando la transición.
 * - cancelado: devuelve las existencias (una sola vez).
 * - completado: registra la venta (una sola vez).
 */
export async function updateOrderStatus(id, nextStatus, { note = '' } = {}) {
  const order = ordersRepository.get(id);
  if (!order) throw new NotFoundError('El pedido no existe.');
  if (order.status === nextStatus) return order;
  if (!canTransition(order, nextStatus)) {
    throw new AppError(
      `No es posible pasar un pedido de "${getStatusLabel(order.status)}" a "${getStatusLabel(nextStatus)}".`,
      { code: 'INVALID_TRANSITION' },
    );
  }

  const now = new Date().toISOString();
  const changes = {
    status: nextStatus,
    updatedAt: now,
    statusHistory: [...order.statusHistory, { status: nextStatus, at: now, note: String(note).trim().slice(0, 300) }],
  };

  if (nextStatus === ORDER_STATUS.CANCELLED && !order.stockReleased) {
    await releaseStock(order.items);
    changes.stockReleased = true;
  }

  const updated = ordersRepository.update(id, changes);
  if (nextStatus === ORDER_STATUS.COMPLETED) await registerSale(updated);
  return updated;
}
