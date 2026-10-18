import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings, DeliveryTierConfig } from './entities/system-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DeliveryPricingService } from '../orders/delivery-pricing.service';
import { RidePricingService } from '../orders/services/ride-pricing.service';
import * as Subscription from '../subscriptions/subscription.service';
import {
  BUSINESS_CATALOG,
  BusinessCatalogCache,
  getActiveCategoryValues,
} from '../businesses/constants/business-catalog';
import {
  applyPushCampaignPricing,
  pushCampaignPriceCache,
} from '../push-campaigns/push-campaign-pricing';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(SystemSettings)
    private readonly repo: Repository<SystemSettings>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save(this.repo.create({}));
      this.logger.log('[Settings] Ligne singleton initialisée avec les valeurs par défaut');
    }
    await this.syncStaticCaches();
  }

  private async syncStaticCaches(): Promise<void> {
    try {
      const settings = await this.repo.findOne({ where: {} });
      if (!settings) return;

      // Tranches tarifaires (nouveau système) — prioritaire sur l'ancien override linéaire
      if (settings.deliveryTiers && Array.isArray(settings.deliveryTiers) && settings.deliveryTiers.length > 0) {
        DeliveryPricingService.tiersFromDB = settings.deliveryTiers;
        DeliveryPricingService.override = null;
        this.logger.log(`[Settings] Cache DeliveryPricingService synchronisé avec ${settings.deliveryTiers.length} tranches (DB)`);
      } else if (settings.deliveryPricing) {
        DeliveryPricingService.override = settings.deliveryPricing;
        this.logger.log('[Settings] Cache DeliveryPricingService synchronisé (legacy linéaire)');
      }

      if (settings.fasoRidePricing) {
        RidePricingService.override = settings.fasoRidePricing;
        this.logger.log('[Settings] Cache RidePricingService synchronisé');
      }

      if (settings.platformFee !== undefined) {
        Subscription.subscriptionFeeCache.platformFee = settings.platformFee;
        this.logger.log(`[Settings] Cache SubscriptionService synchronisé (platformFee=${settings.platformFee})`);
      }

      Subscription.subscriptionFeeCache.storiesPassEnabled = Boolean(settings.storiesPassEnabled);
      this.logger.log(`[Settings] Pass Stories ${settings.storiesPassEnabled ? 'activé' : 'désactivé'} (storiesPassEnabled=${settings.storiesPassEnabled})`);

      // 🏷️ Verticales de commerces actives (catalogue 2 niveaux).
      // Alimente le cache statique lu par BusinessesService.getCategoryCatalog()
      // et par le catalogue public GET /businesses/categories.
      BusinessCatalogCache.enabledCategories = Array.isArray(
        settings.enabledBusinessCategories,
      )
        ? settings.enabledBusinessCategories
        : null;
      this.logger.log(
        `[Settings] Verticales commerces actives : ${getActiveCategoryValues().join(', ')}`,
      );

      // 💳 Tarifs des campagnes push auto-service (lot 3.1) : lus par
      // PushCampaignService via un cache statique (aucune requête par envoi ni
      // par tick de cron). On ne peut pas injecter SettingsService dans le
      // service de campagnes sans créer un cycle de dépendances.
      applyPushCampaignPricing(settings.pushCampaignPricing);
      this.logger.log(
        `[Settings] Tarifs campagnes push synchronisés : ${JSON.stringify(pushCampaignPriceCache)}`,
      );
    } catch (err) {
      this.logger.warn(`[Settings] Échec sync caches: ${(err as Error).message}`);
    }
  }

  async get(): Promise<SystemSettings> {
    let settings = await this.repo.findOne({ where: {} });
    if (!settings) {
      settings = await this.repo.save(this.repo.create({}));
    }
    return settings;
  }

  async update(dto: UpdateSettingsDto): Promise<SystemSettings> {
    const settings = await this.get();
    Object.assign(settings, dto);
    const saved = await this.repo.save(settings);
    await this.syncStaticCaches();
    return saved;
  }

  /**
   * 🎛️ Catalogue COMPLET des verticales + état actif.
   *
   * Différence avec `GET /businesses/categories` (public) qui ne renvoie QUE
   * les verticales actives : ici on expose l'univers complet, sinon le Super
   * Admin ne pourrait jamais rallumer une verticale éteinte (elle aurait
   * disparu de sa propre interface).
   */
  getBusinessCategoryCatalog() {
    const active = new Set(getActiveCategoryValues());
    return {
      categories: BUSINESS_CATALOG.map((c) => ({
        value: c.value,
        label: c.label,
        enabled: active.has(c.value),
      })),
      enabled: Array.from(active),
    };
  }
}
