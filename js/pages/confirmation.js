import { initStorefront } from '../app.js';
import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatDateTime } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import { getQueryParams, routeUrl } from '../router.js';
import { getOrderById } from '../services/orderService.js';
import { buildOrderWhatsAppUrl } from '../utils/whatsapp.js';
import { itemsMiniList, totalsList } from '../components/orderSummary.js';
import { orderStatusBadge } from '../components/badges.js';
import { whatsappButton, whatsappDemoNotice } from '../components/productCard.js';
import { emptyState, errorState, loadingState } from '../components/states.js';
import { showToast } from '../components/toast.js';

initStorefront({ active: 'confirmacion' });

const root = document.getElementById('confirmation-root');

function addressText(address) {
  if (!address) return null;
  return [address.street, address.neighborhood, `${address.city}, ${address.state}`, `C.P. ${address.postalCode}`, address.references && `Ref.: ${address.references}`]
    .filter(Boolean)
    .join(' · ');
}

async function copyOrderNumber(orderId) {
  try {
    await navigator.clipboard.writeText(orderId);
    showToast('Número de pedido copiado.', { type: 'success' });
  } catch {
    showToast(`Tu número de pedido es ${orderId}.`, { type: 'info' });
  }
}

async function render() {
  const orderId = getQueryParams().get('id') ?? '';
  try {
    const order = orderId ? await getOrderById(orderId) : null;
    root.removeAttribute('aria-busy');
    if (!order) {
      mount(
        root,
        emptyState({
          icon: 'clipboard',
          headingLevel: 1,
          title: 'No encontramos este pedido',
          message: 'El enlace no es válido o el pedido se registró en otro navegador. Los pedidos de la demostración solo se guardan localmente.',
          actions: [{ label: 'Ir a la tienda', href: routeUrl('home') }],
        }),
      );
      return;
    }

    const firstName = order.customer.name.split(' ')[0];
    const waButton = whatsappButton({ href: buildOrderWhatsAppUrl(order), label: 'Enviar pedido por WhatsApp' });

    mount(
      root,
      h(
        'section',
        { class: 'confirmation', 'aria-labelledby': 'confirmation-title' },
        h('span', { class: 'confirmation__icon' }, icon('checkCircle', { size: 36 })),
        h('p', { class: 'eyebrow', text: 'Pedido registrado' }),
        h('h1', { class: 'page-title', id: 'confirmation-title', text: `¡Gracias, ${firstName}! Recibimos tu pedido` }),
        h(
          'div',
          { class: 'confirmation__number' },
          h('span', { class: 'confirmation__label', text: 'Número de pedido' }),
          h('strong', { class: 'confirmation__id', text: order.id }),
          h('button', { type: 'button', class: 'btn btn--outline btn--sm', onClick: () => copyOrderNumber(order.id) }, 'Copiar'),
        ),
        h('p', { class: 'confirmation__status' }, 'Estado actual: ', orderStatusBadge(order.status)),
        h(
          'p',
          { class: 'alert alert--info confirmation__notice' },
          icon('info', { size: 18 }),
          h('span', { text: 'Tu pedido aún no es una compra confirmada. Te contactaremos al teléfono indicado para confirmar disponibilidad, forma de pago y entrega. No se realizó ningún cobro.' }),
        ),
      ),
      h(
        'div',
        { class: 'confirmation-grid' },
        h(
          'section',
          { class: 'card', 'aria-labelledby': 'conf-items-title' },
          h('h2', { class: 'card__title', id: 'conf-items-title', text: 'Resumen del pedido' }),
          itemsMiniList(order.items),
          h('hr', { class: 'divider' }),
          totalsList(order.totals),
        ),
        h(
          'section',
          { class: 'card', 'aria-labelledby': 'conf-delivery-title' },
          h('h2', { class: 'card__title', id: 'conf-delivery-title', text: 'Entrega y contacto' }),
          h(
            'dl',
            { class: 'detail-list' },
            [
              ['Fecha', formatDateTime(order.createdAt)],
              ['Cliente', order.customer.name],
              ['Teléfono', order.customer.phone],
              order.customer.email && ['Correo', order.customer.email],
              ['Entrega', order.delivery.label],
              order.delivery.address && ['Dirección', addressText(order.delivery.address)],
              order.notes && ['Notas', order.notes],
            ]
              .filter(Boolean)
              .map(([term, value]) => h('div', { class: 'detail-list__row' }, h('dt', { text: term }), h('dd', { text: value }))),
          ),
        ),
      ),
      h(
        'div',
        { class: 'confirmation__actions' },
        h('a', { class: 'btn btn--primary', href: routeUrl('catalog') }, 'Seguir comprando'),
        waButton,
      ),
      whatsappDemoNotice(),
    );
    document.title = `Pedido ${order.id} · OLMO`;
  } catch (error) {
    mount(root, errorState({ message: getErrorMessage(error), onRetry: render }));
  }
}

mount(root, loadingState('Cargando tu pedido…'));
render();
