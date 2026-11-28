type Coordinates = { latitude: number; longitude: number };

export async function getGoogleCourierRoute(key: string, origin: Coordinates, target: Coordinates) {
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: target } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        polylineEncoding: 'GEO_JSON_LINESTRING',
        polylineQuality: 'OVERVIEW',
      }),
      signal: AbortSignal.timeout(3500),
      redirect: 'error',
    });
    if (!response.ok) return null;
    const route = (await response.json())?.routes?.[0];
    const shape = route?.polyline?.geoJsonLinestring;
    const distanceMeters = route?.distanceMeters;
    const durationSeconds = typeof route?.duration === 'string' && /^\d+(\.\d{1,9})?s$/.test(route.duration)
      ? Number(route.duration.slice(0, -1)) : NaN;
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0 || !Number.isFinite(durationSeconds)
      || shape?.type !== 'LineString' || !Array.isArray(shape.coordinates)
      || shape.coordinates.length < 2 || shape.coordinates.length > 10000) return null;

    const points: [number, number][] = [];
    for (const point of shape.coordinates) {
      if (!Array.isArray(point)) return null;
      const [longitude, latitude] = point;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 85
        || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
      points.push([latitude, longitude]);
    }
    return { points, distanceMeters, durationSeconds };
  } catch {
    return null;
  }
}
