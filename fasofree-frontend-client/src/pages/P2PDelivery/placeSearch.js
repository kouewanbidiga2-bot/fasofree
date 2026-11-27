// Le répertoire est dérivé d’OpenStreetMap, © les contributeurs, licence ODbL.
// Les voies proviennent de l’extrait Geofabrik Burkina Faso du 23 novembre 2026.
// Toponymes des campus 2iE vérifiés avec les publications de l’institut.
// Les portails proviennent des nœuds OSM associés aux périmètres universitaires.

function normalize(value = '') {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/\b2\s*i\s*e\b/g, '2ie');
}

export function placeDistance(first, second) {
  const latitude = (first.lat + second.lat) * Math.PI / 360;
  return 111_195 * Math.hypot(first.lat - second.lat, (first.lng - second.lng) * Math.cos(latitude));
}

function nearbyLocality(place, localities) {
  let closest = null;
  let distance = Infinity;
  for (const locality of localities) {
    if (locality.place.id === place.id) continue;
    const nextDistance = placeDistance(place, locality.place);
    if (nextDistance < distance) {
      closest = locality;
      distance = nextDistance;
    }
  }
  return closest ? { entry: closest, distance } : null;
}

const streetName = /^(?:rue|avenue|boulevard|route|allée|impasse)\s/i;

function streetsFromAddressFields(places) {
  const streetKeys = new Set(places.filter(place => place.kind === 'Rue').map(place => normalize(place.name)));
  const streets = [];

  for (const place of places) {
    const parts = place.area?.split(',').map(part => part.trim()) || [];
    const street = parts.find(part => streetName.test(part));
    if (!street) continue;

    const name = street.charAt(0).toUpperCase() + street.slice(1);
    const key = normalize(name);
    if (streetKeys.has(key)) continue;
    streetKeys.add(key);
    streets.push({
      id: `street-${place.id}`,
      name,
      kind: 'Rue',
      lat: place.lat,
      lng: place.lng,
      area: parts.filter(part => part !== street).join(', '),
      landmark: place.name,
    });
  }

  return streets;
}

export function createPlaceIndex(places) {
  const entries = [...places, ...streetsFromAddressFields(places)].map(place => ({
    place,
    name: normalize(place.name),
    separatedName: normalize(place.name.replace(/['’]/g, ' ')),
    area: normalize(place.area),
    aliases: normalize(place.aliases),
    kind: normalize(place.kind),
    separated: [place.name, place.area, place.aliases]
      .filter(Boolean).map(value => normalize(value.replace(/['’]/g, ' '))).join(' '),
  }));
  const localities = entries.filter(({ place }) => place.kind === 'Quartier');

  return entries.map(entry => {
    const reference = entry.area ? null : nearbyLocality(entry.place, localities);
    const locality = entry.place.kind !== 'Quartier' && reference?.distance <= 800 ? reference.entry : null;
    return {
      ...entry,
      nearby: locality?.place.name,
      reference,
      words: [...new Set([entry.name, entry.area, entry.aliases, entry.kind, entry.separated, locality?.name, locality?.aliases, locality?.separated]
        .filter(Boolean).join(' ').split(' '))],
    };
  });
}

const distanceFormat = new Intl.NumberFormat('fr-BF', { maximumFractionDigits: 1 });
const compass = ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'];

function referenceLabel(place, reference) {
  if (!reference) return undefined;
  const origin = reference.entry.place;
  if (reference.distance < 180) return `Près de ${origin.name}`;

  const lat = place.lat - origin.lat;
  const lng = (place.lng - origin.lng) * Math.cos(origin.lat * Math.PI / 180);
  const octant = (Math.round(Math.atan2(lng, lat) * 4 / Math.PI) + 8) % 8;
  const distance = reference.distance < 1000
    ? `${Math.round(reference.distance / 50) * 50} m`
    : `${distanceFormat.format(reference.distance / 1000)} km`;
  return `À env. ${distance} ${compass[octant]} de ${origin.name}`;
}

function oneEditAway(first, second) {
  if (Math.abs(first.length - second.length) > 1) return false;
  if (first.length > second.length) return oneEditAway(second, first);
  for (let index = 0; index < first.length; index++) {
    if (first[index] === second[index]) continue;
    if (first.length !== second.length) return first.slice(index) === second.slice(index + 1);
    return first.slice(index + 1) === second.slice(index + 1)
      || (first[index] === second[index + 1] && first[index + 1] === second[index]
        && first.slice(index + 2) === second.slice(index + 2));
  }
  return true;
}

function matchesWords(entry, words, allowTypo = false) {
  const remaining = words.filter(word => !entry.words.some(candidate => candidate.startsWith(word)));
  if (remaining.length === 0) return true;
  return allowTypo && remaining.length === 1 && remaining[0].length >= 5
    && entry.words.some(candidate => oneEditAway(remaining[0], candidate));
}

export function findPlaces(index, input) {
  const normalized = normalize(input);
  const search = normalized.replace(/\s+burkina(?:\s+faso)?$/, '') || normalized;
  if (search.length < 3) return [];
  const withoutCity = search.replace(/\s+(?:ouagadougou|ouaga)$/, '');
  let query = search;
  let words = query.split(' ');
  let matches = index.filter(entry => matchesWords(entry, words));
  // Le nom de la ville distingue certains lieux, par exemple les campus 2iE.
  // On l’ignore uniquement si aucun résultat ne correspond à la requête.
  if (matches.length === 0 && withoutCity !== search && withoutCity.length >= 3) {
    query = withoutCity;
    words = query.split(' ');
    matches = index.filter(entry => matchesWords(entry, words));
  }
  const useTypoMatch = matches.length === 0;
  if (useTypoMatch) matches.push(...index.filter(entry => matchesWords(entry, words, true)));
  const rank = (entry) => {
    const names = [entry.name, entry.separatedName];
    if (names.includes(query)) return 0;
    if (names.some(name => name.startsWith(query))) return 1;
    if (names.some(name => name.includes(query))) return 2;
    if (names.some(name => matchesWords({ words: name.split(' ') }, words, useTypoMatch))) return 3;
    if (entry.area.includes(query)) return 4;
    return 5;
  };

  matches.sort((a, b) => rank(a) - rank(b) || Number(Boolean(b.area)) - Number(Boolean(a.area))
    || a.place.name.localeCompare(b.place.name, 'fr'));

  const distinct = [];
  for (const match of matches) {
    const duplicate = distinct.some(entry => entry.name === match.name && entry.kind === match.kind
      && (!entry.area || !match.area || entry.area === match.area)
      && placeDistance(entry.place, match.place) <= 30);
    if (duplicate) continue;
    distinct.push(match);
    if (distinct.length === 6) break;
  }

  return distinct.map(({ place, nearby, reference }) => ({
    ...place, nearby, context: referenceLabel(place, reference),
  }));
}
