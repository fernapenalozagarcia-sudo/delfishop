import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * Selector de cantidad con botones − / + y validación de límites.
 * @param {{value?: number, min?: number, max: number, label?: string, id?: string, onChange?: (value:number) => void}} options
 */
export function createQuantityStepper({ value = 1, min = 1, max, label = 'Cantidad', id, onChange }) {
  let current = value;
  let limit = max;
  const inputId = id ?? `qty-${Math.random().toString(36).slice(2, 8)}`;

  const input = h('input', {
    id: inputId,
    class: 'stepper__input',
    type: 'number',
    inputmode: 'numeric',
    min,
    max: limit,
    step: 1,
    value: current,
    'aria-label': label,
  });
  const decrease = h('button', { type: 'button', class: 'stepper__button', 'aria-label': `Disminuir ${label.toLowerCase()}` }, icon('minus', { size: 16 }));
  const increase = h('button', { type: 'button', class: 'stepper__button', 'aria-label': `Aumentar ${label.toLowerCase()}` }, icon('plus', { size: 16 }));

  const element = h('div', { class: 'stepper' }, decrease, input, increase);

  function clamp(n) {
    if (!Number.isFinite(n)) return Math.max(min, Math.min(current, limit));
    return Math.max(min, Math.min(Math.round(n), Math.max(limit, min)));
  }

  function sync() {
    input.value = String(current);
    input.max = String(limit);
    decrease.disabled = current <= min || limit < min;
    increase.disabled = current >= limit;
    input.disabled = limit < min;
  }

  function set(next, { notify = true } = {}) {
    const clamped = clamp(next);
    const changed = clamped !== current;
    current = clamped;
    sync();
    if (changed && notify) onChange?.(current);
  }

  decrease.addEventListener('click', () => set(current - 1));
  increase.addEventListener('click', () => set(current + 1));
  input.addEventListener('change', () => {
    set(Number(input.value));
    sync();
  });

  sync();

  return {
    element,
    input,
    getValue: () => current,
    setValue: (n) => set(n, { notify: false }),
    setMax(nextMax) {
      limit = nextMax;
      set(current, { notify: false });
    },
  };
}
