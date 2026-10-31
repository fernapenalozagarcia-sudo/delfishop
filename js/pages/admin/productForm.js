import { initAdmin, setFlashMessage } from '../../components/adminLayout.js';
import { createProductCard } from '../../components/productCard.js';
import { emptyState, errorState, loadingState } from '../../components/states.js';
import { showToast } from '../../components/toast.js';
import { debounce, h, mount, showFieldErrors } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { getErrorMessage, ValidationError } from '../../utils/errors.js';
import { getQueryParams, routeUrl } from '../../router.js';
import { CONFIG } from '../../config.js';
import { CATEGORIES, getSubcategoryName } from '../../data/categories.js';
import { MAX_IMAGES, normalizeProductInput, validateProduct } from '../../domain/productValidation.js';
import { createProduct, getProductById, getProducts, updateProduct } from '../../services/productService.js';

initAdmin({ active: 'productos' });

const root = document.getElementById('form-root');
const productId = getQueryParams().get('id');
const MAX_FILE_BYTES = 400 * 1024;

const SIZE_PRESETS = [
  { label: 'Dama', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { label: 'Caballero', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Infantil', sizes: ['4', '6', '8', '10', '12'] },
  { label: 'Bebé', sizes: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M'] },
  { label: 'Calzado', sizes: ['22', '23', '24', '25', '26', '27', '28', '29'] },
  { label: 'Unitalla', sizes: ['Unitalla'] },
];

const SKU_PREFIX = { caballero: 'CAB', dama: 'DAM', nino: 'NIN', nina: 'NNA', bebe: 'BEB' };

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  price: '',
  compareAtPrice: null,
  category: '',
  subcategory: '',
  images: [],
  sku: '',
  sizes: [],
  colors: [{ name: '', hex: '#1d1d1f' }],
  stock: 0,
  minStock: CONFIG.inventory.defaultMinStock,
  published: true,
  featured: false,
  isNew: true,
};

function fieldWrap({ name, label, control, hint, optional, full, required }) {
  const id = control.id || `pf-${name}`;
  control.id = id;
  return h(
    'div',
    { class: ['field', full && 'field--full'] },
    h('label', { class: 'field__label', for: id }, label, optional && h('span', { class: 'field__optional', text: ' (opcional)' }), required && h('span', { 'aria-hidden': 'true', text: ' *' })),
    control,
    hint && h('p', { class: 'field__hint', text: hint }),
    h('p', { class: 'field__error', id: `${id}-error`, 'data-error-for': name, hidden: true }),
  );
}

function section(title, description, ...content) {
  return h(
    'section',
    { class: 'card form-section' },
    h('div', { class: 'form-section__header' }, h('h2', { class: 'card__title', text: title }), description && h('p', { class: 'field__hint', text: description })),
    content,
  );
}

function renderForm(product, allProducts) {
  const isEdit = Boolean(product.id);

  const input = (name, attrs = {}) => h('input', { name, class: 'input', ...attrs });

  // ---------- Información básica ----------
  const nameInput = input('name', { type: 'text', maxlength: '80', required: true, value: product.name });
  const description = h('textarea', { name: 'description', class: 'textarea', rows: '5', maxlength: '1200', required: true });
  description.value = product.description;

  const subcategorySelect = h('select', { name: 'subcategory', class: 'select', required: true });
  const fillSubcategories = (categoryId, selected = '') => {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    mount(
      subcategorySelect,
      h('option', { value: '', text: category ? 'Selecciona una subcategoría' : 'Primero elige una categoría' }),
      (category?.subcategories ?? []).map((s) => h('option', { value: s, text: getSubcategoryName(s), selected: s === selected })),
    );
    subcategorySelect.disabled = !category;
  };
  const categorySelect = h(
    'select',
    { name: 'category', class: 'select', required: true, onChange: (e) => fillSubcategories(e.target.value) },
    h('option', { value: '', text: 'Selecciona una categoría' }),
    CATEGORIES.map((c) => h('option', { value: c.id, text: c.name, selected: c.id === product.category })),
  );
  fillSubcategories(product.category, product.subcategory);

  // ---------- Precio ----------
  const priceInput = input('price', { type: 'number', min: '0', step: '0.01', inputmode: 'decimal', required: true, value: product.price });
  const compareInput = input('compareAtPrice', { type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: product.compareAtPrice ?? '' });

  // ---------- Imágenes ----------
  const imageInputs = [];
  const imageList = h('div', { class: 'image-slots' });
  for (let i = 0; i < MAX_IMAGES; i += 1) {
    const preview = h('div', { class: 'image-slot__preview' });
    const urlInput = h('input', { type: 'url', class: 'input input--sm', id: `pf-image-${i}`, placeholder: 'https://…', 'aria-label': `URL de la imagen ${i + 1}`, value: product.images[i] ?? '' });
    const updatePreview = () => {
      const src = urlInput.value.trim();
      if (!src) {
        mount(preview, icon('image', { size: 22 }));
        return;
      }
      const img = h('img', { src, alt: `Vista previa de la imagen ${i + 1}` });
      img.addEventListener('error', () => mount(preview, h('span', { class: 'field__error', text: 'No carga' })), { once: true });
      mount(preview, img);
    };
    urlInput.addEventListener('input', debounce(updatePreview, 300));
    updatePreview();
    const clear = h('button', {
      type: 'button',
      class: 'icon-button icon-button--sm',
      'aria-label': `Quitar imagen ${i + 1}`,
      onClick: () => {
        urlInput.value = '';
        updatePreview();
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      },
    }, icon('x', { size: 16 }));
    imageInputs.push({ urlInput, updatePreview });
    imageList.append(h('div', { class: 'image-slot' }, preview, h('div', { class: 'image-slot__fields' }, h('span', { class: 'field__hint', text: i === 0 ? 'Imagen principal' : `Imagen ${i + 1}` }), h('div', { class: 'image-slot__row' }, urlInput, clear))));
  }
  const fileInput = h('input', { type: 'file', id: 'pf-file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      showToast('Formato no admitido. Usa PNG, JPG o WEBP.', { type: 'error' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast('La imagen supera 400 KB. Usa una URL o una imagen más ligera (localStorage tiene espacio limitado).', { type: 'error' });
      return;
    }
    const slot = imageInputs.find((s) => !s.urlInput.value.trim());
    if (!slot) {
      showToast(`Solo se permiten ${MAX_IMAGES} imágenes.`, { type: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      slot.urlInput.value = String(reader.result);
      slot.updatePreview();
      slot.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    reader.readAsDataURL(file);
  });

  // ---------- Variantes ----------
  const sizesInput = input('sizes', { type: 'text', value: product.sizes.join(', '), placeholder: 'Ej. S, M, L, XL', 'aria-describedby': 'pf-sizes-hint' });
  const presetButtons = h(
    'div',
    { class: 'chip-list' },
    SIZE_PRESETS.map((preset) =>
      h('button', {
        type: 'button',
        class: 'chip',
        text: preset.label,
        onClick: () => {
          sizesInput.value = preset.sizes.join(', ');
          sizesInput.dispatchEvent(new Event('input', { bubbles: true }));
        },
      }),
    ),
  );

  const colorRows = h('div', { class: 'color-rows' });
  const addColorRow = (color = { name: '', hex: '#1d1d1f' }) => {
    const index = colorRows.children.length;
    const row = h(
      'div',
      { class: 'color-row' },
      h('input', { type: 'color', class: 'color-row__picker', value: color.hex, 'aria-label': `Tono del color ${index + 1}` }),
      h('input', { type: 'text', class: 'input input--sm', value: color.name, maxlength: '30', placeholder: 'Nombre del color', 'aria-label': `Nombre del color ${index + 1}` }),
      h('button', {
        type: 'button',
        class: 'icon-button icon-button--sm icon-button--danger',
        'aria-label': `Quitar color ${index + 1}`,
        onClick: () => {
          row.remove();
          form.dispatchEvent(new Event('input'));
        },
      }, icon('trash', { size: 16 })),
    );
    colorRows.append(row);
    return row;
  };
  (product.colors.length ? product.colors : [{ name: '', hex: '#1d1d1f' }]).forEach((c) => addColorRow(c));

  // ---------- Inventario ----------
  const skuInput = input('sku', { type: 'text', maxlength: '24', required: true, value: product.sku, autocomplete: 'off', style: { 'text-transform': 'uppercase' } });
  const generateSku = h('button', {
    type: 'button',
    class: 'btn btn--outline btn--sm',
    text: 'Generar',
    onClick: () => {
      const prefix = `${SKU_PREFIX[categorySelect.value] ?? 'GEN'}-${(subcategorySelect.value || 'gen').slice(0, 3).toUpperCase()}-`;
      const used = allProducts.filter((p) => p.sku.startsWith(prefix) && p.id !== product.id).map((p) => Number(p.sku.slice(prefix.length)) || 0);
      skuInput.value = `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
      skuInput.dispatchEvent(new Event('input', { bubbles: true }));
    },
  });
  const stockInput = input('stock', { type: 'number', min: '0', step: '1', inputmode: 'numeric', required: true, value: product.stock });
  const minStockInput = input('minStock', { type: 'number', min: '0', step: '1', inputmode: 'numeric', required: true, value: product.minStock });

  // ---------- Publicación ----------
  const toggle = (name, label, hint, checked) =>
    h(
      'label',
      { class: 'checkbox checkbox--card', for: `pf-${name}` },
      h('input', { type: 'checkbox', id: `pf-${name}`, name, checked }),
      h('span', {}, h('span', { class: 'checkbox__title', text: label }), h('span', { class: 'field__hint', text: hint })),
    );

  const formAlert = h('div', { class: 'form-message', 'aria-live': 'assertive' });
  const preview = h('div', { class: 'product-preview', inert: true });
  const submit = h('button', { type: 'submit', class: 'btn btn--primary' }, icon('check', { size: 18 }), isEdit ? 'Guardar cambios' : 'Registrar producto');

  const form = h(
    'form',
    { class: 'product-admin-form', novalidate: true },
    h(
      'div',
      { class: 'product-admin-form__main' },
      section(
        'Información básica',
        null,
        h(
          'div',
          { class: 'form-grid' },
          fieldWrap({ name: 'name', label: 'Nombre', control: nameInput, full: true, required: true }),
          fieldWrap({ name: 'description', label: 'Descripción', control: description, full: true, required: true, hint: 'Mínimo 20 caracteres. Describe materiales, corte y uso.' }),
          fieldWrap({ name: 'category', label: 'Categoría', control: categorySelect, required: true }),
          fieldWrap({ name: 'subcategory', label: 'Subcategoría', control: subcategorySelect, required: true }),
        ),
      ),
      section(
        'Precio',
        'Si indicas un precio anterior mayor al actual, el producto se mostrará en oferta.',
        h(
          'div',
          { class: 'form-grid' },
          fieldWrap({ name: 'price', label: 'Precio (MXN)', control: priceInput, required: true }),
          fieldWrap({ name: 'compareAtPrice', label: 'Precio anterior (MXN)', control: compareInput, optional: true }),
        ),
      ),
      section(
        'Imágenes',
        `Hasta ${MAX_IMAGES} imágenes por URL (https) o archivos PNG/JPG/WEBP de máximo 400 KB.`,
        imageList,
        h('div', { class: 'image-upload' }, h('label', { class: 'btn btn--outline btn--sm', for: 'pf-file' }, icon('image', { size: 16 }), 'Subir imagen desde el equipo'), fileInput),
        h('p', { class: 'field__error', id: 'pf-images-error', 'data-error-for': 'images', hidden: true }),
      ),
      section(
        'Tallas y colores',
        null,
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field__label', for: 'pf-sizes' }, 'Tallas disponibles', h('span', { 'aria-hidden': 'true', text: ' *' })),
          sizesInput,
          h('p', { class: 'field__hint', id: 'pf-sizes-hint', text: 'Sepáralas con comas. Atajos:' }),
          presetButtons,
          h('p', { class: 'field__error', id: 'pf-sizes-error', 'data-error-for': 'sizes', hidden: true }),
        ),
        h(
          'fieldset',
          { class: 'field' },
          h('legend', { class: 'field__label' }, 'Colores disponibles', h('span', { 'aria-hidden': 'true', text: ' *' })),
          colorRows,
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm color-rows__add', onClick: () => addColorRow().querySelector('input[type=text]').focus() }, icon('plus', { size: 16 }), 'Agregar color'),
          h('p', { class: 'field__error', id: 'pf-colors-error', 'data-error-for': 'colors', hidden: true }),
        ),
      ),
      section(
        'Inventario',
        null,
        h(
          'div',
          { class: 'form-grid form-grid--3' },
          h(
            'div',
            { class: 'field' },
            h('label', { class: 'field__label', for: 'pf-sku' }, 'SKU o código', h('span', { 'aria-hidden': 'true', text: ' *' })),
            h('div', { class: 'input-with-action' }, skuInput, generateSku),
            h('p', { class: 'field__error', id: 'pf-sku-error', 'data-error-for': 'sku', hidden: true }),
          ),
          fieldWrap({ name: 'stock', label: 'Cantidad en inventario', control: stockInput, required: true }),
          fieldWrap({ name: 'minStock', label: 'Nivel mínimo', control: minStockInput, required: true }),
        ),
      ),
    ),
    h(
      'aside',
      { class: 'product-admin-form__side' },
      section(
        'Publicación',
        null,
        h(
          'div',
          { class: 'toggle-list' },
          toggle('published', 'Publicado en la tienda', 'Visible para los clientes en el catálogo.', product.published),
          toggle('featured', 'Producto destacado', 'Aparece en la sección de destacados del inicio.', product.featured),
          toggle('isNew', 'Novedad', 'Se muestra con la etiqueta «Nuevo».', product.isNew),
        ),
      ),
      h('section', { class: 'card form-section', 'aria-label': 'Vista previa' }, h('h2', { class: 'card__title', text: 'Vista previa' }), preview),
      h(
        'div',
        { class: 'form-actions' },
        formAlert,
        submit,
        h('a', { class: 'btn btn--ghost', href: routeUrl('adminProducts') }, 'Cancelar'),
      ),
    ),
  );
  skuInput.id = 'pf-sku';
  sizesInput.id = 'pf-sizes';

  function collect() {
    return {
      name: nameInput.value,
      description: description.value,
      price: priceInput.value,
      compareAtPrice: compareInput.value,
      category: categorySelect.value,
      subcategory: subcategorySelect.value,
      images: imageInputs.map((s) => s.urlInput.value.trim()).filter(Boolean),
      sku: skuInput.value,
      sizes: sizesInput.value.split(','),
      colors: [...colorRows.children].map((row) => ({ hex: row.querySelector('input[type=color]').value, name: row.querySelector('input[type=text]').value })),
      stock: stockInput.value,
      minStock: minStockInput.value,
      published: form.elements.namedItem('published').checked,
      featured: form.elements.namedItem('featured').checked,
      isNew: form.elements.namedItem('isNew').checked,
    };
  }

  const refreshPreview = debounce(() => {
    const data = normalizeProductInput(collect());
    const previewProduct = {
      ...data,
      id: product.id ?? 'vista-previa',
      name: data.name || 'Nombre del producto',
      price: Number.isFinite(data.price) ? data.price : 0,
      compareAtPrice: data.compareAtPrice,
      stock: Number.isFinite(data.stock) ? data.stock : 0,
      minStock: Number.isFinite(data.minStock) ? data.minStock : 0,
      category: data.category || 'dama',
      subcategory: data.subcategory || '',
      sizes: data.sizes.length ? data.sizes : ['Talla'],
      colors: data.colors.length ? data.colors : [{ name: 'Color', hex: '#cccccc' }],
      images: data.images,
    };
    mount(preview, createProductCard(previewProduct));
  }, 250);
  form.addEventListener('input', refreshPreview);
  form.addEventListener('change', refreshPreview);
  refreshPreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formAlert.replaceChildren();
    const data = collect();
    const errors = validateProduct(normalizeProductInput(data), {
      existingSkus: allProducts.filter((p) => p.id !== product.id).map((p) => p.sku),
    });
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      if (errors.images) imageInputs[0].urlInput.focus();
      else if (errors.colors) colorRows.querySelector('input[type=text]')?.focus();
      else if (errors.sku) skuInput.focus();
      else if (errors.sizes) sizesInput.focus();
      mount(formAlert, h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: `Revisa ${Object.keys(errors).length === 1 ? 'el campo marcado' : 'los campos marcados'} antes de guardar.` })));
      return;
    }

    submit.disabled = true;
    submit.classList.add('is-loading');
    try {
      const saved = isEdit ? await updateProduct(product.id, data) : await createProduct(data);
      setFlashMessage(isEdit ? `Se guardaron los cambios de «${saved.name}».` : `«${saved.name}» se registró correctamente.`);
      window.location.assign(routeUrl('adminProducts'));
    } catch (error) {
      submit.disabled = false;
      submit.classList.remove('is-loading');
      if (error instanceof ValidationError) showFieldErrors(form, error.fieldErrors);
      mount(formAlert, h('p', { class: 'alert alert--danger', role: 'alert' }, icon('alert', { size: 18 }), h('span', { text: getErrorMessage(error) })));
    }
  });

  mount(root, form);
}

async function init() {
  try {
    const allProducts = await getProducts({ includeUnpublished: true });
    root.removeAttribute('aria-busy');
    if (!productId) {
      renderForm({ ...EMPTY_PRODUCT, colors: EMPTY_PRODUCT.colors.map((c) => ({ ...c })) }, allProducts);
      return;
    }
    const product = await getProductById(productId, { includeUnpublished: true });
    if (!product) {
      document.getElementById('form-title').textContent = 'Producto no encontrado';
      mount(root, emptyState({ icon: 'shirt', title: 'Este producto no existe', message: 'Pudo haber sido eliminado.', actions: [{ label: 'Volver a productos', href: routeUrl('adminProducts') }] }));
      return;
    }
    document.getElementById('form-title').textContent = 'Editar producto';
    document.getElementById('form-crumb').textContent = product.name;
    document.getElementById('form-subtitle').textContent = `${product.sku} · Los cambios se reflejan de inmediato en la tienda.`;
    document.title = `Editar ${product.name} · Administración OLMO`;
    renderForm(product, allProducts);
  } catch (error) {
    mount(root, errorState({ message: getErrorMessage(error), onRetry: init }));
  }
}

mount(root, loadingState('Cargando formulario…'));
init();
