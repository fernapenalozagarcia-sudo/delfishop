import { h } from '../utils/dom.js';
import { assetUrl } from '../router.js';

const PLACEHOLDER = assetUrl('images/placeholder-product.svg');

/** Ajusta el ancho solicitado para imágenes de Unsplash; deja otras URLs intactas. */
export function resizeImage(src, width) {
  if (!src || !src.startsWith('https://images.unsplash.com/')) return src;
  const url = new URL(src);
  const ratio = Number(url.searchParams.get('h')) / Number(url.searchParams.get('w')) || 1.25;
  url.searchParams.set('w', String(width));
  url.searchParams.set('h', String(Math.round(width * ratio)));
  return url.href;
}

/**
 * Imagen de producto con carga diferida y respaldo local si la URL falla.
 * @param {{src: string, alt: string, width?: number, className?: string, eager?: boolean}} options
 */
export function productImage({ src, alt, width = 600, className = '', eager = false }) {
  const img = h('img', {
    class: className,
    src: resizeImage(src, width) || PLACEHOLDER,
    alt,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    width,
    height: Math.round(width * 1.25),
  });
  img.addEventListener(
    'error',
    () => {
      img.src = PLACEHOLDER;
      img.classList.add('is-fallback');
    },
    { once: true },
  );
  return img;
}
