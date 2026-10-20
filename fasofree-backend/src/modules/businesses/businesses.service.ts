import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { BUSINESS_OPENING_DAYS } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';
import { BulkAssignSubCategoryDto } from './dto/bulk-assign-subcategory.dto';
import { UserRole } from '../users/entities/user-role.enum';
import { escapeLikeTerm } from '../../common/utils/like-escape';
import {
  ALL_SUB_CATEGORIES,
  BUSINESS_CATALOG,
  getActiveCatalog,
  getActiveCategoryValues,
  isValidSubCategory,
} from './constants/business-catalog';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  // 🏪 1. Créer un commerce avec sa géolocalisation
  async create(dto: CreateBusinessDto, ownerId: string): Promise<Business> {
    const business = this.businessRepository.create({
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      ownerId,
      brandId: dto.brandId ?? null,
      // Affiche / logo posés dès la création quand fournis (formulaires admin) ;
      // optionnels pour les autres chemins (seed, approbation de candidature).
      coverImage: dto.coverImage || null,
      logo: dto.logo || null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude], // ⚠️ Format GeoJSON : [Longitude, Latitude]
      },
    });

    return this.businessRepository.save(business);
  }

  // 🏪 1b. Trouver le(s) commerce(s) d'un marchand
  async findByOwner(ownerId: string): Promise<Business | null> {
    return this.businessRepository.findOne({
      where: { ownerId },
      relations: { products: true },
    });
  }

  // 🏪 1c. Tous les commerces d'un marchand (multi-agences)
  async findAllByOwner(ownerId: string): Promise<Business[]> {
    return this.businessRepository.find({
      where: { ownerId },
      order: { name: 'ASC' },
    });
  }

  async assertManagedBy(
    businessId: string,
    userId: string,
    role: UserRole,
  ): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Commerce introuvable');
    if (role !== UserRole.SUPER_ADMIN && business.ownerId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas gérer ce commerce');
    }
    return business;
  }

  // 🔄 Transférer la propriété d'un commerce (super admin uniquement)
  async transferOwner(businessId: string, newOwnerId: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Commerce introuvable');
    business.ownerId = newOwnerId;
    return this.businessRepository.save(business);
  }

  // 📍 2. Recherche spatiale : Commerces dans un rayon donné
  // Essaie PostGIS d'abord, fallback Haversine si l'extension n'est pas dispo.
  async findNearby(dto: FindNearbyDto): Promise<Business[]> {
    const radiusMeters = (dto.radiusInKm || 5) * 1000;

    try {
      const query = this.businessRepository
        .createQueryBuilder('business')
        .select([
          'business.id',
          'business.name',
          'business.address',
          'business.phone',
          'business.logo',
          'business.coverImage',
          'business.category',
          'business.subCategory',
          'business.isOpen',
          'business.enableDelivery',
          'business.enablePickup',
          'business.enableDineIn',
          'business.latitude',
          'business.longitude',
        ])
        .where(
          `ST_DWithin(
            business.location::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
            :radius
          )`,
          {
            longitude: dto.longitude,
            latitude: dto.latitude,
            radius: radiusMeters,
          },
        )
        .andWhere('business.isOpen = true');

      if (dto.category) {
        query.andWhere('business.category = :category', { category: dto.category });
      }

      if (dto.subCategory) {
        query.andWhere('business.subCategory = :subCategory', {
          subCategory: dto.subCategory,
        });
      }

      // Tri par distance pour garantir un ordre déterministe
      query.orderBy(
        `ST_Distance(
          business.location::geography,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        )`,
        'ASC'
      );

      return await query.getMany();
    } catch {
      // PostGIS indisponible → fallback Haversine sur les colonnes lat/lng
      const query = this.businessRepository
        .createQueryBuilder('business')
        .select([
          'business.id',
          'business.name',
          'business.address',
          'business.phone',
          'business.logo',
          'business.coverImage',
          'business.category',
          'business.subCategory',
          'business.isOpen',
          'business.enableDelivery',
          'business.enablePickup',
          'business.enableDineIn',
          'business.latitude',
          'business.longitude',
        ])
        .where('business.isOpen = true');

      if (dto.category) {
        query.andWhere('business.category = :category', { category: dto.category });
      }

      if (dto.subCategory) {
        query.andWhere('business.subCategory = :subCategory', {
          subCategory: dto.subCategory,
        });
      }

      const all = await query.getMany();
      const filteredAndSorted = all.filter((b) => {
        if (b.latitude == null || b.longitude == null) return false;
        const R = 6371e3;
        const dLat = ((b.latitude - dto.latitude) * Math.PI) / 180;
        const dLon = ((b.longitude - dto.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((dto.latitude * Math.PI) / 180) *
            Math.cos((b.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        b['distance'] = distance;
        return distance <= radiusMeters;
      });

      return filteredAndSorted.sort((a, b) => (a['distance'] || 0) - (b['distance'] || 0));
    }
  }

  // 🏪 2bis. Lister tous les commerces (Super Admin)
  async findAll(): Promise<Business[]> {
    return this.businessRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 🏷️ 2bis-2. Catalogue des catégories ACTIVES (niveau 1 + niveau 2).
   *
   * Source unique de vérité consommée par le client : il ne code plus ses
   * filtres en dur (l'ancienne liste ne correspondait à aucune valeur en base).
   *
   * Les verticales éteintes par le Super Admin (ex. PHARMACY) sont absentes :
   * elles s'activent depuis « Paramètres de la plateforme » sans redéploiement.
   */
  getCategoryCatalog() {
    return {
      categories: getActiveCatalog().map((c) => ({
        value: c.value,
        label: c.label,
        subCategories: c.subCategories,
      })),
    };
  }

  /**
   * 🕐 Le commerce est-il ouvert à l'instant `at` ? (bloc H)
   *
   * `isOpen` reste l'interrupteur maître : le comportement antérieur est
   * préservé à l'identique. Les horaires récurrents l'affinent seulement :
   * si le jour courant a un créneau renseigné, le commerce n'est ouvert que
   * dans ce créneau. Un jour sans créneau → `isOpen` décide seul (et les
   * commerces qui n'ont jamais renseigné d'horaire ne changent rien).
   *
   * Gestion des services de nuit : quand `close` < `open` (ex. 22:00 →
   * 02:00), le créneau est traité comme chevauchant minuit.
   *
   * Volontairement synchrone et sans accès base : appelé à chaque création
   * de commande, il doit rester gratuit.
   */
  isOpenAt(business: Business, at: Date = new Date()): boolean {
    if (!business.isOpen) return false;

    const hours = business.openingHours;
    if (!hours) return true;

    // `getDay()` renvoie 0 (dimanche) → 6 (samedi) ; on réaligne sur
    // lundi = 0 pour correspondre à BUSINESS_OPENING_DAYS.
    const dayIndex = at.getDay() === 0 ? 6 : at.getDay() - 1;
    const slot = hours[BUSINESS_OPENING_DAYS[dayIndex].key];
    if (!slot?.open || !slot?.close) return true;

    const toMinutes = (value: string): number => {
      const [h, m] = value.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const now = at.getHours() * 60 + at.getMinutes();
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);

    if (close > open) return now >= open && now < close;
    // Service de nuit : ouvert après `open` OU avant `close`.
    return now >= open || now < close;
  }
  /**
   * 🏷️ F-bis. Recensement des commerces SANS sous-catégorie (niveau 2).
   *
   * Les commerces créés avant le catalogue à deux niveaux ont
   * `subCategory = NULL` : ils restent invisibles dans tous les filtres de
   * sous-catégorie du client. La base ne peut pas deviner « Fast-Food » ou
   * « Pizzas » à partir de la seule verticale RESTAURANT — d'où cet écran.
   *
   * Exception : 5 verticales sur 6 n'ont qu'UNE sous-catégorie (Épicerie,
   * Boulangerie & Viennoiserie, Boutique, Pharmacie, Services). Celles-là
   * sont déductibles : `autoCompletable` les signale à l'interface, qui
   * peut les résoudre en un clic via `autoTagSingleSubCategoryBusinesses`.
   */
  async getSubCategoryTaggingOverview(limit = 500) {
    const untaggedWhere =
      'b."subCategory" IS NULL OR b."subCategory" = :empty';
    const params = { empty: '' };
    const safeLimit = Math.min(Math.max(limit, 1), 2000);

    const rows = await this.businessRepository
      .createQueryBuilder('b')
      .select(['b.id', 'b.name', 'b.address', 'b.category'])
      .where(untaggedWhere, params)
      .orderBy('b."createdAt"', 'DESC')
      .limit(safeLimit)
      .getMany();

    const countRows: Array<{ category: string; count: string }> =
      await this.businessRepository
        .createQueryBuilder('b')
        .select('b.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where(untaggedWhere, params)
        .groupBy('b.category')
        .getRawMany();

    const countByCategory = new Map<string, number>();
    for (const row of countRows) {
      countByCategory.set(row.category, Number(row.count) || 0);
    }

    const activeValues = new Set<string>(getActiveCategoryValues());
    const groups = BUSINESS_CATALOG.map((def) => ({
      category: def.value as string,
      label: def.label,
      enabled: activeValues.has(def.value),
      autoCompletable: def.subCategories.length === 1,
      subCategories: def.subCategories,
      count: countByCategory.get(def.value) ?? 0,
      businesses: [] as Array<{ id: string; name: string; address: string }>,
    }));

    const byValue = new Map(groups.map((g) => [g.category, g]));
    for (const b of rows) {
      byValue.get(b.category)?.businesses.push({
        id: b.id,
        name: b.name,
        address: b.address,
      });
    }

    const untaggedCount = Array.from(countByCategory.values()).reduce(
      (sum, n) => sum + n,
      0,
    );
    const autoCompletableCount = groups
      .filter((g) => g.autoCompletable)
      .reduce((sum, g) => sum + g.count, 0);

    return {
      untaggedCount,
      autoCompletableCount,
      // La liste d'affichage est bornée : les compteurs restent, eux, exacts.
      truncated: untaggedCount > rows.length,
      groups,
    };
  }

  /**
   * 🏷️ F-bis. Résout automatiquement les verticales à sous-catégorie UNIQUE.
   *
   * Épicerie, Boulangerie, Boutique, Pharmacie, Services : « la » valeur est
   * sans ambiguïté, la déduire est donc sûr et idempotent. On ne touche
   * JAMAIS un commerce déjà tagué, ni RESTAURANT (6 sous-familles → choix
   * humain). Pharmacie comprise : taguer un commerce déjà saisi ne le rend
   * pas visible tant que la verticale reste éteinte.
   */
  async autoTagSingleSubCategoryBusinesses(): Promise<{
    updated: number;
    byCategory: Record<string, number>;
  }> {
    const singleSubCategory = BUSINESS_CATALOG.filter(
      (def) => def.subCategories.length === 1,
    );
    const byCategory: Record<string, number> = {};
    let updated = 0;

    for (const def of singleSubCategory) {
      const target = def.subCategories[0];
      const result = await this.businessRepository
        .createQueryBuilder()
        .update(Business)
        .set({ subCategory: target })
        .where('category = :category', { category: def.value })
        .andWhere('("subCategory" IS NULL OR "subCategory" = :empty)', {
          empty: '',
        })
        .execute();

      const affected = result.affected ?? 0;
      if (affected > 0) {
        byCategory[def.value] = affected;
        updated += affected;
      }
    }

    return { updated, byCategory };
  }

  /**
   * 🏷️ F-bis. Taguage de masse explicite (choix humain de la sous-famille).
   *
   * Chaque commerce est valide INDIVIDUELLEMENT : une sous-catégorie qui
   * n'appartient pas à la verticale du commerce est ignorée pour celui-ci
   * (jamais d'attribution silencieuse d'une valeur incohérente, qui
   * casserait les filtres en aval).
   */
  async bulkAssignSubCategory(dto: BulkAssignSubCategoryDto): Promise<{
    updated: number;
    skipped: Array<{ id: string; name?: string; reason: string }>;
  }> {
    const subCategory = (dto.subCategory || '').trim();
    if (!ALL_SUB_CATEGORIES.includes(subCategory)) {
      throw new BadRequestException(
        `Sous-catégorie inconnue : « ${subCategory} ». Valeurs acceptées : ${ALL_SUB_CATEGORIES.join(', ')}`,
      );
    }

    const ids = Array.from(new Set(dto.businessIds));
    const businesses = await this.businessRepository.find({
      where: { id: In(ids) },
      select: { id: true, name: true, category: true, subCategory: true },
    });

    const found = new Set(businesses.map((b) => b.id));
    const skipped: Array<{ id: string; name?: string; reason: string }> = [];
    for (const id of ids) {
      if (!found.has(id)) {
        skipped.push({ id, reason: 'Commerce introuvable' });
      }
    }

    const toUpdate: string[] = [];
    for (const b of businesses) {
      if (!isValidSubCategory(b.category, subCategory)) {
        skipped.push({
          id: b.id,
          name: b.name,
          reason: `« ${subCategory} » n'appartient pas à la verticale ${b.category}`,
        });
        continue;
      }
      toUpdate.push(b.id);
    }

    if (toUpdate.length > 0) {
      await this.businessRepository
        .createQueryBuilder()
        .update(Business)
        .set({ subCategory })
        .whereInIds(toUpdate)
        .execute();
    }

    return { updated: toUpdate.length, skipped };
  }

  // 🏷️ 2ter. Retourne les marques groupées avec leurs agences
  // Chaque marque = 1 carte sur le front, les agences sont à l'intérieur
  async findGrouped(
    latitude?: number,
    longitude?: number,
    category?: string,
    subCategory?: string,
  ): Promise<any[]> {
    // 1. Charger toutes les marques
    const query = this.businessRepository
      .createQueryBuilder('b')
      .select([
        'b.brandId',
        'b.id',
        'b.name',
        'b.address',
        'b.phone',
        'b.logo',
        'b.coverImage',
        'b.category',
        'b.subCategory',
        'b.isOpen',
        'b.enableDelivery',
        'b.enablePickup',
        'b.latitude',
        'b.longitude',
      ])
      .where('b.isOpen = true');

    // 🏷️ Filtres catalogue. AVANT : `category` était accepté par le
    // contrôleur mais jamais transmis ici → le front renvoyait toujours
    // les mêmes commerces, quel que soit le filtre choisi (bug signalé).
    if (category) {
      query.andWhere('b.category = :category', { category });
    }
    if (subCategory) {
      query.andWhere('b.subCategory = :subCategory', { subCategory });
    }

    const brands = await query.getMany();

    // 2. Grouper par brandId
    const brandMap = new Map<string, Business[]>();
    const noBrand: Business[] = [];

    for (const b of brands) {
      if (b.brandId) {
        const list = brandMap.get(b.brandId) || [];
        list.push(b);
        brandMap.set(b.brandId, list);
      } else {
        noBrand.push(b);
      }
    }

    // 3. Construire le résultat groupé
    const result: any[] = [];

    // Marques avec agences : 1 entrée par marque
    for (const [brandId, branches] of brandMap) {
      // Si coordonnées fournies, calculer la distance de la plus proche agence
      let nearestBranch = branches[0];
      if (latitude != null && longitude != null) {
        const R = 6371e3;
        let minDist = Infinity;
        for (const b of branches) {
          if (b.latitude != null && b.longitude != null) {
            const dLat = ((b.latitude - latitude) * Math.PI) / 180;
            const dLon = ((b.longitude - longitude) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((latitude * Math.PI) / 180) *
                Math.cos((b.latitude * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (dist < minDist) {
              minDist = dist;
              nearestBranch = b;
            }
          }
        }
      }

      result.push({
        id: nearestBranch.id, // Le front utilise l'id du business le plus proche
        brandId,
        name: nearestBranch.name.replace(/ - .+$/, ''), // "Chitir Chicken" au lieu de "Chitir Chicken - Kamboinsin"
        displayName: nearestBranch.name, // Nom complet de la branche la plus proche
        isBrand: true,
        branchCount: branches.length,
        branches: branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
          isOpen: b.isOpen,
          latitude: b.latitude,
          longitude: b.longitude,
        })),
        logo: nearestBranch.logo,
        coverImage: nearestBranch.coverImage,
        category: nearestBranch.category,
        subCategory: nearestBranch.subCategory,
        phone: nearestBranch.phone,
        deliveryTime: '25-40 min',
        latitude: nearestBranch.latitude,
        longitude: nearestBranch.longitude,
      });
    }

    // Business sans marque : carte individuelle
    for (const b of noBrand) {
      result.push({
        id: b.id,
        brandId: null,
        name: b.name,
        displayName: b.name,
        isBrand: false,
        branchCount: 0,
        branches: [],
        logo: b.logo,
        coverImage: b.coverImage,
        category: b.category,
        subCategory: b.subCategory,
        phone: b.phone,
        deliveryTime: '25-40 min',
        latitude: b.latitude,
        longitude: b.longitude,
      });
    }

    return result;
  }

  // 🔍 3. Trouver un commerce par son ID (UUID) ou par nom (fallback)
  async findOne(id: string): Promise<Business> {
    // 1. Essayer par UUID
    let business = await this.businessRepository.findOne({
      where: { id },
      relations: { products: true },
    });

    // 2. Fallback : recherche par nom exact (insensible à la casse)
    if (!business) {
      business = await this.businessRepository.findOne({
        where: { name: id },
        relations: { products: true },
      });
    }

    // 3. Fallback : recherche partielle par nom
    if (!business) {
      // Échappe les wildcards LIKE (% _ \) pour empêcher l'injection
      // via un masque trop large (ex. id = "%" matche tout).
      const escaped = escapeLikeTerm(id);
      business = await this.businessRepository
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.products', 'products')
        .where("LOWER(b.name) LIKE LOWER(:name) ESCAPE '\\'", {
          name: `%${escaped}%`,
        })
        .getOne();
    }

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    return business;
  }

  // ⚙️ 4. Mettre à jour les paramètres d'un commerce
  async update(id: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    // Mise à jour des champs fournis
    if (dto.name !== undefined) business.name = dto.name;
    if (dto.address !== undefined) business.address = dto.address;
    if (dto.phone !== undefined) business.phone = dto.phone;
    if (dto.category !== undefined) business.category = dto.category;
    if (dto.subCategory !== undefined)
      business.subCategory = dto.subCategory || null;
    // 🔒 Cohérence : si la verticale a changé, une sous-catégorie devenue
    // orpheline (ex. « Fast-Food » sur une épicerie) est effacée.
    if (
      business.subCategory &&
      !isValidSubCategory(business.category, business.subCategory)
    ) {
      business.subCategory = null;
    }
    if (dto.enableDelivery !== undefined)
      business.enableDelivery = dto.enableDelivery;
    if (dto.enablePickup !== undefined)
      business.enablePickup = dto.enablePickup;
    if (dto.enableDineIn !== undefined)
      business.enableDineIn = dto.enableDineIn;
    if (dto.hasOwnDrivers !== undefined)
      business.hasOwnDrivers = dto.hasOwnDrivers;
    if (dto.isOpen !== undefined) business.isOpen = dto.isOpen;
    // 🕐 Bloc H — horaires récurrents. `null` explicite = effacer (revenir à
    // un pilotage par `isOpen` seul) ; champ absent = ne pas toucher.
    if (dto.openingHours !== undefined)
      business.openingHours = dto.openingHours || null;
    // 📅 Bloc H — config commandes à l'avance. Même sémantique.
    if (dto.advanceOrderConfig !== undefined)
      business.advanceOrderConfig = dto.advanceOrderConfig || null;
    if (dto.brandId !== undefined) business.brandId = dto.brandId;
    if (dto.logo !== undefined) (business as any).logo = dto.logo || null;
    if (dto.coverImage !== undefined) (business as any).coverImage = dto.coverImage || null;
    if (dto.mobileMoneyNumber !== undefined) business.mobileMoneyNumber = dto.mobileMoneyNumber || null;
    if (dto.mobileMoneyProvider !== undefined) (business as any).mobileMoneyProvider = dto.mobileMoneyProvider || null;

    // Mise à jour de la géolocalisation si fournie
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      business.latitude = dto.latitude;
      business.longitude = dto.longitude;
      business.location = {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      };
    }

    return this.businessRepository.save(business);
  }

  // 🗑️ 5. Supprimer un commerce (Super Admin)
  // - Les produits et favoris liés sont supprimés en CASCADE par la base.
  // - Les commandes conservent leur businessId (colonne sans contrainte FK)
  //   afin de préserver l'historique et les données financières.
  async remove(id: string): Promise<{ message: string; id: string }> {
    const business = await this.businessRepository.findOne({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Commerce introuvable');
    }

    await this.businessRepository.remove(business);

    return {
      message: `Commerce "${business.name}" supprimé`,
      id,
    };
  }

  async findTrending(limit = 10): Promise<Business[]> {
    return this.businessRepository
      .createQueryBuilder('b')
      .where('b.isActive = :active', { active: true })
      .orderBy('b.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async findRecommendedForUser(userVisitedBusinessIds: string[], limit = 6): Promise<Business[]> {
    if (!userVisitedBusinessIds.length) {
      return this.findTrending(limit);
    }

    const businesses = await this.businessRepository
      .createQueryBuilder('b')
      .where('b.isActive = :active', { active: true })
      .andWhere('b.id NOT IN (:...visited)', { visited: userVisitedBusinessIds })
      .orderBy('b.rating', 'DESC')
      .limit(limit)
      .getMany();

    if (businesses.length < limit) {
      const extra = await this.findTrending(limit - businesses.length);
      const existingIds = new Set(businesses.map((b) => b.id));
      for (const b of extra) {
        if (!existingIds.has(b.id)) businesses.push(b);
      }
    }

    return businesses;
  }
}
