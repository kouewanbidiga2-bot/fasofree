/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { API_ORIGIN } from '../services/apiBase';

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext fill='%239ca3af' font-family='system-ui,sans-serif' font-size='14' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3EImage indisponible%3C/text%3E%3C/svg%3E";

export function getAbsoluteImageUrl(url) {
  if (!url) return PLACEHOLDER;
  // Seules les data: URLs d'image sont acceptées (pas de data:text/html, etc.).
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return API_ORIGIN + url;
  if (url.startsWith('/assets/')) {
    try {
      return window.location.origin + url;
    } catch {
      return url;
    }
  }
  if (url.startsWith('/')) return API_ORIGIN + url;
  return url;
}

export function onImgError(event) {
  event.target.onerror = null;
  event.target.src = PLACEHOLDER;
}

export { PLACEHOLDER as PLACEHOLDER_SVG };
