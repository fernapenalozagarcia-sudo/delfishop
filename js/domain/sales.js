import { ORDER_STATUS } from './orderStatus.js';
import { generateSaleId } from '../utils/id.js';

/** Fecha en la que el pedido alcanzó el estado "completado". */
export function getCompletionDate(order) {
  const entry = [...(order.statusHistory ?? [])].reverse().find((h) => h.status === ORDER_STATUS.COMPLETED);
  return entry?.at ?? order.updatedAt;
}

/** Registro de venta derivado de un pedido completado. */
export function buildSaleRecord(order) {
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new Error('Solo un pedido completado puede registrarse como venta.');
  }
  return {
    id: generateSaleId(order.id),
    orderId: order.id,
    customerName: order.customer.name,
    deliveryMethodId: order.delivery.methodId,
    itemCount: order.totals.itemCount,
    subtotal: order.totals.subtotal,
    shipping: order.totals.shipping ?? 0,
    total: order.totals.total,
    completedAt: getCompletionDate(order),
  };
}
