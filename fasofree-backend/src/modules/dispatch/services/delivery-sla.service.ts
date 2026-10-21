/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * ⏱️ Règles de calcul de l'ETA (bloc B — suivi du temps de livraison).
 *
 * Règles validées :
 *  - vitesse de référence : **30 km/h** (trafic urbain)
 *  - majoration **+30 %** aux heures de pointe (11h30-13h30 et 17h00-20h00)
 *  - plancher : **15 min** (aucune course annoncée en dessous)
 *  - retard déclaré au-delà de **+25 %** de l'ETA (tolérance)
 *
 * Ces valeurs sont centralisées ici : une seule source de vérité pour
 * le backend (deadline stockée sur la commande) et pour l'affichage.
 */
export const SLA_SPEED_KMH = 30;

/** Majoration appliquée pendant les créneaux de pointe (%) */
export const SLA_PEAK_SURCHARGE_PCT = 30;

/** Plancher d'ETA (minutes) */
export const SLA_ETA_FLOOR_MINUTES = 15;

/**
 * Tolérance avant de déclarer un retard (% de l'ETA).
 *
 * Volontairement non nulle : l'ETA est une estimation (distance à vol
 * d'oiseau ÷ 30 km/h), pas une promesse. Sans tolérance, la quasi-totalité
 * des courses serait « en retard » et l'alerte perdrait tout sens.
 */
export const SLA_LATE_TOLERANCE_PCT = 25;

/** Créneaux de pointe, en minutes depuis minuit. */
export const SLA_PEAK_WINDOWS: Array<{ from: number; to: number; label: string }> = [
  { from: 11 * 60 + 30, to: 13 * 60 + 30, label: '11h30-13h30' },
  { from: 17 * 60, to: 20 * 60, label: '17h00-20h00' },
];

export interface DeliveryEtaResult {
  /** Distance de référence retenue (km) */
  distanceKm: number;
  /** ETA avant majoration / plancher (minutes) */
  baseMinutes: number;
  /** ETA annoncée (minutes) */
  etaMinutes: number;
  /** Un créneau de pointe a-t-il été appliqué ? */
  peakApplied: boolean;
  /** Le plancher de 15 min a-t-il été appliqué ? */
  floorApplied: boolean;
}

/**
 * ⏱️ Service SLA livraison — calcul d'ETA et échéance de retard.
 *
 * Aucune dépendance base : le service est pur (testable sans mock) et
 * partagé entre le dispatch (estampillage de la commande) et les
 * dashboards (affichage / alerte).
 */
@Injectable()
export class DeliverySlaService {
  private readonly logger = new Logger(DeliverySlaService.name);

  /** Heure locale du serveur, exprimée en minutes depuis minuit. */
  private minutesOfDay(at: Date): number {
    return at.getHours() * 60 + at.getMinutes();
  }

  /**
   * 🌆 Sommes-nous dans un créneau de pointe ?
   * Bornes incluses : 11h30:00 → 13h30:59 et 17h00:00 → 20h00:59.
   */
  isPeakHour(at: Date = new Date()): boolean {
    const minutes = this.minutesOfDay(at);
    return SLA_PEAK_WINDOWS.some((w) => minutes >= w.from && minutes <= w.to);
  }

  /** Libellé du créneau de pointe courant (ou null). */
  currentPeakWindow(at: Date = new Date()): string | null {
    const minutes = this.minutesOfDay(at);
    const window = SLA_PEAK_WINDOWS.find(
      (w) => minutes >= w.from && minutes <= w.to,
    );
    return window ? window.label : null;
  }

  /**
   * 🧮 ETA d'une course.
   *
   * `distanceKm` : distance de référence (ramassage → livraison).
   * Une distance nulle ou négative retombe sur le plancher.
   */
  computeEta(distanceKm: number, at: Date = new Date()): DeliveryEtaResult {
    const safeDistance =
      Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;

    const baseMinutes = (safeDistance / SLA_SPEED_KMH) * 60;
    const peakApplied = this.isPeakHour(at);
    const withPeak = peakApplied
      ? baseMinutes * (1 + SLA_PEAK_SURCHARGE_PCT / 100)
      : baseMinutes;

    // Arrondi à la minute supérieure : on n'annonce jamais moins que la réalité.
    const rounded = Math.ceil(withPeak);
    const floorApplied = rounded < SLA_ETA_FLOOR_MINUTES;
    const etaMinutes = floorApplied ? SLA_ETA_FLOOR_MINUTES : rounded;

    return {
      distanceKm: safeDistance,
      baseMinutes: Math.round(baseMinutes),
      etaMinutes,
      peakApplied,
      floorApplied,
    };
  }

  /**
   * 🎯 Échéance « en retard » = départ + ETA + tolérance.
   * C'est CETTE date qui est stockée sur la commande et comparée à
   * `deliveredAt` : l'ETA affichée reste en revanche la valeur brute.
   */
  computeLateDeadline(etaMinutes: number, from: Date): Date {
    const withTolerance =
      etaMinutes * (1 + SLA_LATE_TOLERANCE_PCT / 100);
    return new Date(from.getTime() + Math.round(withTolerance) * 60 * 1000);
  }

  /** Nombre de minutes de retard (0 si dans les temps). */
  minutesLate(deliveredAt: Date, deadline: Date | null): number {
    if (!deadline) return 0;
    const diff = deliveredAt.getTime() - new Date(deadline).getTime();
    return diff > 0 ? Math.round(diff / 60000) : 0;
  }

  /** La livraison est-elle en retard ? */
  isLate(deliveredAt: Date, deadline: Date | null): boolean {
    return this.minutesLate(deliveredAt, deadline) > 0;
  }
}
