import { initStorefront } from '../app.js';
import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoneyShort } from '../utils/format.js';
import { getErrorMessage, ValidationError } from '../utils/errors.js';
import { onDataChanged } from '../utils/events.js';
import { getQueryParams, routeUrl } from '../router.js';
import { CONFIG } from '../config.js';
import { getCategoryName, getSubcategoryName } from '../data/categories.js';
import { getAvailabilityLabel, getStockStatus, STOCK_STATUS } from '../domain/inventoryRules.js';
import { sortSizes } from '../domain/catalogFilters.js';
import { getProductById, getRelatedProducts } from '../services/productService.js';
import { addToCart, getQuantityInCart } from '../services/cartService.js';
import { buildProductWhatsAppUrl } from '../utils/whatsapp.js';
import { priceBlock, productGrid, whatsappButton, whatsappDemoNotice } from '../components/productCard.js';
import { productImage } from '../components/productImage.js';
import { createQuantityStepper } from '../components/quantityStepper.js';
import { emptyState, errorState } from '../components/states.js';
import { showToast } from '../components/toast.js';

initStorefront({ active: 'catalogo-producto' });

const root = document.getElementById('product-root');
const breadcrumb = document.getElementById('breadcrumb');
const productId = getQueryParams().get('id') ?? '';

const state = { size: '', color: '', quantity: 1, imageIndex: 0 };
const freeShippingFrom = CONFIG.checkout.deliveryMethods.find((m) => m.freeFrom)?.freeFrom;

/** Primera oración de la descripción, usada como entradilla. */
const leadText = (text) => text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;

function renderBreadcrumb(product) {
  mount(
    breadcrumb,
    h('li', {}, h('a', { href: routeUrl('home'), text: 'Inicio' })),
    h('li', {}, h('a', { href: routeUrl('catalog'), text: 'Catálogo' })),
    product && h('li', {}, h('a', { href: routeUrl('catalog', { categoria: product.category }), text: getCategoryName(product.category) })),
    h('li', {}, h('span', { 'aria-current': 'page', text: product ? product.name : 'Producto no disponible' })),
  );
}

function gallery(product) {
  const images = product.images.length ? product.images : [''];
  state.imageIndex = Math.min(state.imageIndex, images.length - 1);
  const main = h('div', { class: 'gallery__main' });

  const showImage = (index) => {
    state.imageIndex = index;
    mount(main, productImage({ src: images[index], alt: `${product.name}, imagen ${index + 1} de ${images.length}`, width: 900, eager: true }));
    thumbs.querySelectorAll('button').forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === index)));
  };

  const thumbs = h(
    'div',
    { class: 'gallery__thumbs', role: 'group', 'aria-label': 'Imágenes del producto' },
    images.length > 1 &&
      images.map((src, i) =>
        h(
          'button',
          { type: 'button', class: 'gallery__thumb', 'aria-label': `Ver imagen ${i + 1} de ${images.length}`, 'aria-pressed': String(i === state.imageIndex), onClick: () => showImage(i) },
          productImage({ src, alt: '', width: 160 }),
        ),
      ),
  );

  showImage(state.imageIndex);
  return h('div', { class: 'gallery' }, main, thumbs);
}

function renderProduct(product) {
  const status = getStockStatus(product);
  const inCart = getQuantityInCart(product.id);
  const available = Math.max(0, Math.min(product.stock - inCart, CONFIG.checkout.maxUnitsPerLine));
  const productUrl = routeUrl('product', { id: product.id });

  if (product.sizes.length === 1) state.size = product.sizes[0];
  if (product.colors.length === 1) state.color = product.colors[0].name;
  if (!product.sizes.includes(state.size)) state.size = '';
  if (!product.colors.some((c) => c.name === state.color)) state.color = '';
  state.quantity = Math.max(1, Math.min(state.quantity, available || 1));

  const waButton = whatsappButton({ href: '', size: 'lg' });
  waButton.classList.add('btn--block');
  const refreshWhatsApp = () => {
    waButton.href = buildProductWhatsAppUrl({ product, size: state.size, color: state.color, quantity: state.quantity, productUrl });
  };

  const stepper = createQuantityStepper({
    value: state.quantity,
    max: available,
    id: 'quantity',
    onChange: (value) => {
      state.quantity = value;
      refreshWhatsApp();
    },
  });

  const colorLabel = h('span', { class: 'option-heading__value', text: state.color || 'Elige un color' });
  const colorError = h('p', { class: 'field__error', id: 'color-error', 'data-error-for': 'color', hidden: true });
  const sizeError = h('p', { class: 'field__error', id: 'size-error', 'data-error-for': 'size', hidden: true });
  const formMessage = h('div', { class: 'form-message', 'aria-live': 'polite' });

  const colorGroup = h(
    'fieldset',
    { class: 'option-block' },
    h('legend', { class: 'option-heading' }, h('span', { text: 'Color: ' }), colorLabel),
    h(
      'div',
      { class: 'swatches' },
      product.colors.map((color, i) => {
        const id = `color-${i}`;
        return h(
          'span',
          { class: 'swatch' },
          h('input', {
            type: 'radio',
            id,
            name: 'color',
            value: color.name,
            class: 'swatch__input',
            required: true,
            checked: state.color === color.name,
            'aria-describedby': 'color-error',
            onChange: () => {
              state.color = color.name;
              colorLabel.textContent = color.name;
              colorError.hidden = true;
              refreshWhatsApp();
            },
          }),
          h('label', { for: id, class: 'swatch__label', title: color.name, style: { '--swatch': color.hex } }, h('span', { class: 'sr-only', text: color.name })),
        );
      }),
    ),
    colorError,
  );

  const sizeGroup = h(
    'fieldset',
    { class: 'option-block' },
    h('legend', { class: 'option-heading' }, h('span', { text: 'Talla' })),
    h(
      'div',
      { class: 'option-group' },
      sortSizes(product.sizes).map((size) => {
        const id = `size-${size.replace(/\W+/g, '_')}`;
        return h(
          'span',
          { class: 'option' },
          h('input', {
            type: 'radio',
            id,
            name: 'size',
            value: size,
            class: 'option__input',
            required: true,
            checked: state.size === size,
            'aria-describedby': 'size-error',
            onChange: () => {
              state.size = size;
              sizeError.hidden = true;
              refreshWhatsApp();
            },
          }),
          h('label', { for: id, class: 'option__label', text: size }),
        );
      }),
    ),
    sizeError,
  );

  const stockHint =
    status === STOCK_STATUS.OUT
      ? 'Sin existencias por ahora.'
      : inCart > 0
        ? `${product.stock} en existencia · ${inCart} ya en tu carrito`
        : `${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`;

  const addButton = h('button', { type: 'submit', class: 'btn btn--primary btn--lg btn--block', disabled: available === 0 }, icon('bag', { size: 18 }), h('span', { text: available === 0 && status !== STOCK_STATUS.OUT ? 'Ya tienes todas las unidades' : status === STOCK_STATUS.OUT ? 'Agotado' : 'Agregar al carrito' }));

  const form = h(
    'form',
    { class: 'product-form', novalidate: true },
    colorGroup,
    sizeGroup,
    h(
      'div',
      { class: 'option-block' },
      h('label', { class: 'option-heading', for: 'quantity', text: 'Cantidad' }),
      h('div', { class: 'quantity-row' }, stepper.element, h('p', { class: 'field__hint', text: stockHint })),
    ),
    formMessage,
    h('div', { class: 'product-form__actions' }, addButton, waButton, whatsappDemoNotice()),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    colorError.hidden = Boolean(state.color);
    colorError.textContent = state.color ? '' : 'Selecciona un color.';
    sizeError.hidden = Boolean(state.size);
    sizeError.textContent = state.size ? '' : 'Selecciona una talla.';
    formMessage.replaceChildren();
    if (!state.color || !state.size) {
      form.querySelector(`input[name="${!state.color ? 'color' : 'size'}"]`)?.focus();
      return;
    }
    addButton.disabled = true;
    try {
      await addToCart({ productId: product.id, size: state.size, color: state.color, quantity: stepper.getValue() });
      showToast(`${stepper.getValue()} × ${product.name} (${state.size}, ${state.color})`, {
        title: 'Agregado al carrito',
        action: { label: 'Ver carrito', href: routeUrl('cart') },
      });
      state.quantity = 1;
      render();
    } catch (error) {
      addButton.disabled = false;
      const message = getErrorMessage(error);
      if (error instanceof ValidationError) {
        if (error.fieldErrors.size) Object.assign(sizeError, { textContent: error.fieldErrors.size, hidden: false });
        if (error.fieldErrors.color) Object.assign(colorError, { textContent: error.fieldErrors.color, hidden: false });
      }
      mount(formMessage, h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: message })));
    }
  });

  refreshWhatsApp();

  const benefits = h(
    'ul',
    { class: 'product-benefits' },
    h('li', {}, icon('truck', { size: 18 }), h('span', { text: freeShippingFrom ? `Envío gratis desde ${formatMoneyShort(freeShippingFrom)} o recoge en tienda sin costo.` : 'Recoge en tienda sin costo.' })),
    h('li', {}, icon('refresh', { size: 18 }), h('span', { text: 'Cambios de talla dentro de los 30 días posteriores a la entrega.' })),
    h('li', {}, icon('shield', { size: 18 }), h('span', { text: 'Sin cobros en línea: confirmamos tu pedido y forma de pago contigo.' })),
  );

  const details = h(
    'dl',
    { class: 'product-specs' },
    [
      ['Categoría', `${getCategoryName(product.category)} · ${getSubcategoryName(product.subcategory)}`],
      ['Tallas', sortSizes(product.sizes).join(', ')],
      ['Colores', product.colors.map((c) => c.name).join(', ')],
      ['Existencias', status === STOCK_STATUS.OUT ? 'Agotado' : `${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}`],
      ['Código (SKU)', product.sku],
    ].map(([term, value]) => h('div', { class: 'product-specs__row' }, h('dt', { text: term }), h('dd', { text: value }))),
  );

  mount(
    root,
    h(
      'article',
      { class: 'product-detail' },
      gallery(product),
      h(
        'div',
        { class: 'product-info' },
        h('p', { class: 'eyebrow', text: `${getCategoryName(product.category)} · ${getSubcategoryName(product.subcategory)}` }),
        h('h1', { class: 'product-info__title', text: product.name }),
        priceBlock(product, { size: 'lg' }),
        h(
          'div',
          { class: 'product-info__meta' },
          h('span', { class: `availability availability--${status}`, text: getAvailabilityLabel(product) }),
          product.isNew && h('span', { class: 'badge badge--neutral', text: 'Nuevo' }),
          product.featured && h('span', { class: 'badge badge--accent', text: 'Destacado' }),
        ),
        h('p', { class: 'product-info__lead', text: leadText(product.description) }),
        form,
        benefits,
        h('section', { class: 'product-section', 'aria-labelledby': 'desc-title' }, h('h2', { class: 'product-section__title', id: 'desc-title', text: 'Descripción' }), h('p', { text: product.description })),
        h('section', { class: 'product-section', 'aria-labelledby': 'specs-title' }, h('h2', { class: 'product-section__title', id: 'specs-title', text: 'Detalles' }), details),
      ),
    ),
  );
  document.title = `${product.name} · OLMO`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', product.description.slice(0, 155));
}

async function renderRelated(product) {
  const section = document.getElementById('related-section');
  const related = await getRelatedProducts(product, 4);
  section.hidden = related.length === 0;
  if (!related.length) return;
  document.getElementById('related-link').href = routeUrl('catalog', { categoria: product.category });
  mount(document.getElementById('related-products'), productGrid(related, { className: 'product-grid--4' }));
}

async function render() {
  try {
    const product = productId ? await getProductById(productId) : null;
    root.removeAttribute('aria-busy');
    renderBreadcrumb(product);
    if (!product) {
      document.getElementById('related-section').hidden = true;
      mount(
        root,
        emptyState({
          icon: 'shirt',
          headingLevel: 1,
          title: 'Este producto no está disponible',
          message: 'Es posible que se haya retirado del catálogo o que el enlace no sea correcto.',
          actions: [{ label: 'Ir al catálogo', href: routeUrl('catalog') }],
        }),
      );
      document.title = 'Producto no disponible · OLMO';
      return;
    }
    renderProduct(product);
    await renderRelated(product);
  } catch (error) {
    mount(root, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

render();
onDataChanged(['products', 'cart'], render);
