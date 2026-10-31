const unsplash = (id, w = 900, h = 1100) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const SUBCATEGORIES = Object.freeze({
  camisetas: 'Camisetas',
  camisas: 'Camisas y blusas',
  sudaderas: 'Sudaderas',
  chamarras: 'Chamarras y abrigos',
  pantalones: 'Pantalones',
  vestidos: 'Vestidos',
  faldas: 'Faldas',
  conjuntos: 'Conjuntos',
  bodies: 'Bodies y mamelucos',
  zapatos: 'Zapatos',
  accesorios: 'Accesorios',
});

export const CATEGORIES = Object.freeze([
  {
    id: 'caballero',
    name: 'Caballero',
    description: 'Básicos impecables, sastrería relajada y capas para cada temporada.',
    image: unsplash('1487222477894-8943e31ef7b2', 800, 1000),
    subcategories: ['camisetas', 'camisas', 'sudaderas', 'chamarras', 'pantalones', 'zapatos', 'accesorios'],
  },
  {
    id: 'dama',
    name: 'Dama',
    description: 'Vestidos, denim y prendas versátiles para tu día a día.',
    image: unsplash('1539008835657-9e8e9680c956', 800, 1000),
    subcategories: ['vestidos', 'camisas', 'sudaderas', 'chamarras', 'pantalones', 'faldas', 'zapatos', 'accesorios'],
  },
  {
    id: 'nino',
    name: 'Niño',
    description: 'Ropa cómoda y resistente para jugar sin límites.',
    image: unsplash('1514090458221-65bb69cf63e6', 800, 1000),
    subcategories: ['camisetas', 'conjuntos', 'chamarras', 'pantalones'],
  },
  {
    id: 'nina',
    name: 'Niña',
    description: 'Vestidos, mezclilla y colores que acompañan cada aventura.',
    image: unsplash('1518831959646-742c3a14ebf7', 800, 1000),
    subcategories: ['vestidos', 'conjuntos', 'sudaderas', 'chamarras'],
  },
  {
    id: 'bebe',
    name: 'Bebé',
    description: 'Algodón suave y prendas prácticas para sus primeros meses.',
    image: unsplash('1546015720-b8b30df5aa27', 800, 1000),
    subcategories: ['bodies', 'conjuntos', 'camisetas', 'accesorios'],
  },
]);

export function getCategoryName(id) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? 'Sin categoría';
}

export function getSubcategoryName(id) {
  return SUBCATEGORIES[id] ?? id ?? '';
}

export { unsplash };
