import { CONFIG } from '../config.js';
import { emitDataChanged } from './events.js';

/**
 * Envoltorio de localStorage con espacio de nombres.
 * Solo es un mecanismo de demostración: no ofrece seguridad,
 * control de acceso ni datos compartidos entre usuarios o dispositivos.
 */
const PREFIX = CONFIG.storage.prefix;

export function storageKey(name) {
  return `${PREFIX}${name}`;
}

export function readJSON(name, fallback = null) {
  try {
    const raw = window.localStorage.getItem(storageKey(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`No se pudo leer "${name}" del almacenamiento local.`, error);
    return fallback;
  }
}

export function writeJSON(name, value, { silent = false } = {}) {
  try {
    window.localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch (error) {
    const quota = error?.name === 'QuotaExceededError';
    throw new Error(
      quota
        ? 'El almacenamiento del navegador está lleno. Usa imágenes por URL o restablece los datos de demostración.'
        : 'No se pudieron guardar los datos en el navegador.',
    );
  }
  if (!silent) emitDataChanged(name);
}

export function removeKey(name) {
  window.localStorage.removeItem(storageKey(name));
}

/** Elimina todos los datos de la aplicación del navegador. */
export function clearAppStorage() {
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

/** Nombre lógico de la colección a partir de una clave de localStorage. */
export function nameFromStorageKey(key) {
  return key?.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
}
