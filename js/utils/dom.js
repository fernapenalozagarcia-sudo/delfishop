/**
 * Utilidades para construir DOM de forma segura.
 * El texto se inserta siempre como nodos de texto (nunca como HTML),
 * por lo que el contenido introducido por usuarios no se interpreta.
 */

/**
 * Crea un elemento.
 * @param {string} tag
 * @param {object} [props] class, text, dataset, style, on<Evento>, atributos.
 * @param {...(Node|string|number|null|undefined|false|Array)} children
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') {
      el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    } else if (key === 'text') {
      el.textContent = String(value);
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue !== undefined && dataValue !== null) el.dataset[dataKey] = String(dataValue);
      }
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, styleValue] of Object.entries(value)) el.style.setProperty(prop, styleValue);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

export function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Sustituye todo el contenido de un contenedor. */
export function mount(container, ...children) {
  container.replaceChildren();
  appendChildren(container, children);
  return container;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/** Retrasa la ejecución de una función hasta que dejen de producirse llamadas. */
export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Lee los datos de un formulario como objeto plano de cadenas recortadas. */
export function readForm(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    data[key] = typeof value === 'string' ? value.trim() : value;
  }
  return data;
}

/**
 * Muestra errores de validación junto a los campos de un formulario.
 * Cada campo debe tener un elemento [data-error-for="nombre"].
 */
export function showFieldErrors(form, errors = {}) {
  for (const el of qsa('[data-error-for]', form)) {
    const name = el.dataset.errorFor;
    const message = errors[name] || '';
    el.textContent = message;
    el.hidden = !message;
    const field = form.elements.namedItem(name);
    const fields = field instanceof RadioNodeList ? [...field] : field ? [field] : [];
    for (const input of fields) {
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        if (el.id) input.setAttribute('aria-describedby', el.id);
      } else {
        input.removeAttribute('aria-invalid');
      }
    }
  }
  if (!form.dataset.clearsErrors) {
    form.dataset.clearsErrors = 'true';
    const clear = (event) => {
      const name = event.target?.name;
      const el = name && form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
      if (!el || el.hidden) return;
      el.hidden = true;
      el.textContent = '';
      const field = form.elements.namedItem(name);
      (field instanceof RadioNodeList ? [...field] : [field]).forEach((input) => input?.removeAttribute?.('aria-invalid'));
    };
    form.addEventListener('input', clear);
    form.addEventListener('change', clear);
  }

  const firstInvalid = Object.keys(errors).find((name) => errors[name]);
  if (firstInvalid) {
    const field = form.elements.namedItem(firstInvalid);
    const target = field instanceof RadioNodeList ? field[0] : field;
    target?.focus?.();
  }
}
