import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryProvider } from './delivery-provider.interface';
import { InternalFleetProvider } from './internal-fleet.provider';
import { AgencyProvider } from './agency.provider';
import { ManualProvider } from './manual.provider';

/**
 * 🧭 Registry ordonné des providers de livraison.
 *
 * L'ordre de fail-over est défini par la variable d'environnement
 * `DELIVERY_PROVIDERS` (liste séparée par des virgules), par défaut
 * `internal` seul → **comportement strictement identique à l'existant**.
 *
 * Exemples :
 *   DELIVERY_PROVIDERS=internal
 *   DELIVERY_PROVIDERS=internal,manual
 *   DELIVERY_PROVIDERS=internal,agency,manual
 *
 * L'orchestrateur parcourt la liste dans l'ordre : le premier provider
 * dont `createDelivery` renvoie `accepted=true` prend la course en
 * charge. L'échec d'un provider n'est JAMAIS une erreur finale —
 * c'est un passage au niveau de secours suivant.
 */
@Injectable()
export class DeliveryProviderRegistry {
  private readonly logger = new Logger(DeliveryProviderRegistry.name);
  private readonly byName = new Map<string, DeliveryProvider>();
  private readonly ordered: DeliveryProvider[] = [];

  constructor(
    internalFleetProvider: InternalFleetProvider,
    agencyProvider: AgencyProvider,
    manualProvider: ManualProvider,
    configService: ConfigService,
  ) {
    // Providers connus (clés du registry)
    for (const provider of [internalFleetProvider, agencyProvider, manualProvider]) {
      this.byName.set(provider.name, provider);
    }

    // Ordre de fail-over depuis la config
    const configured = (
      configService.get<string>('DELIVERY_PROVIDERS', 'internal') ?? 'internal'
    )
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    for (const name of configured) {
      const provider = this.byName.get(name);
      if (provider) {
        this.ordered.push(provider);
      } else {
        this.logger.warn(
          `[DeliveryProviderRegistry] Provider inconnu "${name}" dans DELIVERY_PROVIDERS — ignoré`,
        );
      }
    }

    // Fail-safe : toujours au moins le pool interne
    if (this.ordered.length === 0) {
      this.ordered.push(internalFleetProvider);
    }

    this.logger.log(
      `[DeliveryProviderRegistry] Chaîne de livraison : ${this.ordered
        .map((p) => p.name)
        .join(' → ')}`,
    );
  }

  /** Providers dans l'ordre de fail-over */
  getAll(): DeliveryProvider[] {
    return [...this.ordered];
  }

  /** Provider par nom (ex. pour le suivi / annulation) */
  getProvider(name: string): DeliveryProvider | undefined {
    return this.byName.get(name);
  }
}
