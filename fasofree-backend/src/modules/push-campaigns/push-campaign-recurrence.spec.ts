/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  computeNextRunAt,
  parseTimeOfDay,
  zonedWallTimeToUtc,
  DEFAULT_CAMPAIGN_TIMEZONE,
} from './push-campaign-recurrence';
import { PushCampaignRecurrence } from './entities/push-campaign.entity';

/**
 * 🔁 Lot 2 — Calcul de la prochaine diffusion d'une campagne récurrente.
 *
 * POURQUOI CES TESTS : toute la logique de récurrence est concentrée dans ce
 * module PUR (aucune dépendance TypeORM/DB), donc testable sans mocker quoi que
 * ce soit. C'est là que se cachent les pièges (fin de mois, jours de semaine,
 * heure murale vs UTC) — pas dans le cron, qui ne fait qu'appeler.
 *
 * Repères : 2026-10-18 est un DIMANCHE.
 *  - 18/10 = dimanche (0), 19/10 = lundi (1), 22/10 = jeudi (4).
 */
describe('PushCampaignRecurrence (Lot 2)', () => {
  const tz = DEFAULT_CAMPAIGN_TIMEZONE; // Africa/Ouagadougou = UTC+0, sans DST

  describe('parseTimeOfDay', () => {
    it('accepte une heure murale valide', () => {
      expect(parseTimeOfDay('09:30')).toEqual({ hh: 9, mm: 30 });
      expect(parseTimeOfDay('00:00')).toEqual({ hh: 0, mm: 0 });
      expect(parseTimeOfDay('23:59')).toEqual({ hh: 23, mm: 59 });
      expect(parseTimeOfDay(' 08:05 ')).toEqual({ hh: 8, mm: 5 });
    });

    it('refuse une heure mal formée ou absente', () => {
      for (const bad of ['9:00', '24:00', '12:60', '0900', 'abc', '']) {
        expect(parseTimeOfDay(bad)).toBeNull();
      }
      expect(parseTimeOfDay(null)).toBeNull();
      expect(parseTimeOfDay(undefined)).toBeNull();
    });
  });

  describe('zonedWallTimeToUtc', () => {
    it('Ouagadougou (UTC+0) : l’heure murale EST l’heure UTC', () => {
      expect(zonedWallTimeToUtc(tz, 2026, 10, 18, 9, 0).toISOString()).toBe(
        '2026-10-18T09:00:00.000Z',
      );
    });

    it('Europe/Paris en hiver (UTC+1) : 09:00 mural = 08:00 UTC', () => {
      expect(
        zonedWallTimeToUtc('Europe/Paris', 2026, 1, 15, 9, 0).toISOString(),
      ).toBe('2026-01-15T08:00:00.000Z');
    });
  });

  describe('computeNextRunAt', () => {
    it('NONE → aucune récurrence', () => {
      expect(
        computeNextRunAt(
          {
            recurrence: PushCampaignRecurrence.NONE,
            anchor: new Date('2026-10-18T08:00:00.000Z'),
            timeOfDay: '09:00',
            timeZone: tz,
          },
          new Date('2026-10-18T08:00:00.000Z'),
        ),
      ).toBeNull();
    });

    it('DAILY — même jour si l’heure n’est pas encore passée', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T08:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-18T08:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-18T09:00:00.000Z');
    });

    it('DAILY — lendemain si l’heure est déjà passée', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T08:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-18T10:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    });

    it('DAILY — l’heure du créneau est STRICTEMENT postérieure à `from`', () => {
      // from = exactement l'heure de diffusion → on doit passer au lendemain.
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T09:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-18T09:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    });

    it('WEEKLY — prochain jour explicitement demandé (lundi)', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.WEEKLY,
          anchor: new Date('2026-10-18T12:00:00.000Z'), // dimanche
          timeOfDay: '08:00',
          daysOfWeek: [1], // lundi
          timeZone: tz,
        },
        new Date('2026-10-18T12:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-19T08:00:00.000Z');
    });

    it('WEEKLY — plusieurs jours (lundi + jeudi) : on saute au suivant', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.WEEKLY,
          anchor: new Date('2026-10-19T00:00:00.000Z'),
          timeOfDay: '08:00',
          daysOfWeek: [1, 4],
          timeZone: tz,
        },
        // lundi 08:00 déjà passé → jeudi
        new Date('2026-10-19T09:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-22T08:00:00.000Z');
    });

    it('WEEKLY — sans jours fournis, on reprend le jour de l’ancre', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.WEEKLY,
          anchor: new Date('2026-10-18T09:00:00.000Z'), // dimanche
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-18T10:00:00.000Z'),
      );
      // Dimanche suivant : 25/10.
      expect(next?.toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });

    it('WEEKLY — ignore les jours invalides fournis', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.WEEKLY,
          anchor: new Date('2026-10-18T09:00:00.000Z'), // dimanche
          timeOfDay: '09:00',
          daysOfWeek: [9, -1], // aucun jour valide → repli sur l'ancre
          timeZone: tz,
        },
        new Date('2026-10-18T10:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });

    it('MONTHLY — ancre au 31 : ramenée au dernier jour de février', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.MONTHLY,
          anchor: new Date('2026-01-31T09:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-01-31T10:00:00.000Z'),
      );
      // 2026 n'est pas bissextile → 28/02.
      expect(next?.toISOString()).toBe('2026-02-28T09:00:00.000Z');
    });

    it('MONTHLY — quantième conservé quand le mois est assez long', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.MONTHLY,
          anchor: new Date('2026-10-05T09:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-05T10:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-11-05T09:00:00.000Z');
    });

    it('endsAt dépassé → null (la campagne se termine)', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T09:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
          endsAt: new Date('2026-10-18T23:00:00.000Z'),
        },
        new Date('2026-10-18T10:00:00.000Z'),
      );
      // Prochaine occurrence = 19/10 09:00, au-delà de endsAt.
      expect(next).toBeNull();
    });

    it('endsAt non encore atteint → occurrence renvoyée', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T09:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: tz,
          endsAt: new Date('2026-10-25T23:00:00.000Z'),
        },
        new Date('2026-10-18T10:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-19T09:00:00.000Z');
    });

    it('timeOfDay invalide → repli sur l’heure locale de l’ancre', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-10-18T07:15:00.000Z'),
          timeOfDay: 'bidon',
          timeZone: tz,
        },
        new Date('2026-10-18T06:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-18T07:15:00.000Z');
    });

    it('respecte le fuseau de la campagne (Paris, heure d’hiver)', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('2026-01-15T00:00:00.000Z'),
          timeOfDay: '09:00',
          timeZone: 'Europe/Paris',
        },
        new Date('2026-01-15T00:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    });

    it('ancre invalide → repli sur `from` (aucune exception)', () => {
      const next = computeNextRunAt(
        {
          recurrence: PushCampaignRecurrence.DAILY,
          anchor: new Date('nope'),
          timeOfDay: '09:00',
          timeZone: tz,
        },
        new Date('2026-10-18T08:00:00.000Z'),
      );
      expect(next?.toISOString()).toBe('2026-10-18T09:00:00.000Z');
    });
  });
});
