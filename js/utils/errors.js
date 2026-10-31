/** Error de negocio con un mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

/** Error de validación con mensajes por campo. */
export class ValidationError extends AppError {
  constructor(message, fieldErrors = {}) {
    super(message, { code: 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, { code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

/** Devuelve un mensaje legible para cualquier error. */
export function getErrorMessage(error) {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
