/**
 * Bus de eventos mínimo para notificar cambios de datos.
 * Las páginas se suscriben para refrescar contadores, tablas e indicadores,
 * incluso cuando el cambio ocurre en otra pestaña del navegador.
 */
const EVENT_NAME = 'olmo:data-changed';

export function emitDataChanged(entity) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { entity } }));
}

/**
 * @param {string[]|null} entities colecciones de interés (null = todas).
 * @param {(entity: string) => void} callback
 * @returns {() => void} función para cancelar la suscripción.
 */
export function onDataChanged(entities, callback) {
  const handler = (event) => {
    const { entity } = event.detail;
    if (!entities || entities.includes(entity)) callback(entity);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
