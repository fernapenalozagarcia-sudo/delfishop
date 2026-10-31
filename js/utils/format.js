import { CONFIG } from '../config.js';

const moneyFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: 'currency',
  currency: CONFIG.currency,
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(CONFIG.locale, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(CONFIG.locale, { dateStyle: 'medium', timeStyle: 'short' });
const numberFormatter = new Intl.NumberFormat(CONFIG.locale);

const moneyShortFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: 'currency',
  currency: CONFIG.currency,
  maximumFractionDigits: 0,
});

/** Formatea un importe en pesos mexicanos: $1,299.00 */
export function formatMoney(amount) {
  return moneyFormatter.format(Number(amount) || 0);
}

/** Importe sin centavos para textos promocionales: $1,499 */
export function formatMoneyShort(amount) {
  return moneyShortFormatter.format(Number(amount) || 0);
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

export function formatDate(isoDate) {
  return isoDate ? dateFormatter.format(new Date(isoDate)) : '—';
}

export function formatDateTime(isoDate) {
  return isoDate ? dateTimeFormatter.format(new Date(isoDate)) : '—';
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Normaliza texto para búsquedas: minúsculas y sin acentos. */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Redondea a centavos evitando errores de coma flotante. */
export function roundMoney(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

/** Convierte una fecha a "YYYY-MM-DD" según la zona horaria local. */
export function toDateInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
