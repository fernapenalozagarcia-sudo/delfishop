import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * Abre un diálogo modal accesible basado en <dialog>.
 * @param {{title: string, body: Node|Node[], footer?: Node[], size?: 'sm'|'md'|'lg', onClose?: () => void}} options
 * @returns {{dialog: HTMLDialogElement, close: () => void}}
 */
export function openDialog({ title, body, footer = [], size = 'md', onClose }) {
  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;
  const opener = document.activeElement;

  const dialog = h(
    'dialog',
    { class: `dialog dialog--${size}`, 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'dialog__header' },
      h('h2', { class: 'dialog__title', id: titleId, text: title }),
      h('button', { type: 'button', class: 'icon-button', 'aria-label': 'Cerrar', onClick: () => close() }, icon('x')),
    ),
    h('div', { class: 'dialog__body' }, body),
    footer.length ? h('div', { class: 'dialog__footer' }, footer) : null,
  );

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  });
  // Cerrar al hacer clic en el fondo.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

/**
 * Diálogo de confirmación.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'danger', details }) {
  return new Promise((resolve) => {
    let result = false;
    const cancelButton = h('button', { type: 'button', class: 'btn btn--ghost', text: cancelLabel, onClick: () => close() });
    const confirmButton = h('button', {
      type: 'button',
      class: `btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`,
      text: confirmLabel,
      onClick: () => {
        result = true;
        close();
      },
    });
    const { close } = openDialog({
      title,
      size: 'sm',
      body: [h('p', { class: 'dialog__message', text: message }), details ?? null],
      footer: [cancelButton, confirmButton],
      onClose: () => resolve(result),
    });
    cancelButton.focus();
  });
}
