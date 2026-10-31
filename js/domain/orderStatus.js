/**
 * Flujo comercial de los pedidos.
 *
 *   pendiente → confirmado → en_preparacion → (enviado →) completado
 *        ↘           ↘             ↘
 *                     cancelado
 *
 * - "enviado" solo aplica a pedidos con envío a domicilio.
 * - Los pedidos para recoger en tienda pasan de "en_preparacion" a "completado".
 * - "completado" y "cancelado" son estados finales.
 * - Solo los pedidos "completado" cuentan como venta.
 */
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pendiente',
  CONFIRMED: 'confirmado',
  PREPARING: 'en_preparacion',
  SHIPPED: 'enviado',
  COMPLETED: 'completado',
  CANCELLED: 'cancelado',
});

export const ORDER_STATUS_META = Object.freeze({
  pendiente: { label: 'Pendiente', tone: 'warning', action: null },
  confirmado: { label: 'Confirmado', tone: 'info', action: 'Confirmar pedido' },
  en_preparacion: { label: 'En preparación', tone: 'info', action: 'Pasar a preparación' },
  enviado: { label: 'Enviado', tone: 'accent', action: 'Marcar como enviado' },
  completado: { label: 'Completado', tone: 'success', action: 'Marcar como completado' },
  cancelado: { label: 'Cancelado', tone: 'danger', action: 'Cancelar pedido' },
});

export const ORDER_STATUS_ORDER = Object.freeze([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]);

const TRANSITIONS = Object.freeze({
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['enviado', 'completado', 'cancelado'],
  enviado: ['completado'],
  completado: [],
  cancelado: [],
});

export function requiresShipping(order) {
  return order?.delivery?.methodId === 'envio';
}

/** Estados a los que puede pasar un pedido desde su estado actual. */
export function getAllowedTransitions(order) {
  const candidates = TRANSITIONS[order.status] ?? [];
  return candidates.filter((next) => {
    if (next === ORDER_STATUS.SHIPPED) return requiresShipping(order);
    if (order.status === ORDER_STATUS.PREPARING && next === ORDER_STATUS.COMPLETED) return !requiresShipping(order);
    return true;
  });
}

export function canTransition(order, nextStatus) {
  return getAllowedTransitions(order).includes(nextStatus);
}

export function isFinalStatus(status) {
  return status === ORDER_STATUS.COMPLETED || status === ORDER_STATUS.CANCELLED;
}

/** Pasos del flujo aplicables a un pedido (para la línea de tiempo). */
export function getStatusFlow(order) {
  const flow = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING];
  if (requiresShipping(order)) flow.push(ORDER_STATUS.SHIPPED);
  flow.push(ORDER_STATUS.COMPLETED);
  return flow;
}

export function getStatusLabel(status) {
  return ORDER_STATUS_META[status]?.label ?? status;
}
