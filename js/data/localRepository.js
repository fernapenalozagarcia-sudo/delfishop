/**
 * Repositorio local que simula la persistencia de un backend usando localStorage.
 * Los servicios son los únicos que deben importar este módulo; al integrar la
 * API REST se reemplazan sus llamadas por peticiones HTTP (ver services/apiClient.js).
 */
import { clearAppStorage, readJSON, writeJSON } from '../utils/storage.js';
import { emitDataChanged } from '../utils/events.js';
import { createSeedData } from './mockData.js';

const SEEDED_COLLECTIONS = ['products', 'orders', 'sales'];
const SEED_FLAG = 'seeded';

function ensureSeeded() {
  if (readJSON(SEED_FLAG) === true) return;
  const data = createSeedData();
  for (const name of SEEDED_COLLECTIONS) writeJSON(name, data[name], { silent: true });
  writeJSON(SEED_FLAG, true, { silent: true });
}

function load(name) {
  ensureSeeded();
  const data = readJSON(name);
  if (Array.isArray(data)) return data;
  // Colección ausente o dañada: se restaura desde los datos de demostración.
  const restored = createSeedData()[name] ?? [];
  writeJSON(name, restored, { silent: true });
  return restored;
}

function createCollection(name) {
  return {
    /** Devuelve una copia nueva de todos los registros. */
    list() {
      return load(name);
    },
    get(id) {
      return load(name).find((item) => item.id === id) ?? null;
    },
    saveAll(items) {
      writeJSON(name, items);
    },
    insert(item) {
      const items = load(name);
      if (items.some((existing) => existing.id === item.id)) {
        throw new Error(`Ya existe un registro con id ${item.id} en ${name}.`);
      }
      items.push(item);
      writeJSON(name, items);
      return item;
    },
    update(id, changes) {
      const items = load(name);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...changes, id };
      writeJSON(name, items);
      return items[index];
    },
    remove(id) {
      const items = load(name);
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) return false;
      writeJSON(name, next);
      return true;
    },
  };
}

export const productsRepository = createCollection('products');
export const ordersRepository = createCollection('orders');
export const salesRepository = createCollection('sales');

/** Borra los cambios locales y vuelve a cargar los datos de demostración. */
export function resetDemoData() {
  clearAppStorage();
  ensureSeeded();
  ['products', 'orders', 'sales', 'cart'].forEach(emitDataChanged);
}
