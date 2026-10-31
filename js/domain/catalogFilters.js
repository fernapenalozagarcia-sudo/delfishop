import { normalizeText } from '../utils/format.js';
import { getCategoryName, getSubcategoryName } from '../data/categories.js';
import { hasDiscount } from './pricing.js';

export const SORT_OPTIONS = Object.freeze([
  { id: 'relevancia', label: 'Relevancia' },
  { id: 'novedades', label: 'Novedades primero' },
  { id: 'precio-asc', label: 'Precio: menor a mayor' },
  { id: 'precio-desc', label: 'Precio: mayor a menor' },
  { id: 'descuento', label: 'Mayor descuento' },
]);

export const PRICE_RANGES = Object.freeze([
  { id: '0-499', label: 'Hasta $499', min: 0, max: 499 },
  { id: '500-999', label: '$500 a $999', min: 500, max: 999 },
  { id: '1000-1999', label: '$1,000 a $1,999', min: 1000, max: 1999 },
  { id: '2000-', label: '$2,000 o más', min: 2000, max: null },
]);

/** Criterios vacíos: todos los filtros desactivados. */
export const EMPTY_CRITERIA = Object.freeze({
  q: '',
  categoria: '',
  subcategoria: '',
  min: '',
  max: '',
  tallas: [],
  colores: [],
  disponibles: false,
  destacados: false,
  novedades: false,
  ofertas: false,
  orden: 'relevancia',
});

function searchableText(product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.sku,
      getCategoryName(product.category),
      getSubcategoryName(product.subcategory),
      product.colors.map((c) => c.name).join(' '),
    ].join(' '),
  );
}

/** Puntuación de relevancia: coincidencias en el nombre pesan más. */
function relevance(product, terms) {
  const name = normalizeText(product.name);
  return terms.reduce((score, term) => score + (name.includes(term) ? 3 : 1), 0) + (product.featured ? 0.5 : 0);
}

/**
 * Aplica todos los criterios combinados y el orden elegido.
 * Es una función pura; un backend futuro puede recibir los mismos criterios como query params.
 */
export function filterProducts(products, criteria) {
  const c = { ...EMPTY_CRITERIA, ...criteria };
  const terms = normalizeText(c.q).split(/\s+/).filter(Boolean);
  const min = c.min === '' ? null : Number(c.min);
  const max = c.max === '' ? null : Number(c.max);

  const result = products.filter((p) => {
    if (c.categoria && p.category !== c.categoria) return false;
    if (c.subcategoria && p.subcategory !== c.subcategoria) return false;
    if (min !== null && p.price < min) return false;
    if (max !== null && p.price > max) return false;
    if (c.tallas.length && !p.sizes.some((s) => c.tallas.includes(s))) return false;
    if (c.colores.length && !p.colors.some((col) => c.colores.includes(col.name))) return false;
    if (c.disponibles && p.stock <= 0) return false;
    if (c.destacados && !p.featured) return false;
    if (c.novedades && !p.isNew) return false;
    if (c.ofertas && !hasDiscount(p)) return false;
    if (terms.length) {
      const text = searchableText(p);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });

  return sortProducts(result, c.orden, terms);
}

export function sortProducts(products, order, terms = []) {
  const list = [...products];
  const byDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  switch (order) {
    case 'precio-asc':
      return list.sort((a, b) => a.price - b.price);
    case 'precio-desc':
      return list.sort((a, b) => b.price - a.price);
    case 'novedades':
      return list.sort((a, b) => Number(b.isNew) - Number(a.isNew) || byDate(a, b));
    case 'descuento':
      return list.sort((a, b) => discountRatio(b) - discountRatio(a));
    default:
      if (terms.length) return list.sort((a, b) => relevance(b, terms) - relevance(a, terms));
      // Disponibles primero, luego destacados.
      return list.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || Number(b.featured) - Number(a.featured));
  }
}

function discountRatio(p) {
  return p.compareAtPrice > p.price ? (p.compareAtPrice - p.price) / p.compareAtPrice : 0;
}

/** Valores disponibles para construir los filtros a partir de los productos. */
export function getFilterFacets(products) {
  const sizes = new Set();
  const colors = new Map();
  let maxPrice = 0;
  for (const p of products) {
    p.sizes.forEach((s) => sizes.add(s));
    p.colors.forEach((c) => colors.set(c.name, c.hex));
    maxPrice = Math.max(maxPrice, p.price);
  }
  return {
    sizes: sortSizes([...sizes]),
    colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    maxPrice,
  };
}

const SIZE_ORDER = ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M', '2', '4', '6', '8', '10', '12', '14', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unitalla'];

export function sortSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'es');
  });
}

/** Lee los criterios desde los parámetros de la URL. */
export function criteriaFromParams(params) {
  const list = (key) => (params.get(key) ? params.get(key).split(',').filter(Boolean) : []);
  const flag = (key) => params.get(key) === '1';
  const num = (key) => {
    const value = params.get(key);
    return value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : '';
  };
  const orden = params.get('orden');
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    categoria: params.get('categoria') ?? '',
    subcategoria: params.get('subcategoria') ?? '',
    min: num('min'),
    max: num('max'),
    tallas: list('tallas'),
    colores: list('colores'),
    disponibles: flag('disponibles'),
    destacados: flag('destacados'),
    novedades: flag('novedades'),
    ofertas: flag('ofertas'),
    orden: SORT_OPTIONS.some((o) => o.id === orden) ? orden : 'relevancia',
  };
}

/** Convierte los criterios a parámetros de URL compactos. */
export function criteriaToParams(c) {
  return {
    q: c.q,
    categoria: c.categoria,
    subcategoria: c.subcategoria,
    min: c.min,
    max: c.max,
    tallas: c.tallas.join(','),
    colores: c.colores.join(','),
    disponibles: c.disponibles ? '1' : '',
    destacados: c.destacados ? '1' : '',
    novedades: c.novedades ? '1' : '',
    ofertas: c.ofertas ? '1' : '',
    orden: c.orden === 'relevancia' ? '' : c.orden,
  };
}

export function countActiveFilters(c) {
  return (
    (c.q ? 1 : 0) +
    (c.categoria ? 1 : 0) +
    (c.subcategoria ? 1 : 0) +
    (c.min !== '' ? 1 : 0) +
    (c.max !== '' ? 1 : 0) +
    c.tallas.length +
    c.colores.length +
    [c.disponibles, c.destacados, c.novedades, c.ofertas].filter(Boolean).length
  );
}
