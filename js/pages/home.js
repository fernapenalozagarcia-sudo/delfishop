import { initStorefront } from '../app.js';
import { h, mount } from '../utils/dom.js';
import { routeUrl } from '../router.js';
import { pluralize } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import { productGrid } from '../components/productCard.js';
import { productImage } from '../components/productImage.js';
import { emptyState, errorState } from '../components/states.js';
import { getCategories, getFeaturedProducts, getNewProducts, getProducts, getSaleProducts } from '../services/productService.js';
import { onDataChanged } from '../utils/events.js';

initStorefront({ active: 'inicio' });

async function renderCategories() {
  const container = document.getElementById('category-grid');
  try {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    mount(
      container,
      categories.map((category) => {
        const count = products.filter((p) => p.category === category.id).length;
        return h(
          'a',
          { class: 'category-tile', href: routeUrl('catalog', { categoria: category.id }) },
          productImage({ src: category.image, alt: '', width: 480, className: 'category-tile__image' }),
          h(
            'span',
            { class: 'category-tile__content' },
            h('span', { class: 'category-tile__name', text: category.name }),
            h('span', { class: 'category-tile__count', text: pluralize(count, 'producto') }),
          ),
        );
      }),
    );
  } catch (error) {
    mount(container, errorState({ message: getErrorMessage(error), onRetry: renderCategories }));
  } finally {
    container.removeAttribute('aria-busy');
  }
}

async function renderProductSection(containerId, loader, emptyMessage) {
  const container = document.getElementById(containerId);
  try {
    const products = await loader();
    if (!products.length) {
      mount(container, emptyState({ icon: 'shirt', title: 'Muy pronto', message: emptyMessage, actions: [{ label: 'Ver catálogo', href: routeUrl('catalog') }] }));
      return;
    }
    mount(container, productGrid(products, { className: 'product-grid--4' }));
  } catch (error) {
    mount(container, errorState({ message: getErrorMessage(error), onRetry: () => renderProductSection(containerId, loader, emptyMessage) }));
  }
}

function renderSkeletons() {
  for (const container of document.querySelectorAll('[data-skeleton]')) {
    const count = Number(container.dataset.skeleton);
    mount(container, h('div', { class: 'product-grid product-grid--4', 'aria-hidden': 'true' }, Array.from({ length: count }, () => h('div', { class: 'skeleton skeleton--card' }))));
  }
}

function renderAll() {
  renderCategories();
  renderProductSection('featured-products', () => getFeaturedProducts(8), 'Pronto tendremos nuevos productos destacados.');
  renderProductSection('new-products', () => getNewProducts(4), 'Pronto llegarán nuevos lanzamientos.');
  renderProductSection('sale-products', () => getSaleProducts(4), 'En este momento no hay ofertas activas.');
}

renderSkeletons();
renderAll();
onDataChanged(['products'], renderAll);
