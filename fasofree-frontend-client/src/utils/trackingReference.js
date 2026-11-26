export function normalizeTrackingReference(value) {
  const code = value.trim().toUpperCase().replace(/[\s-]+/g, '').replace(/^KW/, '');
  return /^[\dA-F]{20}$/.test(code) ? code : null;
}

export function formatTrackingReference(value) {
  const code = normalizeTrackingReference(value || '');
  return code ? `KW-${code.match(/.{1,4}/g).join('-')}` : '';
}
