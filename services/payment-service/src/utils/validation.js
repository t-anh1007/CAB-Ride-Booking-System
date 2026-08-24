const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function isUuidOrPlaceholder(value) {
  return typeof value === 'string' && (value.trim() === 'uuid' || UUID_REGEX.test(value.trim()));
}

export function assertUuid(value, fieldName, createHttpError) {
  if (!isUuidOrPlaceholder(value)) {
    throw createHttpError(400, `Field '${fieldName}' must be a valid UUID`);
  }

  return value.trim();
}
