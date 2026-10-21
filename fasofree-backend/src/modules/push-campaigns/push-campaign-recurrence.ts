/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  PushCampaignRecurrence,
  DEFAULT_CAMPAIGN_TIMEZONE,
} from './entities/push-campaign.entity';

// Ré-exporté : les consommateurs (service, tests) trouvent le fuseau ici aussi.
export { DEFAULT_CAMPAIGN_TIMEZONE };

/** Bornes de sécurité de l'itération calendaire (couvre un MONTHLY lointain). */
const MAX_DAY_SCAN = 400;

/**
 * Spécification de récurrence d'une campagne.
 */
export interface RecurrenceSpec {
  recurrence: PushCampaignRecurrence;
  /**
   * Ancre : sert de référence pour l'heure par défaut (si `timeOfDay` absent),
   * pour le jour de la semaine (WEEKLY sans `daysOfWeek`) et pour le
   * quantième (MONTHLY).
   */
  anchor: Date;
  /** Heure murale 'HH:MM' dans `timeZone`. Absent = heure locale de `anchor`. */
  timeOfDay?: string | null;
  /** Jours 0=dimanche … 6=samedi pour WEEKLY. Vide = jour de `anchor`. */
  daysOfWeek?: number[] | null;
  /** Fuseau IANA. Défaut : `DEFAULT_CAMPAIGN_TIMEZONE`. */
  timeZone?: string | null;
  /** Aucune exécution au-delà de cette date (→ COMPLETED). */
  endsAt?: Date | null;
}

/** 'HH:MM' → { hh, mm } ; `null` si la valeur est absente ou mal formée. */
export function parseTimeOfDay(
  value?: string | null,
): { hh: number; mm: number } | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
  if (!match) return null;
  return { hh: Number(match[1]), mm: Number(match[2]) };
}

/**
 * Décalage (en minutes) entre `timeZone` et UTC à l'instant `at`.
 *
 * Méthode standard sans dépendance : on formate `at` dans le fuseau cible puis
 * on relit les composantes comme si elles étaient UTC ; la différence avec
 * `at` EST l'offset. Pour Africa/Ouagadougou l'offset vaut toujours 0, mais
 * cette implémentation reste correcte pour tout fuseau IANA (DST inclus).
 */
function timeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    // Certains moteurs rendent « 24 » pour minuit : on ramène dans [0, 23].
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return Math.round((asIfUtc - at.getTime()) / 60000);
}

/**
 * Convertit une heure MURALE locale (dans `timeZone`) en instant UTC.
 *
 * Deux passes : la première estime l'offset, la seconde le re-vérifie car il
 * peut changer autour d'une transition d'heure d'été.
 */
export function zonedWallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hh: number,
  mm: number,
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, hh, mm, 0, 0);
  const offset1 = timeZoneOffsetMinutes(timeZone, new Date(asIfUtc));
  const guess = asIfUtc - offset1 * 60000;
  const offset2 = timeZoneOffsetMinutes(timeZone, new Date(guess));
  return new Date(offset2 === offset1 ? guess : asIfUtc - offset2 * 60000);
}

/** Composantes locales (dans `timeZone`) d'un instant. */
function localParts(
  timeZone: string,
  at: Date,
): { y: number; mo: number; d: number; hh: number; mm: number; dow: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const y = get('year');
  const mo = get('month');
  const d = get('day');
  return {
    y,
    mo,
    d,
    hh: get('hour') % 24,
    mm: get('minute'),
    // Le jour de la semaine se déduit sans ambiguïté de la date locale.
    dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(),
  };
}

/** Nombre de jours du mois (month = 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 🔁 Prochaine exécution STRICTEMENT postérieure à `from` (ou `null`).
 *
 * Renvoie `null` quand :
 *  - la campagne n'est pas récurrente (`NONE`) ;
 *  - la prochaine occurrence dépasse `endsAt` (la campagne se termine) ;
 *  - aucune occurrence n'est trouvée dans les 400 jours (spec impossible).
 *
 * Pour MONTHLY, le quantième est celui de l'ancre, ramené au dernier jour du
 * mois quand il n'existe pas (ancre au 31 → 30 en avril).
 */
export function computeNextRunAt(
  spec: RecurrenceSpec,
  from: Date,
): Date | null {
  if (!spec || spec.recurrence === PushCampaignRecurrence.NONE) return null;

  const timeZone = spec.timeZone?.trim() || DEFAULT_CAMPAIGN_TIMEZONE;
  const endsAt =
    spec.endsAt instanceof Date && !Number.isNaN(spec.endsAt.getTime())
      ? spec.endsAt
      : null;
  const anchor =
    spec.anchor instanceof Date && !Number.isNaN(spec.anchor.getTime())
      ? spec.anchor
      : from;

  const anchorParts = localParts(timeZone, anchor);
  const tod = parseTimeOfDay(spec.timeOfDay) ?? {
    hh: anchorParts.hh,
    mm: anchorParts.mm,
  };

  const requestedDays = (spec.daysOfWeek ?? []).filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  );
  const weeklyDays =
    requestedDays.length > 0
      ? new Set(requestedDays)
      : new Set([anchorParts.dow]);

  const fromParts = localParts(timeZone, from);

  for (let offset = 0; offset <= MAX_DAY_SCAN; offset++) {
    // Arithmétique calendaire en UTC (aucune heure d'été) : le décalage en
    // jours reste exact quel que soit le fuseau applicatif.
    const dayCursor = new Date(
      Date.UTC(fromParts.y, fromParts.mo - 1, fromParts.d + offset),
    );
    const y = dayCursor.getUTCFullYear();
    const mo = dayCursor.getUTCMonth() + 1;
    const d = dayCursor.getUTCDate();
    const dow = dayCursor.getUTCDay();

    let matches = false;
    switch (spec.recurrence) {
      case PushCampaignRecurrence.DAILY:
        matches = true;
        break;
      case PushCampaignRecurrence.WEEKLY:
        matches = weeklyDays.has(dow);
        break;
      case PushCampaignRecurrence.MONTHLY:
        matches = d === Math.min(anchorParts.d, daysInMonth(y, mo));
        break;
      default:
        matches = false;
    }
    if (!matches) continue;

    const candidate = zonedWallTimeToUtc(timeZone, y, mo, d, tod.hh, tod.mm);
    if (candidate.getTime() <= from.getTime()) continue;
    if (endsAt && candidate.getTime() > endsAt.getTime()) return null;
    return candidate;
  }

  return null;
}
