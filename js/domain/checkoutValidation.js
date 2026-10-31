import { getDeliveryMethod } from './pricing.js';
import { isBlank, isEmail, isPhone, isPostalCode, normalizePhone } from '../utils/validation.js';

/** Normaliza los datos del cliente capturados en el checkout. */
export function normalizeCustomerInput(data) {
  const clean = (v, max = 200) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return {
    customer: {
      name: clean(data.name, 80),
      phone: normalizePhone(data.phone),
      email: clean(data.email, 120).toLowerCase(),
    },
    deliveryMethodId: String(data.deliveryMethod ?? ''),
    address: {
      street: clean(data.street, 120),
      neighborhood: clean(data.neighborhood, 80),
      city: clean(data.city, 60),
      state: clean(data.state, 60),
      postalCode: clean(data.postalCode, 5),
      references: clean(data.references, 200),
    },
    notes: String(data.notes ?? '').trim().slice(0, 500),
  };
}

/** @returns {Record<string,string>} errores por nombre de campo del formulario. */
export function validateCheckout(input) {
  const errors = {};
  const { customer, address } = input;

  if (customer.name.length < 3 || !/\s/.test(customer.name)) errors.name = 'Escribe tu nombre y apellido.';
  if (!isPhone(customer.phone)) errors.phone = 'Escribe un teléfono de 10 dígitos.';
  if (!isBlank(customer.email) && !isEmail(customer.email)) errors.email = 'Escribe un correo electrónico válido.';

  const method = getDeliveryMethod(input.deliveryMethodId);
  if (!method) errors.deliveryMethod = 'Selecciona un método de entrega.';

  if (method?.requiresAddress) {
    if (address.street.length < 5) errors.street = 'Escribe calle y número.';
    if (address.neighborhood.length < 2) errors.neighborhood = 'Escribe la colonia.';
    if (address.city.length < 2) errors.city = 'Escribe la ciudad o municipio.';
    if (address.state.length < 2) errors.state = 'Selecciona el estado.';
    if (!isPostalCode(address.postalCode)) errors.postalCode = 'El código postal debe tener 5 dígitos.';
  }

  return errors;
}
