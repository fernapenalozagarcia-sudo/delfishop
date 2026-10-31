const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map((v) => ALPHABET[v % ALPHABET.length]).join('');
}

/** Identificador interno genérico, por ejemplo "prd-k3z9x2mq". */
export function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${randomString(4).toLowerCase()}`;
}

/** Número de pedido legible: PED-261021-7KQ2 */
export function generateOrderNumber(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `PED-${yy}${mm}${dd}-${randomString(4)}`;
}

export function generateSaleId(orderId) {
  return `VTA-${orderId.replace(/^PED-/, '')}`;
}
