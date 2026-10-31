/**
 * Configuración central de la aplicación.
 * Es el único lugar donde deben cambiarse datos de marca, contacto,
 * WhatsApp, reglas comerciales y la URL de la futura API.
 */
export const CONFIG = Object.freeze({
  store: Object.freeze({
    name: 'DELFI SHOP',
    tagline: 'Ropa para toda la familia',
    email: 'hola@delfishop.com',
    address: 'Dirección de demostración, Ciudad de México',
    schedule: 'Lun a Sáb · 10:00 a 20:00',
  }),

  whatsapp: Object.freeze({
    // MARCADOR DE POSICIÓN: sustitúyelo por el número real de la tienda
    // en formato internacional sin "+", espacios ni guiones (ej. 52 + 10 dígitos).
    number: '527571217533',
    isPlaceholder: true,
  }),

  api: Object.freeze({
    // Aún no existe backend. Los servicios trabajan con datos locales ("local").
    // Al integrar la API REST, cambia dataSource a "api" y define baseUrl.
    dataSource: 'local',
    baseUrl: 'https://api.ejemplo.com/v1',
    timeoutMs: 10000,
  }),

  locale: 'es-MX',
  currency: 'MXN',

  storage: Object.freeze({
    prefix: 'olmo:v1:',
  }),

  checkout: Object.freeze({
    maxUnitsPerLine: 20,
    deliveryMethods: Object.freeze([
      Object.freeze({
        id: 'recoger',
        label: 'Recoger en tienda',
        description: 'Sin costo. Te avisamos cuando tu pedido esté listo.',
        cost: 0,
        requiresAddress: false,
      }),
      Object.freeze({
        id: 'envio',
        label: 'Envío a domicilio',
        description: 'Entrega de 2 a 5 días hábiles.',
        cost: 149,
        freeFrom: 1499,
        requiresAddress: true,
      }),
    ]),
  }),

  inventory: Object.freeze({
    defaultMinStock: 5,
  }),

  social: Object.freeze([
    Object.freeze({ id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/' }),
    Object.freeze({ id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/' }),
  ]),
});
