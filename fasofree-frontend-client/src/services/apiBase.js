const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultBase = import.meta.env.DEV ? '/api/v1' : 'https://api.fasofree.site/api/v1';

export const API_URL = (configuredBase || defaultBase).replace(/\/+$/, '');
export const API_ORIGIN = new URL(API_URL, window.location.origin).origin;
