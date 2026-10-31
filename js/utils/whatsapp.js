import { CONFIG } from '../config.js';
import { formatMoney } from './format.js';

/** Enlace wa.me con un mensaje prellenado. */
export function buildWhatsAppUrl(message) {
  const number = CONFIG.whatsapp.number.replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Mensaje de compra de un producto. Solo incluye talla, color y cantidad
 * cuando el cliente los eligió.
 */
export function buildProductMessage({ product, size, color, quantity, productUrl }) {
  const lines = [
    `¡Hola, ${CONFIG.store.name}! Me interesa comprar este producto:`,
    '',
    `• Producto: ${product.name}`,
    `• Código: ${product.sku}`,
    `• Precio: ${formatMoney(product.price)} MXN`,
  ];
  if (size) lines.push(`• Talla: ${size}`);
  if (color) lines.push(`• Color: ${color}`);
  if (quantity) lines.push(`• Cantidad: ${quantity}`);
  if (quantity && quantity > 1) lines.push(`• Total estimado: ${formatMoney(product.price * quantity)} MXN`);
  if (productUrl) lines.push('', productUrl);
  lines.push('', '¿Está disponible?');
  return lines.join('\n');
}

export function buildProductWhatsAppUrl(options) {
  return buildWhatsAppUrl(buildProductMessage(options));
}

/** Mensaje para dar seguimiento a un pedido ya registrado. */
export function buildOrderWhatsAppUrl(order) {
  const lines = [
    `¡Hola, ${CONFIG.store.name}! Acabo de generar el pedido ${order.id}.`,
    '',
    ...order.items.map((i) => `• ${i.quantity} × ${i.name} (${i.size}, ${i.color})`),
    '',
    `Total: ${formatMoney(order.totals.total)} MXN`,
    `Entrega: ${order.delivery.label}`,
    `A nombre de: ${order.customer.name}`,
  ];
  return buildWhatsAppUrl(lines.join('\n'));
}
