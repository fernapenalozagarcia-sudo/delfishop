import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const ICON_BY_TYPE = { success: 'checkCircle', error: 'alert', info: 'info', warning: 'alert' };
let region;

function getRegion() {
  if (!region) {
    region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.append(region);
  }
  return region;
}

/**
 * Muestra un aviso temporal.
 * @param {string} message
 * @param {{type?: 'success'|'error'|'info'|'warning', title?: string, action?: {label:string, href:string}, duration?: number}} [options]
 */
export function showToast(message, { type = 'success', title, action, duration = 4500 } = {}) {
  const close = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  };

  const toast = h(
    'div',
    { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : null },
    h('span', { class: 'toast__icon' }, icon(ICON_BY_TYPE[type] ?? 'info')),
    h(
      'div',
      { class: 'toast__content' },
      title && h('p', { class: 'toast__title', text: title }),
      h('p', { class: 'toast__message', text: message }),
      action && h('a', { class: 'toast__action', href: action.href, text: action.label }),
    ),
    h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Cerrar aviso', onClick: close }, icon('x', { size: 16 })),
  );

  getRegion().append(toast);
  if (duration) setTimeout(close, duration);
  return close;
}
