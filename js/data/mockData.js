/**
 * Datos de demostración. Se copian a localStorage la primera vez que se abre la
 * aplicación (o al restablecer la demo) y a partir de ese momento se trabaja
 * sobre esa copia. Al integrar el backend este archivo deja de usarse.
 */
import { unsplash } from './categories.js';
import { calculateTotals, getDeliveryMethod, lineTotal } from '../domain/pricing.js';
import { getStatusFlow, ORDER_STATUS } from '../domain/orderStatus.js';
import { buildSaleRecord } from '../domain/sales.js';

const SIZES = {
  men: ['S', 'M', 'L', 'XL', 'XXL'],
  women: ['XS', 'S', 'M', 'L', 'XL'],
  kids: ['4', '6', '8', '10', '12'],
  baby: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M'],
  menShoes: ['25', '26', '27', '28', '29'],
  womenShoes: ['22', '23', '24', '25', '26'],
  menPants: ['28', '30', '32', '34', '36'],
  womenPants: ['24', '26', '28', '30', '32'],
  one: ['Unitalla'],
};

const C = {
  blanco: { name: 'Blanco', hex: '#f4f2ee' },
  negro: { name: 'Negro', hex: '#1d1d1f' },
  gris: { name: 'Gris jaspe', hex: '#9a9a9e' },
  marino: { name: 'Azul marino', hex: '#1f2a44' },
  beige: { name: 'Beige', hex: '#d8c7a8' },
  camel: { name: 'Camel', hex: '#b5835a' },
  rojo: { name: 'Rojo', hex: '#b3262e' },
  terracota: { name: 'Terracota', hex: '#c2603a' },
  olivo: { name: 'Verde olivo', hex: '#6b7240' },
  azul: { name: 'Azul', hex: '#3b6ea8' },
  indigo: { name: 'Índigo', hex: '#2c3e5c' },
  mezclilla: { name: 'Mezclilla', hex: '#4a6a8a' },
  mezclillaClaro: { name: 'Mezclilla claro', hex: '#8fb1d1' },
  rosa: { name: 'Rosa', hex: '#e8a0b4' },
  amarillo: { name: 'Amarillo', hex: '#e6b422' },
  mandarina: { name: 'Mandarina', hex: '#e07b2e' },
  cafe: { name: 'Café', hex: '#6f4e37' },
  miel: { name: 'Miel', hex: '#b07a3f' },
  ciruela: { name: 'Ciruela', hex: '#5b2a5e' },
  cobalto: { name: 'Azul cobalto', hex: '#1f4fbf' },
  dorado: { name: 'Dorado', hex: '#c9a227' },
  mostaza: { name: 'Mostaza', hex: '#d4a017' },
  crudo: { name: 'Crudo', hex: '#eee6d8' },
  arena: { name: 'Arena', hex: '#c8b49a' },
  vino: { name: 'Vino', hex: '#6d1f2f' },
};

const img = (...ids) => ids.map((id) => unsplash(id));

// [id, sku, nombre, categoría, subcategoría, precio, precioAnterior, imágenes, tallas, colores, stock, mínimo, flags, díasDesdeAlta, descripción]
const PRODUCT_ROWS = [
  ['prd-001', 'CAB-CAM-001', 'Camiseta básica de algodón pima', 'caballero', 'camisetas', 349, null,
    img('1521572163474-6864f9cf17ab', '1586790170083-2f9ceadc732d', '1529374255404-311a2a4f1fd9'), SIZES.men, [C.blanco, C.negro, C.gris], 48, 10, 'featured', 120,
    'Camiseta de corte regular confeccionada en algodón pima peinado de 180 g. Tacto suave, cuello redondo reforzado y costuras dobles que mantienen su forma lavado tras lavado. El básico que combina con todo.'],
  ['prd-002', 'CAB-CAM-002', 'Camiseta gráfica Urban', 'caballero', 'camisetas', 399, 499,
    img('1503341504253-dff4815485f1', '1618354691373-d851c5c3a990', '1583743814966-8936f5b7be1a'), SIZES.men, [C.negro, C.blanco], 4, 6, '', 60,
    'Camiseta de algodón con estampado frontal en serigrafía de alta duración. Corte ligeramente holgado, ideal para looks urbanos y casuales.'],
  ['prd-003', 'CAB-SUD-001', 'Sudadera con capucha Essential', 'caballero', 'sudaderas', 899, null,
    img('1556821840-3a63f95609a7'), SIZES.men, [C.gris, C.negro, C.marino], 22, 6, 'new', 12,
    'Sudadera de felpa perchada de 320 g con capucha forrada, bolsa canguro y puños de rib. Abrigadora, cómoda y con un ajuste moderno que no pierde la forma.'],
  ['prd-004', 'CAB-CHA-001', 'Chamarra de piel Moto', 'caballero', 'chamarras', 2899, 3499,
    img('1551028719-00167b16eac5'), ['S', 'M', 'L', 'XL'], [C.negro, C.cafe], 3, 3, 'featured', 90,
    'Chamarra estilo motociclista en piel sintética de alta calidad con forro acolchado, cierres metálicos y cuello con broche. Una pieza atemporal que eleva cualquier outfit.'],
  ['prd-005', 'CAB-CHA-002', 'Bomber ligera terracota', 'caballero', 'chamarras', 1599, null,
    img('1591047139829-d91aecb6caea'), SIZES.men, [C.terracota], 0, 4, '', 75,
    'Chamarra bomber de nylon ligero con acabado mate, puños y cintura de punto, bolsillos laterales y forro interior. Perfecta para las tardes frescas.'],
  ['prd-006', 'CAB-PAN-001', 'Jeans slim fit índigo', 'caballero', 'pantalones', 999, null,
    img('1542272604-787c3835535d', '1516826957135-700dedea698c', '1604176354204-9268737828e4'), SIZES.menPants, [C.indigo, C.negro], 31, 8, 'featured', 150,
    'Jeans de mezclilla con 2% de elastano para mayor libertad de movimiento. Corte slim, tiro medio y lavado índigo profundo que envejece de forma natural.'],
  ['prd-007', 'CAB-PAN-002', 'Pantalón chino de gabardina', 'caballero', 'pantalones', 849, 999,
    img('1473966968600-fa801b869a1a'), SIZES.menPants, [C.beige, C.marino, C.olivo], 26, 8, '', 110,
    'Pantalón chino en gabardina de algodón con acabado suave. Pretina con presillas, bolsas sesgadas y bajo ligeramente entallado: de la oficina al fin de semana.'],
  ['prd-008', 'CAB-CAM-003', 'Camisa de franela a cuadros', 'caballero', 'camisas', 749, null,
    img('1607345366928-199ea26cfe3e'), SIZES.men, [C.vino, C.olivo], 14, 5, 'new', 9,
    'Camisa de franela cepillada 100% algodón con patrón de cuadros, botones de resina y bolsillos de parche al pecho. Úsala sola o como capa ligera.'],
  ['prd-009', 'CAB-CHA-003', 'Blazer de lana azul marino', 'caballero', 'chamarras', 2499, null,
    img('1617137968427-85924c800a22', '1507679799987-c73779587ccf'), ['S', 'M', 'L', 'XL'], [C.marino], 9, 3, 'featured,new', 15,
    'Blazer de mezcla de lana con estructura ligera, solapa de muesca y forro parcial. Sastrería relajada para eventos, oficina o una cena especial.'],
  ['prd-010', 'CAB-ZAP-001', 'Tenis urbanos de piel', 'caballero', 'zapatos', 1499, 1799,
    img('1549298916-b41d501d3772'), SIZES.menShoes, [C.miel], 11, 4, '', 80,
    'Tenis de piel con acabado nobuck, plantilla acolchada removible y suela de goma antiderrapante. Comodidad para todo el día con un estilo pulido.'],
  ['prd-011', 'CAB-ZAP-002', 'Tenis blancos minimalistas', 'caballero', 'zapatos', 1299, null,
    img('1600269452121-4f2416e55c28', '1608231387042-66d1773070a5'), SIZES.menShoes, [C.blanco], 17, 4, 'new', 20,
    'Tenis de piel lisa con diseño minimalista, costuras visibles y suela vulcanizada. El par blanco que funciona con jeans, chinos o shorts.'],
  ['prd-012', 'CAB-ACC-001', 'Gorra clásica de algodón', 'caballero', 'accesorios', 299, null,
    img('1521369909029-2afed882baee', '1588850561407-ed78c282e89b'), SIZES.one, [C.gris, C.blanco], 40, 10, '', 140,
    'Gorra de seis paneles en sarga de algodón lavado, visera curva y cierre ajustable con hebilla metálica.'],
  ['prd-013', 'CAB-CHA-004', 'Chamarra utilitaria verde olivo', 'caballero', 'chamarras', 1799, 2199,
    img('1548883354-94bcfe321cbb', '1544022613-e87ca75a784a'), SIZES.men, [C.olivo], 7, 3, '', 45,
    'Chamarra estilo utilitario en lona de algodón con cuatro bolsillos frontales, cierre y botones de presión. Resistente, práctica y con mucho carácter.'],

  ['prd-014', 'DAM-VES-001', 'Vestido midi Carmesí', 'dama', 'vestidos', 1299, 1599,
    img('1595777457583-95e059d581b8', '1612336307429-8a898d10e223'), SIZES.women, [C.rojo], 12, 4, 'featured', 70,
    'Vestido midi de crepé fluido con escote en V, cintura marcada y falda con vuelo. Un rojo intenso pensado para destacar en cualquier ocasión.'],
  ['prd-015', 'DAM-VES-002', 'Vestido floral Primavera', 'dama', 'vestidos', 1099, null,
    img('1572804013309-59a88b7e92f1'), SIZES.women, [C.rojo, C.amarillo], 15, 4, 'featured,new', 6,
    'Vestido de viscosa con estampado floral, mangas cortas abullonadas y cinturón del mismo tejido. Fresco, ligero y lleno de color.'],
  ['prd-016', 'DAM-CAM-001', 'Blusa off-shoulder de lino', 'dama', 'camisas', 649, null,
    img('1609505848912-b7c3b8b4beda'), ['XS', 'S', 'M', 'L'], [C.blanco], 20, 5, '', 95,
    'Blusa de mezcla de lino con escote de hombros descubiertos y elástico suave. Transpirable y elegante para los días cálidos.'],
  ['prd-017', 'DAM-SUD-001', 'Sudadera oversize mandarina', 'dama', 'sudaderas', 799, null,
    img('1578587018452-892bacefd3f2'), ['S', 'M', 'L'], [C.mandarina], 2, 4, '', 50,
    'Sudadera de corte oversize en felpa francesa, hombros caídos y puños anchos. Un tono vibrante para tus días más relajados.'],
  ['prd-018', 'DAM-PAN-001', 'Jeans mom fit tiro alto', 'dama', 'pantalones', 949, null,
    img('1598554747436-c9293d6a588f', '1584370848010-d7fe6bc767ec'), SIZES.womenPants, [C.mezclillaClaro, C.mezclilla], 28, 6, 'featured', 100,
    'Jeans de tiro alto con pierna recta relajada y lavado claro. Mezclilla 100% algodón con estructura que estiliza la figura.'],
  ['prd-019', 'DAM-FAL-001', 'Falda plisada negra', 'dama', 'faldas', 599, null,
    img('1583496661160-fb5886a0aaaa'), ['XS', 'S', 'M', 'L'], [C.negro], 0, 4, '', 130,
    'Falda corta con pliegues permanentes, pretina elástica oculta y forro interior. Combínala con tenis o botines.'],
  ['prd-020', 'DAM-CHA-001', 'Abrigo camel de paño', 'dama', 'chamarras', 2199, 2799,
    img('1539533018447-63fcce2678e3'), ['S', 'M', 'L'], [C.camel], 6, 3, 'featured', 65,
    'Abrigo largo de paño con mezcla de lana, solapas amplias y cinturón desmontable. Abrigo clásico que acompaña muchas temporadas.'],
  ['prd-021', 'DAM-VES-003', 'Vestido camisero de mezclilla', 'dama', 'vestidos', 1149, null,
    img('1591369822096-ffd140ec948f'), SIZES.women, [C.mezclilla], 10, 3, 'new', 10,
    'Vestido camisero en mezclilla ligera con botones al frente, bolsillos laterales y cinturón para ajustar la silueta.'],
  ['prd-022', 'DAM-VES-004', 'Vestido satinado ciruela', 'dama', 'vestidos', 1499, 1899,
    img('1566174053879-31528523f8ae'), ['XS', 'S', 'M', 'L'], [C.ciruela], 5, 3, '', 40,
    'Vestido de satín con escote de hombros descubiertos y caída fluida. Ideal para eventos de noche y celebraciones.'],
  ['prd-023', 'DAM-ZAP-001', 'Zapatillas de tacón azul cobalto', 'dama', 'zapatos', 1399, null,
    img('1543163521-1bf539c55dd2'), SIZES.womenShoes, [C.cobalto], 8, 3, '', 85,
    'Zapatillas de punta fina en gamuza sintética con tacón de 8 cm y plantilla acolchada. Un toque de color con mucha elegancia.'],
  ['prd-024', 'DAM-ACC-001', 'Collar dorado de capas', 'dama', 'accesorios', 449, 549,
    img('1590548784585-643d2b9f2925'), SIZES.one, [C.dorado], 25, 5, '', 55,
    'Collar de tres capas con baño de oro de 18 k sobre acero inoxidable. Hipoalergénico y resistente al agua.'],
  ['prd-025', 'DAM-VES-005', 'Vestido largo mostaza', 'dama', 'vestidos', 1249, null,
    img('1605763240000-7e93b172d754'), SIZES.women, [C.mostaza], 9, 3, 'new', 4,
    'Vestido largo de gasa con cuello en V, mangas tres cuartos y falda con caída. Un tono cálido para lucir en exteriores.'],

  ['prd-026', 'NIN-CON-001', 'Conjunto denim Aventura', 'nino', 'conjuntos', 699, null,
    img('1514090458221-65bb69cf63e6'), SIZES.kids, [C.mezclilla], 16, 4, 'featured', 60,
    'Conjunto de chamarra y pantalón de mezclilla suave con elastano. Resistente para el juego diario y fácil de combinar.'],
  ['prd-027', 'NIN-CAM-001', 'Camiseta básica infantil', 'nino', 'camisetas', 249, 299,
    img('1471286174890-9c112ffca5b4'), SIZES.kids, [C.rojo, C.blanco], 35, 8, '', 100,
    'Camiseta de algodón peinado con cuello redondo y costuras planas que no irritan. Colores firmes que resisten el lavado.'],
  ['prd-028', 'NIN-CHA-001', 'Impermeable amarillo', 'nino', 'chamarras', 799, null,
    img('1503919545889-aef636e10ad4'), SIZES.kids, [C.amarillo], 3, 4, 'featured,new', 14,
    'Impermeable con capucha, costuras selladas y forro de malla transpirable. Detalles reflejantes para mayor visibilidad en días lluviosos.'],
  ['prd-029', 'NIN-CAM-002', 'Playera deportiva Sprint', 'nino', 'camisetas', 299, null,
    img('1489710437720-ebb67ec84dd2'), SIZES.kids, [C.blanco, C.azul], 18, 5, 'new', 8,
    'Playera de tejido técnico de secado rápido, ligera y transpirable. Perfecta para educación física y deportes al aire libre.'],
  ['prd-030', 'NIN-CON-002', 'Conjunto short y camisa', 'nino', 'conjuntos', 549, 649,
    img('1519238263530-99bdd11df2ea'), SIZES.kids, [C.azul, C.blanco], 12, 4, '', 35,
    'Conjunto de camisa de manga corta y short de algodón con pretina elástica. Fresco y elegante para fiestas y paseos.'],

  ['prd-031', 'NNA-VES-001', 'Vestido de lunares Margarita', 'nina', 'vestidos', 699, null,
    img('1518831959646-742c3a14ebf7'), SIZES.kids, [C.blanco], 14, 4, 'featured', 50,
    'Vestido de algodón con estampado de lunares, cuello redondo y lazo en la espalda. Cómodo, fresco y lleno de encanto.'],
  ['prd-032', 'NNA-VES-002', 'Vestido floral Jardín', 'nina', 'vestidos', 649, 799,
    img('1503454537195-1dcabb73ffb9'), SIZES.kids, [C.rosa], 9, 4, '', 42,
    'Vestido de popelina con estampado floral, mangas con olán y falda amplia. Forro de algodón suave para mayor comodidad.'],
  ['prd-033', 'NNA-CON-001', 'Overol de mezclilla', 'nina', 'conjuntos', 749, null,
    img('1555009393-f20bdb245c4d'), SIZES.kids, [C.mezclilla], 11, 4, 'new', 7,
    'Overol de mezclilla ligera con tirantes ajustables, bolsillo al pecho y botones laterales para vestirse fácilmente.'],
  ['prd-034', 'NNA-CHA-001', 'Chamarra de mezclilla para niña', 'nina', 'chamarras', 799, null,
    img('1497881807663-38b9a95b7192'), SIZES.kids, [C.mezclillaClaro], 0, 3, '', 88,
    'Chamarra clásica de mezclilla con lavado claro, botones metálicos y bolsillos con cartera. Una capa que combina con todo.'],
  ['prd-035', 'NNA-SUD-001', 'Sudadera Estrellas', 'nina', 'sudaderas', 549, null,
    img('1519278409-1f56fdda7fe5'), SIZES.kids, [C.negro, C.rosa], 13, 4, '', 66,
    'Sudadera de felpa suave con estampado de estrellas, cuello redondo y puños elásticos. Abrigadora y muy cómoda.'],
  ['prd-036', 'NNA-CON-002', 'Conjunto estampado Sol', 'nina', 'conjuntos', 599, null,
    img('1560506840-ec148e82a604'), SIZES.kids, [C.amarillo], 7, 3, 'new', 11,
    'Conjunto de blusa y short de algodón con estampado alegre. Pretina elástica y telas frescas para los días de calor.'],

  ['prd-037', 'BEB-BOD-001', 'Bodies de algodón orgánico (3 piezas)', 'bebe', 'bodies', 399, null,
    img('1622290319146-7b63df48a635'), SIZES.baby, [C.blanco, C.crudo], 40, 10, 'featured', 120,
    'Paquete de tres bodies de manga corta en algodón orgánico certificado. Broches de presión en la entrepierna y cuello americano para vestir fácilmente.'],
  ['prd-038', 'BEB-ACC-001', 'Gorro tejido para bebé', 'bebe', 'accesorios', 199, 249,
    img('1546015720-b8b30df5aa27'), ['0-3M', '3-6M', '6-12M'], [C.gris], 22, 6, '', 70,
    'Gorro de punto suave con forro de algodón que protege del frío sin irritar la piel delicada del bebé.'],
  ['prd-039', 'BEB-CON-001', 'Conjunto de rayas marinero', 'bebe', 'conjuntos', 499, null,
    img('1627639679638-8485316a4b21'), ['6-12M', '12-18M', '18-24M'], [C.blanco, C.marino], 10, 4, 'new', 5,
    'Conjunto de playera a rayas y pantalón de algodón con pretina elástica. Prendas suaves y resistentes para sus primeros pasos.'],
  ['prd-040', 'BEB-BOD-002', 'Mameluco con capucha Osito', 'bebe', 'bodies', 549, 649,
    img('1522771930-78848d9293e8'), SIZES.baby, [C.arena], 3, 4, 'featured', 30,
    'Mameluco de felpa con capucha de orejitas, cierre frontal protegido y pies cubiertos. Calientito para las noches frías.'],
  ['prd-041', 'BEB-CAM-001', 'Playeras básicas para bebé (3 piezas)', 'bebe', 'camisetas', 449, null,
    img('1566454544259-f4b94c3d758c'), SIZES.baby, [C.terracota, C.marino], 18, 5, '', 58,
    'Paquete de tres playeras de algodón peinado en colores combinables. Cuello con abertura para vestir y desvestir sin esfuerzo.'],

  ['prd-042', 'CAB-ACC-002', 'Mochila urbana impermeable', 'caballero', 'accesorios', 1099, null,
    img('1553062407-98eeb64c6a62'), SIZES.one, [C.marino], 12, 3, 'unpublished', 2,
    'Mochila de lona con recubrimiento impermeable, compartimento acolchado para laptop de 15" y bolsillo trasero antirrobo. (Producto en borrador, aún no publicado.)'],
];

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function buildProducts(now) {
  return PRODUCT_ROWS.map(
    ([id, sku, name, category, subcategory, price, compareAtPrice, images, sizes, colors, stock, minStock, flags, daysAgo, description]) => {
      const created = new Date(now - daysAgo * DAY).toISOString();
      return {
        id,
        sku,
        name,
        description,
        price,
        compareAtPrice,
        category,
        subcategory,
        images,
        sizes: [...sizes],
        colors: colors.map((c) => ({ ...c })),
        stock,
        minStock,
        published: !flags.includes('unpublished'),
        featured: flags.includes('featured'),
        isNew: flags.includes('new'),
        createdAt: created,
        updatedAt: created,
      };
    },
  );
}

const CUSTOMERS = {
  maria: { name: 'María Fernanda López', phone: '5500000101', email: 'maria.lopez@correo-demo.example' },
  jorge: { name: 'Jorge Ramírez Soto', phone: '5500000102', email: '' },
  ana: { name: 'Ana Sofía Torres', phone: '3300000103', email: 'ana.torres@correo-demo.example' },
  luis: { name: 'Luis Hernández Paz', phone: '8100000104', email: '' },
  daniela: { name: 'Daniela Castillo Ruiz', phone: '5500000105', email: 'daniela.c@correo-demo.example' },
  ricardo: { name: 'Ricardo Mendoza Gil', phone: '2200000106', email: '' },
  valeria: { name: 'Valeria Ortiz Cano', phone: '5500000107', email: 'valeria.ortiz@correo-demo.example' },
  fernando: { name: 'Fernando Ruiz Vega', phone: '4400000108', email: '' },
  paola: { name: 'Paola Jiménez Lara', phone: '5500000109', email: 'paola.jl@correo-demo.example' },
  sergio: { name: 'Sergio Navarro Díaz', phone: '6600000110', email: '' },
  gabriela: { name: 'Gabriela Rojas Peña', phone: '5500000111', email: '' },
  hector: { name: 'Héctor Vargas Luna', phone: '3300000112', email: 'hector.v@correo-demo.example' },
  lucia: { name: 'Lucía Morales Rey', phone: '5500000113', email: '' },
};

const DEMO_ADDRESS = {
  street: 'Calle de Ejemplo 123, Int. 4',
  neighborhood: 'Colonia Demostración',
  city: 'Ciudad de México',
  state: 'Ciudad de México',
  postalCode: '06000',
  references: 'Portón gris',
};

// [id, horasAtrás, estado final, cliente, método, [[producto, talla, color, cantidad]], notas, cancelado desde]
const ORDER_ROWS = [
  ['PED-DEMO-1001', 3, 'pendiente', 'maria', 'recoger', [['prd-014', 'M', 'Rojo', 1], ['prd-024', 'Unitalla', 'Dorado', 1]], 'Es para regalo, ¿pueden envolverlo?'],
  ['PED-DEMO-1002', 7, 'pendiente', 'jorge', 'envio', [['prd-006', '32', 'Índigo', 2], ['prd-001', 'L', 'Blanco', 3]], ''],
  ['PED-DEMO-1003', 26, 'confirmado', 'ana', 'envio', [['prd-031', '6', 'Blanco', 1], ['prd-037', '3-6M', 'Blanco', 2]], ''],
  ['PED-DEMO-1004', 50, 'en_preparacion', 'luis', 'recoger', [['prd-009', 'M', 'Azul marino', 1]], 'Paso por él el sábado.'],
  ['PED-DEMO-1005', 74, 'enviado', 'daniela', 'envio', [['prd-018', '26', 'Mezclilla claro', 1], ['prd-016', 'S', 'Blanco', 1]], ''],
  ['PED-DEMO-1006', 5 * 24, 'completado', 'ricardo', 'recoger', [['prd-010', '27', 'Miel', 1], ['prd-012', 'Unitalla', 'Gris jaspe', 2]], ''],
  ['PED-DEMO-1007', 9 * 24, 'completado', 'valeria', 'envio', [['prd-020', 'M', 'Camel', 1]], ''],
  ['PED-DEMO-1008', 16 * 24, 'completado', 'fernando', 'envio', [['prd-003', 'L', 'Gris jaspe', 1], ['prd-007', '32', 'Beige', 1]], ''],
  ['PED-DEMO-1009', 27 * 24, 'completado', 'paola', 'recoger', [['prd-026', '8', 'Mezclilla', 2], ['prd-027', '6', 'Rojo', 2]], ''],
  ['PED-DEMO-1010', 45 * 24, 'completado', 'sergio', 'envio', [['prd-004', 'L', 'Negro', 1]], ''],
  ['PED-DEMO-1011', 6 * 24, 'cancelado', 'gabriela', 'envio', [['prd-015', 'M', 'Rojo', 1]], '', 'pendiente'],
  ['PED-DEMO-1012', 12 * 24, 'cancelado', 'hector', 'recoger', [['prd-011', '28', 'Blanco', 1]], '', 'confirmado'],
  ['PED-DEMO-1013', 30, 'completado', 'lucia', 'recoger', [['prd-038', '3-6M', 'Gris jaspe', 1], ['prd-039', '12-18M', 'Blanco', 1]], ''],
];

function buildHistory(order, finalStatus, createdAtMs, nowMs, cancelledFrom) {
  const steps = [];
  if (finalStatus === ORDER_STATUS.CANCELLED) {
    const flow = getStatusFlow(order);
    steps.push(...flow.slice(0, flow.indexOf(cancelledFrom) + 1), ORDER_STATUS.CANCELLED);
  } else {
    const flow = getStatusFlow(order);
    steps.push(...flow.slice(0, flow.indexOf(finalStatus) + 1));
  }
  // Reparte los cambios de estado entre la creación y "ahora" (máx. 6 h entre pasos).
  const span = Math.min(nowMs - createdAtMs - HOUR, (steps.length - 1) * 6 * HOUR);
  const gap = steps.length > 1 ? Math.max(span, 0) / (steps.length - 1) : 0;
  return steps.map((status, i) => ({
    status,
    at: new Date(createdAtMs + i * gap).toISOString(),
    note: i === 0 ? 'Pedido generado desde la tienda en línea.' : status === ORDER_STATUS.CANCELLED ? 'Cancelado a solicitud del cliente.' : '',
  }));
}

function buildOrders(products, now) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return ORDER_ROWS.map(([id, hoursAgo, status, customerKey, methodId, rows, notes, cancelledFrom]) => {
    const createdAtMs = now - hoursAgo * HOUR;
    const items = rows.map(([productId, size, color, quantity]) => {
      const p = byId.get(productId);
      return {
        productId,
        sku: p.sku,
        name: p.name,
        image: p.images[0],
        size,
        color,
        unitPrice: p.price,
        compareAtPrice: p.compareAtPrice,
        quantity,
        lineTotal: lineTotal(p.price, quantity),
      };
    });
    const method = getDeliveryMethod(methodId);
    const totals = calculateTotals(items, methodId);
    const order = {
      id,
      createdAt: new Date(createdAtMs).toISOString(),
      updatedAt: null,
      status,
      customer: { ...CUSTOMERS[customerKey] },
      delivery: {
        methodId,
        label: method.label,
        cost: totals.shipping,
        address: method.requiresAddress ? { ...DEMO_ADDRESS } : null,
      },
      notes,
      items,
      totals,
      stockReleased: status === ORDER_STATUS.CANCELLED,
      statusHistory: [],
    };
    order.statusHistory = buildHistory(order, status, createdAtMs, now, cancelledFrom);
    order.updatedAt = order.statusHistory.at(-1).at;
    return order;
  });
}

/** Genera el conjunto inicial de datos con fechas relativas al momento actual. */
export function createSeedData(now = Date.now()) {
  const products = buildProducts(now);
  const orders = buildOrders(products, now);
  const sales = orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).map(buildSaleRecord);
  return { products, orders, sales };
}
