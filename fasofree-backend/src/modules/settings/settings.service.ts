import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DeliveryPricingService } from '../orders/delivery-pricing.service';
import { RidePricingService } from '../orders/services/ride-pricing.service';
import * as Subscription from '../subscriptions/subscription.service';

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
    // Peupler les caches statiques des services de tarification
    await this.syncStaticCaches();
  }

  private async syncStaticCaches(): Promise<void> {
    try {
      const settings = await this.repo.findOne({ where: {} });
      if (!settings) return;

      if (settings.deliveryPricing) {
        DeliveryPricingService.override = settings.deliveryPricing;
        this.logger.log('[Settings] Cache DeliveryPricingService synchronisé');
      }

      if (settings.fasoRidePricing) {
        RidePricingService.override = settings.fasoRidePricing;
        this.logger.log('[Settings] Cache RidePricingService synchronisé');
      }

      if (settings.platformFee !== undefined) {
        Subscription.subscriptionFeeCache.platformFee = settings.platformFee;
        this.logger.log(`[Settings] Cache SubscriptionService synchronisé (platformFee=${settings.platformFee})`);
      }
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
    // Re-synchroniser les caches statiques après mise à jour
    await this.syncStaticCaches();
    return saved;
  }
}
