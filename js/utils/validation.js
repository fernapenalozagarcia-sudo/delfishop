/** Validadores reutilizables. Devuelven true cuando el valor es válido. */

export const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());

/** Teléfono mexicano de 10 dígitos (se admiten espacios, guiones y prefijo +52). */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits;
}

export const isPhone = (value) => /^\d{10}$/.test(normalizePhone(value));

export const isPostalCode = (value) => /^\d{5}$/.test(String(value).trim());

export function isNonNegativeNumber(value) {
  if (isBlank(value)) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function isPositiveNumber(value) {
  if (isBlank(value)) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function isNonNegativeInteger(value) {
  if (isBlank(value)) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

/** Acepta URLs http(s) e imágenes incrustadas en data URL. */
export function isImageSource(value) {
  const text = String(value ?? '').trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(text)) return true;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value).trim());
