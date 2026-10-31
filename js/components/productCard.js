import { CONFIG } from '../config.js';
import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoney } from '../utils/format.js';
import { routeUrl } from '../router.js';
import { getCategoryName, getSubcategoryName } from '../data/categories.js';
import { getDiscountPercent } from '../domain/pricing.js';
import { getAvailabilityLabel, getStockStatus, STOCK_STATUS } from '../domain/inventoryRules.js';
import { buildProductWhatsAppUrl } from '../utils/whatsapp.js';
import { productImage } from './productImage.js';

let cardCounter = 0;

export function priceBlock(product, { size = 'md' } = {}) {
  const discount = getDiscountPercent(product);
  return h(
    'div',
    { class: `price price--${size}` },
    h('span', { class: 'price__current', text: formatMoney(product.price) }),
    discount > 0 && h('s', { class: 'price__old', text: formatMoney(product.compareAtPrice) }, h('span', { class: 'sr-only', text: ' precio anterior' })),
    discount > 0 && h('span', { class: 'price__discount', text: `-${discount}%` }),
  );
}

export function whatsappButton({ href, label = 'Comprar por WhatsApp', size = '' }) {
  return h(
    'a',
    {
      class: ['btn', 'btn--whatsapp', size && `btn--${size}`],
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    icon('whatsapp', { size: 18 }),
    h('span', { text: label }),
    h('span', { class: 'sr-only', text: ' (se abre en una pestaña nueva)' }),
  );
}

/** Aviso visible mientras CONFIG.whatsapp.number sea un marcador de posición. */
export function whatsappDemoNotice() {
  if (!CONFIG.whatsapp.isPlaceholder) return null;
  return h('p', { class: 'whatsapp-notice' }, icon('info', { size: 14 }), h('span', { text: 'Número de WhatsApp de demostración: el mensaje se prepara, pero no llegará a una tienda real.' }));
}

/**
 * Tarjeta de producto del catálogo con selección rápida de talla y color
 * para personalizar el mensaje de WhatsApp.
 */
export function createProductCard(product) {
  cardCounter += 1;
  const uid = `pc${cardCounter}`;
  const detailUrl = routeUrl('product', { id: product.id });
  const status = getStockStatus(product);
  const discount = getDiscountPercent(product);
  const selection = { size: product.sizes.length === 1 ? product.sizes[0] : '', color: product.colors.length === 1 ? product.colors[0].name : '' };

  const waLink = whatsappButton({ href: '', size: 'sm' });
  waLink.setAttribute('aria-label', `Comprar ${product.name} por WhatsApp (se abre en una pestaña nueva)`);
  const refreshWhatsApp = () => {
    waLink.href = buildProductWhatsAppUrl({ product, size: selection.size, color: selection.color, productUrl: detailUrl });
  };
  refreshWhatsApp();

  const badges = h(
    'div',
    { class: 'product-card__badges' },
    discount > 0 && h('span', { class: 'tag tag--sale', text: `-${discount}%` }),
    product.isNew && h('span', { class: 'tag tag--new', text: 'Nuevo' }),
    status === STOCK_STATUS.OUT && h('span', { class: 'tag tag--muted', text: 'Agotado' }),
  );

  const colorGroup =
    product.colors.length > 0 &&
    h(
      'fieldset',
      { class: 'swatches swatches--sm' },
      h('legend', { class: 'sr-only', text: `Color de ${product.name}` }),
      product.colors.map((color, i) => {
        const id = `${uid}-c${i}`;
        const input = h('input', {
          type: 'radio',
          id,
          name: `${uid}-color`,
          value: color.name,
          class: 'swatch__input',
          checked: selection.color === color.name,
          onChange: () => {
            selection.color = color.name;
            refreshWhatsApp();
          },
        });
        return h(
          'span',
          { class: 'swatch' },
          input,
          h('label', { for: id, class: 'swatch__label', title: color.name, style: { '--swatch': color.hex } }, h('span', { class: 'sr-only', text: color.name })),
        );
      }),
    );

  const sizeSelect =
    product.sizes.length > 1
      ? h(
          'select',
          {
            class: 'select select--sm',
            'aria-label': `Talla de ${product.name}`,
            onChange: (e) => {
              selection.size = e.target.value;
              refreshWhatsApp();
            },
          },
          h('option', { value: '', text: 'Talla' }),
          product.sizes.map((size) => h('option', { value: size, text: size })),
        )
      : h('span', { class: 'product-card__one-size', text: product.sizes[0] ?? '' });

  return h(
    'article',
    { class: ['product-card', status === STOCK_STATUS.OUT && 'is-soldout'] },
    h(
      'a',
      { class: 'product-card__media', href: detailUrl, tabindex: '-1', 'aria-hidden': 'true' },
      productImage({ src: product.images[0], alt: '', width: 520 }),
      product.images[1] && productImage({ src: product.images[1], alt: '', width: 520, className: 'product-card__alt' }),
    ),
    badges,
    h(
      'div',
      { class: 'product-card__body' },
      h('p', { class: 'product-card__category', text: `${getCategoryName(product.category)} · ${getSubcategoryName(product.subcategory)}` }),
      h('h3', { class: 'product-card__title' }, h('a', { href: detailUrl, text: product.name })),
      priceBlock(product, { size: 'sm' }),
      h('p', { class: `availability availability--${status}`, text: getAvailabilityLabel(product) }),
      h('div', { class: 'product-card__variants' }, colorGroup, sizeSelect),
      h(
        'div',
        { class: 'product-card__actions' },
        h('a', { class: 'btn btn--outline btn--sm', href: detailUrl, 'aria-label': `Ver detalles de ${product.name}` }, 'Ver detalles'),
        waLink,
      ),
    ),
  );
}

/** Rejilla de tarjetas de producto. */
export function productGrid(products, { className = '' } = {}) {
  return h('div', { class: ['product-grid', className] }, products.map(createProductCard));
}
