import { initStorefront } from '../app.js';
import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoney, formatMoneyShort, pluralize } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import { onDataChanged } from '../utils/events.js';
import { routeUrl } from '../router.js';
import { CONFIG } from '../config.js';
import { clearCart, getCartDetails, removeFromCart, updateCartItemQuantity } from '../services/cartService.js';
import { createQuantityStepper } from '../components/quantityStepper.js';
import { productImage } from '../components/productImage.js';
import { totalsList } from '../components/orderSummary.js';
import { emptyState, errorState, loadingState } from '../components/states.js';
import { confirmDialog } from '../components/dialog.js';
import { showToast } from '../components/toast.js';

initStorefront({ active: 'carrito' });

const root = document.getElementById('cart-root');
const subtitle = document.getElementById('cart-subtitle');
const shippingMethod = CONFIG.checkout.deliveryMethods.find((m) => m.freeFrom);

function lineItem(line) {
  const product = line.product;
  const detailUrl = product ? routeUrl('product', { id: product.id }) : null;
  const name = product?.name ?? 'Producto no disponible';

  const stepper = createQuantityStepper({
    value: line.quantity,
    max: line.issue === 'unavailable' ? 0 : Math.max(line.maxQuantity, line.quantity),
    label: `Cantidad de ${name}`,
    onChange: async (value) => {
      try {
        await updateCartItemQuantity(line.key, value);
      } catch (error) {
        stepper.setValue(line.quantity);
        showToast(getErrorMessage(error), { type: 'error' });
      }
    },
  });
  stepper.element.classList.add('stepper--sm');
  const [decrease, increase] = stepper.element.querySelectorAll('button');
  decrease.dataset.focusKey = `${line.key}-dec`;
  increase.dataset.focusKey = `${line.key}-inc`;
  // Si la cantidad supera las existencias, solo se permite disminuir.
  if (line.issue === 'exceeds') increase.disabled = true;

  const remove = h(
    'button',
    {
      type: 'button',
      class: 'icon-button icon-button--sm icon-button--danger',
      'aria-label': `Eliminar ${name} del carrito`,
      onClick: () => {
        removeFromCart(line.key);
        showToast(`${name} se eliminó del carrito.`, { type: 'info' });
      },
    },
    icon('trash', { size: 18 }),
  );

  return h(
    'li',
    { class: ['cart-item', line.issue && 'has-issue'] },
    h(detailUrl ? 'a' : 'div', { class: 'cart-item__media', href: detailUrl, tabindex: detailUrl ? '-1' : null, 'aria-hidden': 'true' }, productImage({ src: product?.images?.[0], alt: '', width: 200 })),
    h(
      'div',
      { class: 'cart-item__info' },
      h('h2', { class: 'cart-item__name' }, detailUrl ? h('a', { href: detailUrl, text: name }) : name),
      h(
        'p',
        { class: 'cart-item__meta' },
        h('span', { text: `Talla: ${line.size}` }),
        h('span', { text: `Color: ${line.color}` }),
      ),
      product &&
        h(
          'p',
          { class: 'cart-item__unit' },
          h('span', { text: `${formatMoney(line.unitPrice)} c/u` }),
          line.compareAtPrice > line.unitPrice && h('s', { class: 'price__old', text: formatMoney(line.compareAtPrice) }),
        ),
      line.issue && h('p', { class: 'alert alert--warning cart-item__issue', role: 'status' }, icon('alert', { size: 16 }), h('span', { text: line.issueMessage })),
    ),
    h('div', { class: 'cart-item__qty' }, line.issue === 'unavailable' ? h('span', { class: 'badge badge--danger', text: 'No disponible' }) : stepper.element),
    h('p', { class: 'cart-item__total' }, h('span', { class: 'sr-only', text: 'Subtotal: ' }), line.issue === 'unavailable' ? '—' : formatMoney(line.lineTotal)),
    h('div', { class: 'cart-item__remove' }, remove),
  );
}

function freeShippingNotice(subtotal) {
  if (!shippingMethod) return null;
  const missing = shippingMethod.freeFrom - subtotal;
  const progress = Math.min(100, Math.round((subtotal / shippingMethod.freeFrom) * 100));
  return h(
    'div',
    { class: 'free-shipping' },
    h(
      'p',
      { class: 'free-shipping__text' },
      icon('truck', { size: 18 }),
      missing > 0 ? `Te faltan ${formatMoney(missing)} para obtener envío gratis.` : '¡Tu pedido tiene envío gratis a domicilio!',
    ),
    h('div', { class: 'free-shipping__bar', role: 'progressbar', 'aria-label': 'Progreso hacia el envío gratis', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress) }, h('span', { style: { width: `${progress}%` } })),
  );
}

async function handleClear() {
  const confirmed = await confirmDialog({
    title: '¿Vaciar el carrito?',
    message: 'Se eliminarán todos los productos de tu carrito. Esta acción no se puede deshacer.',
    confirmLabel: 'Vaciar carrito',
  });
  if (!confirmed) return;
  clearCart();
  showToast('Tu carrito está vacío.', { type: 'info' });
}

async function render() {
  const focusKey = document.activeElement?.dataset?.focusKey;
  try {
    const { lines, totals, hasIssues } = await getCartDetails();
    root.removeAttribute('aria-busy');

    if (!lines.length) {
      subtitle.textContent = 'No tienes productos en tu carrito.';
      mount(
        root,
        emptyState({
          icon: 'bag',
          title: 'Tu carrito está vacío',
          message: 'Explora el catálogo y agrega las prendas que más te gusten.',
          actions: [
            { label: 'Ir al catálogo', href: routeUrl('catalog') },
            { label: 'Ver ofertas', href: routeUrl('catalog', { ofertas: 1, orden: 'descuento' }), variant: 'btn--outline' },
          ],
        }),
      );
      return;
    }

    subtitle.textContent = `${pluralize(totals.itemCount, 'artículo')} en tu carrito`;

    const checkoutButton = hasIssues
      ? h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block', disabled: true, text: 'Generar pedido' })
      : h('a', { class: 'btn btn--primary btn--lg btn--block', href: routeUrl('checkout') }, 'Generar pedido', icon('arrowRight', { size: 18 }));

    mount(
      root,
      h(
        'div',
        { class: 'cart-layout' },
        h(
          'section',
          { class: 'cart-main', 'aria-label': 'Productos en el carrito' },
          h(
            'div',
            { class: 'cart-head', 'aria-hidden': 'true' },
            h('span', { text: 'Producto' }),
            h('span', { text: 'Cantidad' }),
            h('span', { text: 'Subtotal' }),
            h('span'),
          ),
          h('ul', { class: 'cart-list' }, lines.map(lineItem)),
          h(
            'div',
            { class: 'cart-actions' },
            h('a', { class: 'btn btn--ghost', href: routeUrl('catalog') }, icon('arrowLeft', { size: 18 }), 'Seguir comprando'),
            h('button', { type: 'button', class: 'btn btn--danger-outline btn--sm', onClick: handleClear }, icon('trash', { size: 16 }), 'Vaciar carrito'),
          ),
        ),
        h(
          'aside',
          { class: 'cart-summary card', 'aria-labelledby': 'summary-title' },
          h('h2', { class: 'card__title', id: 'summary-title', text: 'Resumen' }),
          totalsList(totals),
          h('p', { class: 'cart-summary__note', text: 'El costo de entrega se calcula al elegir el método en el siguiente paso.' }),
          freeShippingNotice(totals.subtotal),
          hasIssues && h('p', { class: 'alert alert--warning', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: 'Ajusta o elimina los productos marcados para continuar.' })),
          checkoutButton,
          h(
            'p',
            { class: 'cart-summary__secure' },
            icon('shield', { size: 16 }),
            `Sin cobros en línea. Recoge en tienda gratis${shippingMethod ? ` o recibe en casa (envío gratis desde ${formatMoneyShort(shippingMethod.freeFrom)})` : ''}.`,
          ),
        ),
      ),
    );

    if (focusKey) root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
  } catch (error) {
    mount(root, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

mount(root, loadingState('Cargando tu carrito…'));
render();
onDataChanged(['cart', 'products'], render);
