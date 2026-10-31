import { h, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { routeUrl, buildUrl } from '../router.js';
import { CONFIG } from '../config.js';
import { CATEGORIES } from '../data/categories.js';
import { buildWhatsAppUrl } from '../utils/whatsapp.js';

function column(title, links) {
  return h(
    'div',
    { class: 'site-footer__col' },
    h('h2', { class: 'site-footer__title', text: title }),
    h('ul', { class: 'site-footer__list' }, links.map((link) => h('li', {}, link))),
  );
}

const link = (label, href, extra = {}) => h('a', { href, text: label, ...extra });

export function renderFooter(container) {
  const year = new Date().getFullYear();
  const external = { target: '_blank', rel: 'noopener noreferrer' };

  mount(
    container,
    h(
      'footer',
      { class: 'site-footer' },
      h(
        'div',
        { class: 'container site-footer__grid' },
        h(
          'div',
          { class: 'site-footer__brand' },
          h('p', { class: 'site-footer__logo', text: CONFIG.store.name }),
          h('p', { class: 'site-footer__about', text: 'Prendas bien hechas para caballero, dama, niños y bebés. Diseño atemporal, materiales cómodos y precios justos.' }),
          h(
            'ul',
            { class: 'social-links', 'aria-label': 'Redes sociales' },
            CONFIG.social.map((s) =>
              h('li', {}, h('a', { class: 'icon-button', href: s.url, 'aria-label': `${s.label} (se abre en una pestaña nueva)`, ...external }, icon(s.id, { size: 18 }))),
            ),
            h(
              'li',
              {},
              h('a', { class: 'icon-button', href: buildWhatsAppUrl(`¡Hola, ${CONFIG.store.name}! Tengo una pregunta.`), 'aria-label': 'WhatsApp (se abre en una pestaña nueva)', ...external }, icon('whatsapp', { size: 18 })),
            ),
          ),
        ),
        column('Comprar', [
          ...CATEGORIES.map((c) => link(c.name, routeUrl('catalog', { categoria: c.id }))),
          link('Ofertas', routeUrl('catalog', { ofertas: 1, orden: 'descuento' })),
        ]),
        column('Ayuda', [
          link('Cómo comprar', buildUrl('index.html#como-comprar')),
          link('Envíos y entregas', buildUrl('index.html#como-comprar')),
          link('Mi carrito', routeUrl('cart')),
          link('Catálogo completo', routeUrl('catalog')),
        ]),
        h(
          'div',
          { class: 'site-footer__col' },
          h('h2', { class: 'site-footer__title', text: 'Contacto' }),
          h(
            'ul',
            { class: 'site-footer__list site-footer__contact' },
            h('li', {}, icon('mail', { size: 16 }), link(CONFIG.store.email, `mailto:${CONFIG.store.email}`)),
            h('li', {}, icon('whatsapp', { size: 16 }), link('Escríbenos por WhatsApp', buildWhatsAppUrl(`¡Hola, ${CONFIG.store.name}!`), external)),
            h('li', {}, icon('mapPin', { size: 16 }), h('span', { text: CONFIG.store.address })),
            h('li', {}, icon('clock', { size: 16 }), h('span', { text: CONFIG.store.schedule })),
          ),
        ),
      ),
      h(
        'div',
        { class: 'site-footer__bottom' },
        h(
          'div',
          { class: 'container site-footer__bottom-inner' },
          h('p', { text: `© ${year} ${CONFIG.store.name}. Todos los derechos reservados.` }),
          h('p', { class: 'site-footer__demo', text: 'Sitio de demostración: los pedidos se guardan solo en este navegador y no se realizan cobros.' }),
        ),
      ),
    ),
  );
}
