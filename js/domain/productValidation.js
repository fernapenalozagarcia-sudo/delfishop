import { CATEGORIES } from '../data/categories.js';
import {
  isBlank,
  isHexColor,
  isImageSource,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isPositiveNumber,
} from '../utils/validation.js';
import { roundMoney } from '../utils/format.js';

export const MAX_IMAGES = 4;

/** Normaliza los datos de un producto antes de validarlos o guardarlos. */
export function normalizeProductInput(input) {
  const unique = (list) => [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
  const colors = [];
  for (const color of input.colors ?? []) {
    const name = String(color.name ?? '').trim();
    if (name && !colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      colors.push({ name, hex: String(color.hex ?? '#000000').trim().toLowerCase() });
    }
  }
  return {
    name: String(input.name ?? '').trim().replace(/\s+/g, ' '),
    description: String(input.description ?? '').trim(),
    price: isBlank(input.price) ? NaN : roundMoney(Number(input.price)),
    compareAtPrice: isBlank(input.compareAtPrice) ? null : roundMoney(Number(input.compareAtPrice)),
    category: String(input.category ?? ''),
    subcategory: String(input.subcategory ?? ''),
    images: unique(input.images ?? []).slice(0, MAX_IMAGES),
    sku: String(input.sku ?? '').trim().toUpperCase(),
    sizes: unique(input.sizes ?? []),
    colors,
    stock: isBlank(input.stock) ? NaN : Number(input.stock),
    minStock: isBlank(input.minStock) ? NaN : Number(input.minStock),
    published: Boolean(input.published),
    featured: Boolean(input.featured),
    isNew: Boolean(input.isNew),
  };
}

/**
 * Valida un producto normalizado.
 * @param {object} product
 * @param {{existingSkus?: string[]}} context SKUs usados por otros productos.
 * @returns {Record<string,string>} errores por campo (vacío si es válido).
 */
export function validateProduct(product, { existingSkus = [] } = {}) {
  const errors = {};

  if (product.name.length < 3) errors.name = 'Escribe un nombre de al menos 3 caracteres.';
  else if (product.name.length > 80) errors.name = 'El nombre no debe superar 80 caracteres.';

  if (product.description.length < 20) errors.description = 'La descripción debe tener al menos 20 caracteres.';
  else if (product.description.length > 1200) errors.description = 'La descripción no debe superar 1,200 caracteres.';

  if (!isPositiveNumber(product.price)) errors.price = 'Indica un precio mayor que cero.';
  else if (product.price > 100000) errors.price = 'El precio parece demasiado alto.';

  if (product.compareAtPrice !== null) {
    if (!isNonNegativeNumber(product.compareAtPrice)) errors.compareAtPrice = 'Indica un precio anterior válido.';
    else if (!(product.compareAtPrice > product.price)) errors.compareAtPrice = 'El precio anterior debe ser mayor que el precio actual.';
  }

  const category = CATEGORIES.find((c) => c.id === product.category);
  if (!category) errors.category = 'Selecciona una categoría.';
  if (!product.subcategory) errors.subcategory = 'Selecciona una subcategoría.';
  else if (category && !category.subcategories.includes(product.subcategory)) {
    errors.subcategory = 'La subcategoría no corresponde a la categoría elegida.';
  }

  if (!product.images.length) errors.images = 'Agrega al menos una imagen.';
  else if (!product.images.every(isImageSource)) errors.images = 'Alguna imagen no es una URL válida (http/https).';

  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(product.sku)) {
    errors.sku = 'Usa de 3 a 24 caracteres: letras, números y guiones.';
  } else if (existingSkus.map((s) => s.toUpperCase()).includes(product.sku)) {
    errors.sku = 'Ya existe otro producto con este SKU.';
  }

  if (!product.sizes.length) errors.sizes = 'Indica al menos una talla (usa "Unitalla" si no aplica).';

  if (!product.colors.length) errors.colors = 'Agrega al menos un color.';
  else if (!product.colors.every((c) => isHexColor(c.hex))) errors.colors = 'Algún color tiene un código no válido.';

  if (!isNonNegativeInteger(product.stock)) errors.stock = 'Indica una cantidad entera igual o mayor que cero.';
  else if (product.stock > 99999) errors.stock = 'La cantidad es demasiado alta.';

  if (!isNonNegativeInteger(product.minStock)) errors.minStock = 'Indica un mínimo entero igual o mayor que cero.';

  return errors;
}
