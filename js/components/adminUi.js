/** Piezas de interfaz compartidas por las páginas del panel administrativo. */
import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * Tarjeta de indicador.
 * @param {{label: string, value: string, hint?: string, icon: string, tone?: string, href?: string}} options
 */
export function kpiCard({ label, value, hint, icon: iconName, tone = 'neutral', href }) {
  return h(
    href ? 'a' : 'div',
    { class: `kpi kpi--${tone}`, href },
    h('span', { class: 'kpi__icon' }, icon(iconName, { size: 20 })),
    h('span', { class: 'kpi__label', text: label }),
    h('strong', { class: 'kpi__value', text: value }),
    hint && h('span', { class: 'kpi__hint', text: hint }),
  );
}

/** Tabla accesible con encabezados y filas ya construidas. */
export function dataTable({ caption, columns, rows, footer }) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'table' },
      caption && h('caption', { class: 'sr-only', text: caption }),
      h('thead', {}, h('tr', {}, columns.map((col) => h('th', { scope: 'col', class: col.className, text: col.label })))),
      h('tbody', {}, rows),
      footer && h('tfoot', {}, footer),
    ),
  );
}

export function searchInput({ id, label, placeholder, value = '', onInput }) {
  return h(
    'div',
    { class: 'field admin-filter admin-filter--search' },
    h('label', { class: 'field__label', for: id, text: label }),
    h(
      'div',
      { class: 'input-icon' },
      icon('search', { size: 18 }),
      h('input', { id, type: 'search', class: 'input input--sm', placeholder, value, autocomplete: 'off', maxlength: '80', onInput }),
    ),
  );
}

export function selectFilter({ id, label, options, value = '', onChange }) {
  return h(
    'div',
    { class: 'field admin-filter' },
    h('label', { class: 'field__label', for: id, text: label }),
    h(
      'select',
      { id, class: 'select select--sm', onChange },
      options.map((o) => h('option', { value: o.value, text: o.label, selected: o.value === value })),
    ),
  );
}
