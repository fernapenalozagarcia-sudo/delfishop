import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

export function loadingState(message = 'Cargando…') {
  return h(
    'div',
    { class: 'state state--loading', role: 'status' },
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('p', { class: 'state__message', text: message }),
  );
}

function actionNode(action) {
  if (!action) return null;
  if (action.href) return h('a', { class: `btn ${action.variant ?? 'btn--primary'}`, href: action.href, text: action.label });
  return h('button', { type: 'button', class: `btn ${action.variant ?? 'btn--primary'}`, text: action.label, onClick: action.onClick });
}

/**
 * Estado vacío con título, descripción y acciones opcionales.
 * @param {{icon?: string, title: string, message?: string, actions?: object[]}} options
 */
export function emptyState({ icon: iconName = 'search', title, message, actions = [], headingLevel = 2 }) {
  return h(
    'div',
    { class: 'state state--empty' },
    h('span', { class: 'state__icon' }, icon(iconName, { size: 28 })),
    h(headingLevel === 1 ? 'h1' : 'h2', { class: 'state__title', text: title }),
    message && h('p', { class: 'state__message', text: message }),
    actions.length ? h('div', { class: 'state__actions' }, actions.map(actionNode)) : null,
  );
}

export function errorState({ title = 'No pudimos cargar la información', message, onRetry }) {
  return h(
    'div',
    { class: 'state state--error', role: 'alert' },
    h('span', { class: 'state__icon' }, icon('alert', { size: 28 })),
    h('h2', { class: 'state__title', text: title }),
    message && h('p', { class: 'state__message', text: message }),
    onRetry && h('div', { class: 'state__actions' }, actionNode({ label: 'Reintentar', onClick: onRetry })),
  );
}
