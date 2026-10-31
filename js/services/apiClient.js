/**
 * Cliente HTTP preparado para la futura API REST.
 *
 * Actualmente NO se utiliza: CONFIG.api.dataSource vale "local" y los servicios
 * leen y escriben en localStorage. Cuando exista el backend, cada servicio podrá
 * reemplazar sus operaciones locales por llamadas como:
 *
 *   const products = await apiRequest('/products', { query: { categoria: 'dama' } });
 *   await apiRequest(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
 */
import { CONFIG } from '../config.js';
import { AppError } from '../utils/errors.js';

export async function apiRequest(path, { method = 'GET', body, query, headers = {} } = {}) {
  if (CONFIG.api.dataSource !== 'api') {
    throw new AppError('La API todavía no está disponible: la aplicación funciona con datos locales.');
  }

  const url = new URL(path.replace(/^\//, ''), CONFIG.api.baseUrl.replace(/\/?$/, '/'));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.api.timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      throw new AppError(data?.message ?? `Error del servidor (${response.status}).`, { code: `HTTP_${response.status}`, details: data });
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new AppError('El servidor tardó demasiado en responder.');
    throw error instanceof AppError ? error : new AppError('No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timer);
  }
}
