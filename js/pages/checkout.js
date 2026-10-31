import { initStorefront } from '../app.js';
import { h, mount, readForm, showFieldErrors } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoney } from '../utils/format.js';
import { getErrorMessage, ValidationError } from '../utils/errors.js';
import { onDataChanged } from '../utils/events.js';
import { routeUrl } from '../router.js';
import { CONFIG } from '../config.js';
import { calculateTotals, getDeliveryCost } from '../domain/pricing.js';
import { normalizeCustomerInput, validateCheckout } from '../domain/checkoutValidation.js';
import { clearCart, getCartDetails } from '../services/cartService.js';
import { createOrder } from '../services/orderService.js';
import { itemsMiniList, totalsList } from '../components/orderSummary.js';
import { emptyState, errorState, loadingState } from '../components/states.js';
import { showToast } from '../components/toast.js';

initStorefront({ active: 'checkout' });

const root = document.getElementById('checkout-root');
const KEY_STORAGE = 'olmo:checkout-key';

const MX_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México',
  'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán',
  'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

let submitting = false;
let draft = {};

/** Clave de idempotencia: evita registrar dos veces el mismo pedido por doble envío. */
function getIdempotencyKey() {
  let key = sessionStorage.getItem(KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

function field({ name, label, type = 'text', required = false, optional = false, hint, autocomplete, inputmode, maxlength, placeholder, full = false, control }) {
  const id = `co-${name}`;
  const errorId = `${id}-error`;
  const input =
    control ??
    h('input', {
      id,
      name,
      type,
      class: 'input',
      required,
      autocomplete,
      inputmode,
      maxlength,
      placeholder,
      value: draft[name] ?? '',
      'aria-describedby': hint ? `${id}-hint` : null,
    });
  if (control) {
    control.id = id;
    control.name = name;
  }
  return h(
    'div',
    { class: ['field', full && 'field--full'] },
    h('label', { class: 'field__label', for: id }, label, optional && h('span', { class: 'field__optional', text: ' (opcional)' }), required && h('span', { 'aria-hidden': 'true', text: ' *' })),
    input,
    hint && h('p', { class: 'field__hint', id: `${id}-hint`, text: hint }),
    h('p', { class: 'field__error', id: errorId, 'data-error-for': name, hidden: true }),
  );
}

function deliveryOptions(subtotal, selectedId, onChange) {
  return h(
    'div',
    { class: 'delivery-options' },
    CONFIG.checkout.deliveryMethods.map((method) => {
      const cost = getDeliveryCost(method, subtotal);
      const id = `co-delivery-${method.id}`;
      return h(
        'label',
        { class: 'delivery-option', for: id },
        h('input', { type: 'radio', id, name: 'deliveryMethod', value: method.id, required: true, checked: selectedId === method.id, onChange }),
        h(
          'span',
          { class: 'delivery-option__body' },
          h('span', { class: 'delivery-option__title' }, icon(method.requiresAddress ? 'truck' : 'store', { size: 18 }), method.label),
          h('span', { class: 'delivery-option__desc', text: method.description }),
          method.freeFrom && cost > 0 && h('span', { class: 'delivery-option__desc', text: `Gratis en compras desde ${formatMoney(method.freeFrom)}.` }),
        ),
        h('span', { class: 'delivery-option__price', text: cost === 0 ? 'Gratis' : formatMoney(cost) }),
      );
    }),
  );
}

function renderForm(details) {
  const { lines } = details;
  const selectedMethod = draft.deliveryMethod ?? '';

  const summaryTotals = h('div');
  const addressSection = h('fieldset', { class: 'checkout-section', hidden: !CONFIG.checkout.deliveryMethods.find((m) => m.id === selectedMethod)?.requiresAddress });
  const formAlert = h('div', { class: 'form-message', 'aria-live': 'assertive' });

  const updateSummary = () => {
    const methodId = form.elements.namedItem('deliveryMethod')?.value || null;
    mount(summaryTotals, totalsList(calculateTotals(lines, methodId)));
    const method = CONFIG.checkout.deliveryMethods.find((m) => m.id === methodId);
    addressSection.hidden = !method?.requiresAddress;
  };

  const stateSelect = h(
    'select',
    { class: 'select', autocomplete: 'address-level1' },
    h('option', { value: '', text: 'Selecciona un estado' }),
    MX_STATES.map((s) => h('option', { value: s, text: s, selected: draft.state === s })),
  );

  mount(
    addressSection,
    h('legend', { class: 'checkout-section__title', text: 'Dirección de entrega' }),
    h(
      'div',
      { class: 'form-grid' },
      field({ name: 'street', label: 'Calle y número', required: true, autocomplete: 'address-line1', maxlength: 120, full: true, placeholder: 'Ej. Av. Reforma 123, Int. 4' }),
      field({ name: 'neighborhood', label: 'Colonia', required: true, autocomplete: 'address-line2', maxlength: 80 }),
      field({ name: 'postalCode', label: 'Código postal', required: true, autocomplete: 'postal-code', inputmode: 'numeric', maxlength: 5 }),
      field({ name: 'city', label: 'Ciudad o municipio', required: true, autocomplete: 'address-level2', maxlength: 60 }),
      field({ name: 'state', label: 'Estado', required: true, control: stateSelect }),
      field({ name: 'references', label: 'Referencias', optional: true, maxlength: 200, full: true, placeholder: 'Entre calles, color de fachada…' }),
    ),
  );

  const notes = h('textarea', { class: 'textarea', maxlength: '500', rows: '3', placeholder: 'Indicaciones para tu pedido, horarios de entrega, etc.' });
  notes.value = draft.notes ?? '';

  const form = h(
    'form',
    { class: 'checkout-form', id: 'checkout-form', novalidate: true },
    h('p', { class: 'field__hint', text: 'Los campos marcados con * son obligatorios.' }),
    h(
      'fieldset',
      { class: 'checkout-section' },
      h('legend', { class: 'checkout-section__title', text: 'Datos de contacto' }),
      h(
        'div',
        { class: 'form-grid' },
        field({ name: 'name', label: 'Nombre completo', required: true, autocomplete: 'name', maxlength: 80, full: true }),
        field({ name: 'phone', label: 'Teléfono', type: 'tel', required: true, autocomplete: 'tel', inputmode: 'tel', maxlength: 16, hint: '10 dígitos. Te contactaremos para confirmar tu pedido.' }),
        field({ name: 'email', label: 'Correo electrónico', type: 'email', optional: true, autocomplete: 'email', maxlength: 120 }),
      ),
    ),
    h(
      'fieldset',
      { class: 'checkout-section' },
      h('legend', { class: 'checkout-section__title', text: 'Método de entrega *' }),
      deliveryOptions(details.totals.subtotal, selectedMethod, updateSummary),
      h('p', { class: 'field__error', id: 'co-deliveryMethod-error', 'data-error-for': 'deliveryMethod', hidden: true }),
    ),
    addressSection,
    h('fieldset', { class: 'checkout-section' }, h('legend', { class: 'checkout-section__title', text: 'Notas adicionales' }), field({ name: 'notes', label: 'Notas para la tienda', optional: true, control: notes, full: true })),
  );

  form.addEventListener('input', () => {
    draft = readForm(form);
  });

  const submitButton = h('button', { type: 'submit', form: 'checkout-form', class: 'btn btn--primary btn--lg btn--block' }, 'Confirmar pedido');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    formAlert.replaceChildren();

    const data = readForm(form);
    const errors = validateCheckout(normalizeCustomerInput(data));
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) {
      mount(formAlert, h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: 'Revisa los campos marcados para continuar.' })));
      return;
    }

    submitting = true;
    submitButton.classList.add('is-loading');
    submitButton.disabled = true;
    try {
      const current = await getCartDetails();
      if (!current.lines.length) throw new Error('EMPTY');
      if (current.hasIssues) {
        submitting = false;
        submitButton.classList.remove('is-loading');
        submitButton.disabled = false;
        mount(
          formAlert,
          h('p', { class: 'alert alert--warning', role: 'alert' }, icon('alert', { size: 18 }), h('span', {}, 'Algunos productos cambiaron de disponibilidad. ', h('a', { href: routeUrl('cart'), text: 'Revisa tu carrito' }), ' para continuar.')),
        );
        return;
      }

      const order = await createOrder({
        items: current.lines.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })),
        form: data,
        idempotencyKey: getIdempotencyKey(),
      });
      // El carrito se vacía solo después de registrar el pedido.
      clearCart();
      sessionStorage.removeItem(KEY_STORAGE);
      window.location.assign(routeUrl('confirmation', { id: order.id }));
    } catch (error) {
      submitting = false;
      submitButton.classList.remove('is-loading');
      submitButton.disabled = false;
      if (error instanceof ValidationError) showFieldErrors(form, error.fieldErrors);
      const message = error.message === 'EMPTY' ? 'Tu carrito está vacío.' : getErrorMessage(error);
      mount(formAlert, h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: message })));
      showToast(message, { type: 'error', title: 'No se pudo generar el pedido' });
    }
  });

  mount(
    root,
    h(
      'div',
      { class: 'checkout-layout' },
      h('section', { class: 'checkout-main card', 'aria-label': 'Datos del pedido' }, form),
      h(
        'aside',
        { class: 'cart-summary card', 'aria-labelledby': 'co-summary-title' },
        h('div', { class: 'cart-summary__header' }, h('h2', { class: 'card__title', id: 'co-summary-title', text: 'Tu pedido' }), h('a', { class: 'link-button', href: routeUrl('cart'), text: 'Editar carrito' })),
        itemsMiniList(lines),
        h('hr', { class: 'divider' }),
        summaryTotals,
        formAlert,
        submitButton,
        h(
          'p',
          { class: 'cart-summary__secure' },
          icon('info', { size: 16 }),
          'Al confirmar, tu pedido quedará como «Pendiente». La tienda te contactará para confirmar disponibilidad, forma de pago y entrega.',
        ),
      ),
    ),
  );
  updateSummary();
}

async function render() {
  if (submitting) return;
  try {
    const details = await getCartDetails();
    root.removeAttribute('aria-busy');
    if (!details.lines.length) {
      mount(
        root,
        emptyState({
          icon: 'bag',
          title: 'No hay productos para generar un pedido',
          message: 'Agrega productos a tu carrito antes de continuar.',
          actions: [{ label: 'Ir al catálogo', href: routeUrl('catalog') }],
        }),
      );
      return;
    }
    if (details.hasIssues) {
      mount(
        root,
        emptyState({
          icon: 'alert',
          title: 'Revisa tu carrito',
          message: 'Algunos productos ya no están disponibles o superan las existencias. Ajústalos para continuar.',
          actions: [{ label: 'Volver al carrito', href: routeUrl('cart') }],
        }),
      );
      return;
    }
    renderForm(details);
  } catch (error) {
    mount(root, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

mount(root, loadingState('Preparando tu pedido…'));
render();
onDataChanged(['cart', 'products'], render);
