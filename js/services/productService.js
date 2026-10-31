/**
 * Servicio de productos (catálogo y CRUD administrativo).
 * Integración futura: GET/POST /products, GET/PUT/DELETE /products/:id.
 */
import { productsRepository } from '../data/localRepository.js';
import { CATEGORIES } from '../data/categories.js';
import { filterProducts, getFilterFacets } from '../domain/catalogFilters.js';
import { hasDiscount } from '../domain/pricing.js';
import { normalizeProductInput, validateProduct } from '../domain/productValidation.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';

const isVisible = (p) => p.published;

export async function getCategories() {
  return CATEGORIES;
}

/** Productos del catálogo. Por defecto solo los publicados. */
export async function getProducts({ includeUnpublished = false } = {}) {
  const products = productsRepository.list();
  return includeUnpublished ? products : products.filter(isVisible);
}

/** @returns {Promise<object|null>} */
export async function getProductById(id, { includeUnpublished = false } = {}) {
  const product = productsRepository.get(id);
  if (!product || (!includeUnpublished && !product.published)) return null;
  return product;
}

/**
 * Búsqueda con filtros combinados.
 * Las facetas (tallas, colores) se calculan sobre la categoría elegida para
 * ofrecer únicamente opciones con resultados posibles.
 */
export async function queryProducts(criteria) {
  const published = await getProducts();
  const scope = criteria.categoria ? published.filter((p) => p.category === criteria.categoria) : published;
  const items = filterProducts(published, criteria);
  return { items, total: items.length, facets: getFilterFacets(scope) };
}

export async function getFeaturedProducts(limit = 8) {
  const products = await getProducts();
  return products.filter((p) => p.featured).sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, limit);
}

export async function getNewProducts(limit = 8) {
  const products = await getProducts();
  return products
    .filter((p) => p.isNew)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export async function getSaleProducts(limit = 8) {
  const products = await getProducts();
  return products
    .filter((p) => hasDiscount(p) && p.stock > 0)
    .sort((a, b) => (b.compareAtPrice - b.price) / b.compareAtPrice - (a.compareAtPrice - a.price) / a.compareAtPrice)
    .slice(0, limit);
}

/** Productos relacionados: misma categoría, priorizando la misma subcategoría. */
export async function getRelatedProducts(product, limit = 4) {
  const products = await getProducts();
  return products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .sort(
      (a, b) =>
        Number(b.subcategory === product.subcategory) - Number(a.subcategory === product.subcategory) ||
        Number(b.stock > 0) - Number(a.stock > 0),
    )
    .slice(0, limit);
}

function otherSkus(excludeId) {
  return productsRepository
    .list()
    .filter((p) => p.id !== excludeId)
    .map((p) => p.sku);
}

function assertValid(product, excludeId) {
  const errors = validateProduct(product, { existingSkus: otherSkus(excludeId) });
  if (Object.keys(errors).length) {
    throw new ValidationError('Revisa los campos marcados antes de guardar.', errors);
  }
}

export async function createProduct(input) {
  const data = normalizeProductInput(input);
  assertValid(data, null);
  const now = new Date().toISOString();
  const product = { id: generateId('prd'), ...data, createdAt: now, updatedAt: now };
  return productsRepository.insert(product);
}

export async function updateProduct(id, input) {
  const existing = productsRepository.get(id);
  if (!existing) throw new NotFoundError('El producto no existe o fue eliminado.');
  const data = normalizeProductInput(input);
  assertValid(data, id);
  return productsRepository.update(id, { ...data, updatedAt: new Date().toISOString() });
}

/** Publica u oculta un producto en la tienda sin eliminarlo. */
export async function setProductPublished(id, published) {
  const updated = productsRepository.update(id, { published: Boolean(published), updatedAt: new Date().toISOString() });
  if (!updated) throw new NotFoundError('El producto no existe o fue eliminado.');
  return updated;
}

/**
 * Elimina un producto del catálogo. Los pedidos conservan una copia de los datos
 * del producto (nombre, SKU, precio, imagen), así que su historial no se pierde.
 */
export async function deleteProduct(id) {
  const removed = productsRepository.remove(id);
  if (!removed) throw new NotFoundError('El producto no existe o ya fue eliminado.');
  return true;
}
