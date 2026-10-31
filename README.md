# DELFI SHOP · Tienda online de ropa (frontend)

Frontend completo de una tienda de ropa para toda la familia (Caballero, Dama, Niño, Niña y Bebé) con un panel administrativo para inventario, productos, pedidos y ventas.

Está hecho únicamente con **HTML5, CSS3 y JavaScript ES6+** (módulos nativos). No usa frameworks, TypeScript ni Tailwind. Las fuentes (Fraunces e Inter) se cargan desde Google Fonts y las fotos de ejemplo desde Unsplash. Los íconos son SVG propios en estilo Lucide.

> **Fase actual: solo frontend.** No hay backend, base de datos, autenticación, cobros ni facturación. Los datos se guardan en el `localStorage` del navegador. La compra se concreta por WhatsApp o mediante un pedido «Pendiente» que la tienda confirma manualmente.

---

## Cómo ejecutar

La aplicación usa módulos ES (`<script type="module">`), así que necesita un servidor HTTP. Si se abre con doble clic (`file://`), aparece un aviso con instrucciones.

**Opción 1: Node.js 18 o superior (sin dependencias)**

```bash
node server.mjs
# o bien
npm start
```

Después abre <http://localhost:5173>. Para usar otro puerto: `PORT=8080 node server.mjs`.

**Opción 2: Python 3**

```bash
python -m http.server 5173
```

**Opción 3:** la extensión *Live Server* de VS Code o Cursor, o cualquier servidor estático.

| Área | URL |
| --- | --- |
| Tienda | `/index.html` |
| Panel administrativo | `/pages/admin/dashboard.html`, o el enlace «Panel administrativo» de la barra superior |

Para volver a los datos iniciales usa **«Restablecer demo»** en el menú lateral del panel.

---

## Funcionalidades

### Tienda

- **Inicio**: portada, categorías, productos destacados, novedades, ofertas, pasos para comprar y pie de página.
- **Catálogo** (`pages/catalogo.html`):
  - Búsqueda por texto, sin distinguir acentos ni mayúsculas.
  - Filtros combinables: categoría, subcategoría, precio mínimo y máximo, rangos rápidos, tallas, colores, disponibilidad, destacados, novedades y ofertas.
  - Orden por relevancia, precio, nombre o novedad.
  - Los filtros se reflejan en la URL, así que se pueden compartir y sobreviven a la recarga.
  - Chips de filtros activos, botón «Limpiar filtros», estado vacío y panel lateral de filtros en móvil.
- **Producto** (`pages/producto.html?id=…`):
  - Galería, selección de talla y color, y cantidad limitada por el stock disponible (descuenta lo que ya está en el carrito).
  - Validación antes de agregar al carrito.
  - Botón «Comprar por WhatsApp» con un mensaje prellenado que incluye producto, talla, color, cantidad, total y enlace.
  - Productos relacionados.
- **Carrito**:
  - Persiste en `localStorage`.
  - Permite ajustar cantidades, eliminar líneas y vaciarlo (con confirmación).
  - Muestra subtotales, ahorro y la barra de progreso hacia el envío gratis.
  - Detecta productos agotados, despublicados o con stock insuficiente y bloquea el checkout mientras haya problemas.
- **Checkout**:
  - Formulario validado: nombre, teléfono de 10 dígitos, correo opcional, método de entrega y dirección cuando hay envío.
  - Al confirmar se crea un pedido con número único, estado **Pendiente** y una copia (snapshot) de productos y precios.
  - El carrito se vacía solo si el pedido se crea correctamente.
  - Un doble clic o un reenvío no duplica el pedido.
- **Confirmación**: número de pedido (copiable), resumen, datos de entrega, aviso de que el pedido aún no es una venta y botón para enviarlo por WhatsApp.

### Panel administrativo

> **No tiene autenticación.** El panel es una demostración. Antes de producción debe protegerse con autenticación real en el servidor (sesiones o tokens, roles, HTTPS). No se simula un inicio de sesión porque daría una falsa sensación de seguridad.

- **Dashboard**:
  - Indicadores de productos, unidades, pedidos por estado y ventas.
  - Gráfica de ventas de los últimos 14 días, pedidos recientes y alertas de reposición.
- **Inventario**:
  - Búsqueda y filtros por categoría y estado (disponible, bajo, agotado o «requieren reposición»).
  - Ajuste rápido de existencias y nivel mínimo.
  - Valor estimado del inventario.
- **Productos**:
  - Alta, edición y eliminación (con confirmación); publicar u ocultar con un interruptor; filtros.
  - El formulario valida todos los campos, acepta hasta 4 imágenes (URL o archivo de hasta 400 KB), genera el SKU y muestra una vista previa en vivo.
- **Pedidos**:
  - Pestañas por estado con contadores, búsqueda y botón para avanzar al siguiente paso.
  - Detalle con línea de tiempo, historial, cliente, entrega, productos y totales.
  - Cambio de estado con una nota opcional.
- **Ventas**:
  - Filtro por fechas, con presets (hoy, 7 días, 30 días, este mes, todo) y validación del rango.
  - Indicadores: número de ventas, importe total, ticket promedio y unidades.
  - Tabla con totales del periodo.

---

## Reglas de negocio

### Pedidos y ventas

**Un pedido no es una venta.** Solo cuando un pedido llega a **Completado** se registra una venta, y se registra una sola vez por pedido.

Transiciones permitidas (`js/domain/orderStatus.js`):

```
Pendiente ──► Confirmado ──► En preparación ──► Enviado ──► Completado   (envío a domicilio)
                                        └─────────────────► Completado   (recoger en tienda)
Pendiente / Confirmado / En preparación ──► Cancelado
```

- *Completado* y *Cancelado* son estados finales.
- Un pedido cancelado nunca cuenta como venta.
- Cancelar pide confirmación.
- Repetir el mismo cambio de estado no tiene efecto: no duplica el historial ni la venta.

### Inventario

- Al **crear el pedido** se reservan (descuentan) las unidades. Así se evita vender dos veces la misma prenda mientras la tienda confirma.
- Al **cancelar**, las unidades vuelven al inventario una sola vez (bandera `stockReleased`).
- Estados de stock: *Agotado* (0 unidades), *Existencias bajas* (en el mínimo o por debajo) y *Disponible*.
- Al eliminar un producto, sus pedidos y ventas conservan la información, porque cada pedido guarda su propio snapshot.

### Precios

- Moneda MXN con formato `es-MX`.
- La oferta se muestra solo si el `compareAtPrice` es mayor que el precio.
- El envío cuesta $149 y es gratis desde $1,499. Recoger en tienda no tiene costo.
- Los descuentos y costos solo aparecen cuando aplican.
- Al crear el pedido, los precios se recalculan con el catálogo actual; nunca se confía en lo guardado en el carrito.

---

## Configuración

Todo se centraliza en `js/config.js`:

```js
whatsapp: {
  number: '520000000000', // ← reemplazar por el número real (código de país + número, sin + ni espacios)
  isPlaceholder: true,    // ← cambiar a false al configurar el número real
},
api: {
  dataSource: 'local',                    // 'local' | 'api'
  baseUrl: 'https://api.ejemplo.com/v1',  // URL del futuro backend
  timeoutMs: 10000,
},
```

El número de WhatsApp incluido es un **marcador de posición** y no pertenece a nadie. Mientras `isPlaceholder` sea `true`, los botones de WhatsApp funcionan, pero la interfaz avisa que el número es de demostración.

En el mismo archivo se configuran los datos de la tienda, los métodos de entrega y sus costos, el límite de unidades por línea y el nivel mínimo de stock por defecto.

---

## Estructura

```
├── index.html                 Inicio
├── pages/
│   ├── catalogo.html  producto.html  carrito.html  checkout.html  confirmacion-pedido.html
│   └── admin/
│       dashboard.html  inventario.html  productos.html  formulario-producto.html  pedidos.html  ventas.html
├── css/
│   ├── styles.css             Variables de diseño, base, encabezado y pie
│   ├── components.css         Botones, formularios, tarjetas, diálogos, avisos, tablas…
│   ├── catalogo.css           Inicio, catálogo y detalle de producto
│   ├── carrito.css            Carrito, checkout y confirmación
│   └── admin.css              Panel administrativo
├── js/
│   ├── config.js              Configuración central
│   ├── router.js              Rutas y parámetros de URL
│   ├── app.js                 Arranque de las páginas de la tienda
│   ├── boot-check.js          Aviso si se abre con file://
│   ├── utils/                 DOM seguro, formato, validación, ids, storage, eventos, íconos, WhatsApp
│   ├── data/                  Categorías, datos de ejemplo y repositorio sobre localStorage
│   ├── domain/                Reglas puras: precios, estados, inventario, filtros, validaciones, ventas
│   ├── services/              API interna de la aplicación (la que se conectará al backend)
│   ├── components/            Encabezado, tarjetas, diálogos, avisos, layout del panel…
│   └── pages/                 Un módulo por página (y pages/admin/ para el panel)
├── assets/                    Favicon e imagen de respaldo
└── server.mjs                 Servidor estático de desarrollo (Node, sin dependencias)
```

El código se organiza en capas:

```
pages → components → services → data (localRepository → localStorage)
                     ↘ domain (reglas puras, sin acceso a datos)
```

Las páginas **nunca** acceden a `localStorage` directamente; siempre pasan por los servicios.

---

## Integración con un backend

Los servicios de `js/services/` ya son **asíncronos** (`async`/`Promise`) y tienen la forma de la futura API, así que las páginas no tendrán que cambiar. Para integrar el backend:

1. Implementar los endpoints (sugeridos abajo).
2. Cambiar `CONFIG.api.dataSource` a `'api'` y definir `CONFIG.api.baseUrl`.
3. En cada servicio, reemplazar el acceso a `localRepository` por `apiRequest()` (`js/services/apiClient.js`, que ya maneja query string, JSON, timeouts y errores HTTP).

```js
// js/services/productService.js — ejemplo
export async function getProducts({ includeUnpublished = false } = {}) {
  return apiRequest('/products', { query: { includeUnpublished } });
}
```

| Función | Endpoint sugerido |
| --- | --- |
| `getProducts`, `queryProducts` | `GET /products?q=&categoria=&min=&max=&tallas=&colores=&orden=…` |
| `getProductById` | `GET /products/:id` |
| `createProduct` | `POST /products` |
| `updateProduct`, `setProductPublished` | `PUT/PATCH /products/:id` |
| `deleteProduct` | `DELETE /products/:id` |
| `getInventory`, `getInventorySummary` | `GET /inventory`, `GET /inventory/summary` |
| `updateStock` | `PATCH /inventory/:productId` |
| `createOrder` | `POST /orders` (cabecera `Idempotency-Key`) |
| `getOrders`, `getOrderById`, `getOrderStats` | `GET /orders?status=&q=`, `GET /orders/:id`, `GET /orders/stats` |
| `updateOrderStatus` | `PATCH /orders/:id/status` |
| `getSales`, `getSalesSummary` | `GET /sales?from=&to=`, `GET /sales/summary` |

**Debe pasar al servidor:**

- **Reserva y liberación de stock** (`reserveStock`/`releaseStock`) y el **registro de ventas** (`registerSale`). Deben ocurrir en una transacción de base de datos dentro de `createOrder` y `updateOrderStatus`; el cliente no debería poder llamarlos directamente.
- **Validaciones.** Las de `js/domain/` sirven de referencia y para dar respuesta inmediata en la interfaz, pero el servidor debe repetirlas.
- **Precios y totales.** El servidor los recalcula; el cliente solo envía ids, variantes y cantidades.
- **Idempotencia.** El checkout ya genera una clave por intento (`sessionStorage`) y la envía en `createOrder`.
- **Autenticación y autorización** del panel administrativo.
- **Imágenes.** Subirlas a un almacenamiento (por ejemplo, S3) y guardar solo la URL, en lugar de data URLs.

**Se puede eliminar o sustituir:**

- `js/data/mockData.js`: datos de ejemplo.
- `js/data/localRepository.js`: persistencia local. Se puede conservar solo para el carrito.
- `enableCrossTabSync` (`js/app.js`): sincroniza pestañas con eventos de `storage`.
- El botón «Restablecer demo».

Las entidades (producto, pedido, venta) están documentadas en el propio código: `js/data/mockData.js`, `js/services/orderService.js` y `js/domain/sales.js`.

---

## Seguridad y calidad

- **Sin `innerHTML`.** Todo el contenido se crea con `document.createElement` y `textContent` (función `h()` en `js/utils/dom.js`), lo que evita inyecciones de HTML.
- **Sin secretos en el frontend:** no hay contraseñas, credenciales ni claves de API.
- **Sin cobros:** no hay pasarelas de pago ni facturación. El pago se acuerda con la tienda.
- **Confirmaciones** antes de eliminar productos, cancelar pedidos, vaciar el carrito o restablecer la demo.
- **Sin duplicados:** los botones se deshabilitan durante el envío, el checkout usa clave de idempotencia, la venta se registra una sola vez por pedido y el stock se libera una sola vez.
- **Accesibilidad:**
  - HTML semántico, enlace «Saltar al contenido», etiquetas en todos los campos y errores asociados con `aria-describedby`/`aria-invalid`.
  - Diálogos nativos (`<dialog>`) con gestión de foco, avisos con `aria-live` y foco visible.
  - Contraste AA y soporte de `prefers-reduced-motion`.
- **Responsive:** diseño móvil primero; menú y filtros en panel lateral en pantallas pequeñas.

## Limitaciones de esta fase

- Los datos viven en el `localStorage` de **cada navegador**: no se comparten entre dispositivos y se pierden si se borran los datos del sitio. Varias pestañas del mismo navegador sí se sincronizan.
- `localStorage` tiene un límite aproximado de 5 MB, por eso las imágenes subidas como archivo se limitan a 400 KB. Lo recomendable es usar URLs.
- El panel administrativo no tiene control de acceso.
- Las fotos de ejemplo dependen de Unsplash. Si una imagen no carga, se muestra una imagen de respaldo.
