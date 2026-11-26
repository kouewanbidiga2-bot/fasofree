const mapsHosts = new Set(['maps.google.com', 'www.google.com', 'google.com', 'www.google.bf']);
const decimal = '(-?\\d+(?:\\.\\d+)?)';
const coordinates = new RegExp(`^${decimal}\\s*,\\s*${decimal}$`);
const placeCoordinates = new RegExp(`!3d${decimal}!4d${decimal}(?:!|$)`);
const cameraCoordinates = new RegExp(`/@${decimal},${decimal},(?:(\\d+(?:\\.\\d+)?)z)?`);

function getPoint(match) {
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function readMapLocation(value) {
  const text = value.trim();
  const enteredPoint = getPoint(text.match(coordinates));
  if (enteredPoint) return { point: enteredPoint };

  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'))) {
      return { shortUrl: url.toString() };
    }
    if (!mapsHosts.has(url.hostname) || (url.hostname !== 'maps.google.com' && !/^\/maps(?:\/|$)/.test(url.pathname))) return null;

    const path = decodeURIComponent(url.pathname);
    const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
    const name = path.match(/^\/maps\/place\/([^/]+)/)?.[1]?.replace(/\+/g, ' ').trim().slice(0, 140);
    const point = getPoint(query.trim().match(coordinates)) || getPoint(path.match(placeCoordinates));
    if (point) return { point, name };

    const camera = path.match(cameraCoordinates);
    const cameraPoint = getPoint(camera);
    return cameraPoint ? {
      point: cameraPoint,
      overview: true,
      zoom: camera[3] ? Math.max(10, Math.min(21, Math.round(Number(camera[3])))) : undefined,
    } : null;
  } catch {
    return null;
  }
}
