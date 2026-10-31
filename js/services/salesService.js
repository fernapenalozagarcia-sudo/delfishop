/**
 * Servicio de ventas. Una venta es un pedido que alcanzó el estado "completado".
 * Cada pedido genera como máximo una venta (idempotencia por orderId).
 * Integración futura: GET /sales?desde=&hasta=. El registro lo haría el backend.
 */
import { salesRepository } from '../data/localRepository.js';
import { buildSaleRecord } from '../domain/sales.js';

function inRange(dateIso, from, to) {
  const date = new Date(dateIso);
  if (from && date < startOfDay(from)) return false;
  if (to && date > endOfDay(to)) return false;
  return true;
}

function startOfDay(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * @param {{from?: string, to?: string}} filters fechas "YYYY-MM-DD" (inclusive).
 */
export async function getSales({ from = '', to = '' } = {}) {
  return salesRepository
    .list()
    .filter((sale) => inRange(sale.completedAt, from, to))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

export async function getSalesSummary(filters = {}) {
  const sales = await getSales(filters);
  const total = sales.reduce((sum, s) => sum + s.total, 0);
  return {
    count: sales.length,
    total,
    units: sales.reduce((sum, s) => sum + s.itemCount, 0),
    averageTicket: sales.length ? total / sales.length : 0,
  };
}

export async function getSaleByOrderId(orderId) {
  return salesRepository.list().find((s) => s.orderId === orderId) ?? null;
}

/** Registra la venta de un pedido completado. Si ya existe, devuelve la existente. */
export async function registerSale(order) {
  const existing = await getSaleByOrderId(order.id);
  if (existing) return existing;
  return salesRepository.insert(buildSaleRecord(order));
}
