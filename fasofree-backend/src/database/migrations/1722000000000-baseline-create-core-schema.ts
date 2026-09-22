import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BASELINE — Schéma initial des tables de base FasoFree.
 *
 * Contexte : les 10 tables "de base" (users, businesses, orders, order_items,
 * products, transactions, merchant_payouts, financial_ledger, receipts,
 * reviews) ont historiquement été créées par `synchronize` en dev/Neon, jamais
 * par une migration. Sur une base VIERGE (déploiement Render), la 1ʳᵉ
 * migration créant-dépend (`1723700000000`) échouait avec
 * `relation "users" does not exist` (42P01).
 *
 * Cette migration stationne AVANT toutes les autres (timestamp 1722000000000 <
 * 1722200000000) et recrée exactement le schéma que TypeORM/synchronize
 * produisait pour ces 10 tables, afin que toute la chaîne de migrations
 * s'exécute de bout en bout sur base vierge.
 *
 * Règles suivies :
 * - `CREATE TABLE IF NOT EXISTS` / enums gardés `duplicate_object` → cette
 *   migration est un no-op sûr sur une base déjà peuplée (rollback sûr).
 * - Noms d'enum EXACTEMENT ceux attendus par les migrations qui les vérifient
 *   ensuite : `business_category_enum` (1724000000000, SANS "es"),
 *   `fulfillment_type_enum` (1724100000000), `orders_orderType_enum`
 *   (1724400000000). Le runtime TypeORM ne dépend pas du nom du type.
 * - Index créés ici avec les noms EXACTS des migrations qui les déclarent
 *   (pour no-op) : `UQ_merchant_payouts_orderId`, `idx_orders_qr_code`,
 *   `IDX_orders_branchId`. Les index `idx_orders_status`,
 *   `idx_order_items_order_id`, `idx_businesses_owner_id` et la FK
 *   `fk_businesses_owner` restent à la migration 1728100000000 (IF NOT EXISTS).
 * - NE crée PAS les tables des migrations (disputes, kyc_documents, wallets,
 *   …) pour éviter tout conflit avec leurs `ADD COLUMN` non idempotents.
 * - Extensions requises par la suite : uuid-ossp (uuid_generate_v4), pgcrypto
 *   (gen_random_uuid), postgis (businesses.location geometry(Point,4326) +
 *   ST_DWithin). Fails-loud si une extension est indisponible.
 */
export class BaselineCreateCoreSchema1722000000000
  implements MigrationInterface
{
  name = 'BaselineCreateCoreSchema1722000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────────────────────────────────────────────────────────────────────────
    // 1. EXTENSIONS
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis";`);

    // ────────────────────────────────────────────────────────────────────────
    // 2. TYPES ENUM (gardés)
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "users_role_enum" AS ENUM
        ('client','courier','driver','business_admin','support','admin','super_admin');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "users_mobileMoneyProvider_enum" AS ENUM
        ('WAVE','ORANGE_MONEY','MOOV_MONEY','TELECEL_MONEY');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "users_preferredNotificationChannel_enum" AS ENUM
        ('EMAIL','WHATSAPP','SMS','PUSH');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Nom attendu par 1724000000000 (SANS "es") — TypeORM utiliserait
    // "businesses_category_enum", mais la migration vérifie "business_category_enum".
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "business_category_enum" AS ENUM
        ('RESTAURANT','SUPERMARKET','PHARMACY','RETAIL','BAKERY','SERVICES');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "businesses_mobileMoneyProvider_enum" AS ENUM
        ('WAVE','ORANGE_MONEY','MOOV_MONEY','TELECEL_MONEY');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "orders_status_enum" AS ENUM
        ('PENDING','AWAITING_PAYMENT','PAID','IN_PREPARATION','READY_FOR_PICKUP',
         'DRIVER_ASSIGNED','PROCESSING','IN_DELIVERY','DELIVERED_PENDING_CONFIRMATION',
         'DELIVERED','COMPLETED','CANCELLED','FAILED','DISPUTED','REFUNDED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Nom attendu par 1724400000000 (coïncide avec le nom TypeORM).
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "orders_orderType_enum" AS ENUM
        ('MERCHANT','P2P_DELIVERY','DELIVERY','PICKUP','RIDE','EXPRESS');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Nom attendu par 1724100000000 (SANS "orders_").
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "fulfillment_type_enum" AS ENUM ('DELIVERY','PICKUP','DINE_IN');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "transactions_paymentMethod_enum" AS ENUM
        ('orange_money','moov_money','telecel_money','wave','card','cash');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Valeurs déjà complètes (1723500000000 y ajoute 'refund_pending' si absent).
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "transactions_status_enum" AS ENUM
        ('pending','success','failed','refund_pending','refunded');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Valeurs déjà complètes (1723500000000 y ajoute 'BLOCKED' si absent).
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "merchant_payouts_status_enum" AS ENUM
        ('PENDING','PROCESSING','BLOCKED','SUCCESS','FAILED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "merchant_payouts_provider_enum" AS ENUM
        ('ORANGE_MONEY','MOOV_MONEY','WAVE','TELECEL_MONEY');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "financial_ledger_entryType_enum" AS ENUM ('DEBIT','CREDIT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "receipts_type_enum" AS ENUM
        ('TOPUP','ORDER_PAYMENT','DELIVERY_FEE','PAYOUT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "receipts_status_enum" AS ENUM ('PENDING','COMPLETED','FAILED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "reviews_targetType_enum" AS ENUM ('DRIVER','COURIER','BUSINESS');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // ────────────────────────────────────────────────────────────────────────
    // 3. TABLES (schéma exact des entités actuelles)
    // ────────────────────────────────────────────────────────────────────────
    // 3.1 users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fullName" varchar(100) NOT NULL,
        "email" varchar(150) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "mobileMoneyNumber" varchar(20) NULL,
        "mobileMoneyProvider" "users_mobileMoneyProvider_enum" NULL,
        "fcmToken" varchar(255) NULL,
        "avatarUrl" varchar(500) NULL,
        "preferredNotificationChannel" "users_preferredNotificationChannel_enum" NOT NULL DEFAULT 'EMAIL',
        "referralCode" varchar(16) NULL,
        "passwordHash" varchar(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'client',
        "isActive" boolean NOT NULL DEFAULT true,
        "banReason" text NULL,
        "bannedBy" uuid NULL,
        "bannedAt" timestamp NULL,
        "applicationStatus" varchar(20) NULL,
        "applicationType" varchar(20) NULL,
        "applicationData" jsonb NULL,
        "reviewedBy" uuid NULL,
        "reviewedAt" timestamp NULL,
        "rejectionReason" text NULL,
        "latitude" double precision NULL,
        "longitude" double precision NULL,
        "isOnline" boolean NOT NULL DEFAULT false,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "averageRating" double precision NULL,
        "vehicleType" varchar(20) NULL,
        "vehicleCategory" varchar(20) NULL,
        "hasAirConditioning" boolean NOT NULL DEFAULT false,
        "passwordResetToken" varchar(255) NULL,
        "passwordResetExpires" timestamp NULL,
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "isPhoneVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
      );
    `);

    // 3.2 businesses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(150) NOT NULL,
        "address" varchar(255) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "mobileMoneyNumber" varchar(20) NULL,
        "mobileMoneyProvider" "businesses_mobileMoneyProvider_enum" NULL,
        "ownerId" uuid NULL,
        "category" "business_category_enum" NOT NULL DEFAULT 'RESTAURANT',
        "enableDelivery" boolean NOT NULL DEFAULT true,
        "enablePickup" boolean NOT NULL DEFAULT true,
        "enableDineIn" boolean NOT NULL DEFAULT false,
        "hasOwnDrivers" boolean NOT NULL DEFAULT false,
        "location" geometry(Point,4326) NULL,
        "latitude" double precision NULL,
        "longitude" double precision NULL,
        "logo" varchar(255) NULL,
        "coverImage" varchar(255) NULL,
        "isOpen" boolean NOT NULL DEFAULT true,
        "brandId" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_businesses_id" PRIMARY KEY ("id")
      );
    `);

    // 3.3 orders — schéma complet de l'entité Order (cols ajoutées par les
    // migrations comprises, pour que leurs `ADD COLUMN IF NOT EXISTS` no-op).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" varchar(255) NOT NULL,
        "businessId" uuid NULL,
        "branchId" uuid NULL,
        "orderType" "orders_orderType_enum" NOT NULL DEFAULT 'MERCHANT',
        "fulfillmentType" "fulfillment_type_enum" NOT NULL DEFAULT 'DELIVERY',
        "rideOption" varchar(20) NULL,
        "fulfillmentDetails" jsonb NULL,
        "status" "orders_status_enum" NOT NULL DEFAULT 'PENDING',
        "productsSubtotal" numeric(10,2) NOT NULL DEFAULT 0,
        "deliveryFee" numeric(10,2) NOT NULL DEFAULT 0,
        "totalAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "platformCommission" numeric(10,2) NOT NULL DEFAULT 0,
        "merchantPayoutAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "itemsTotal" numeric(10,2) NOT NULL DEFAULT 0,
        "serviceFee" numeric(10,2) NOT NULL DEFAULT 0,
        "merchantCommissionAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "driverCommissionAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "promotionCode" varchar(32) NULL,
        "promotionDiscount" numeric(10,2) NOT NULL DEFAULT 0,
        "commissionPayer" varchar(255) NOT NULL DEFAULT 'CLIENT',
        "paymentMethod" varchar(255) NULL,
        "deliveryLocation" jsonb NULL,
        "landmark" varchar(255) NULL,
        "pickupLocation" jsonb NULL,
        "dropoffLocation" jsonb NULL,
        "packageDetails" jsonb NULL,
        "paymentTransactionRef" varchar(255) NULL,
        "deliveryPinCode" varchar(6) NULL,
        "driverValidatedAt" timestamp NULL,
        "clientValidatedAt" timestamp NULL,
        "driverId" varchar(255) NULL,
        "dispatchCandidates" jsonb NULL,
        "dispatchedAt" timestamp NULL,
        "qrCode" varchar(32) NULL,
        "payoutScheduledAt" timestamp NULL,
        "payoutReleased" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_orders_clientId" ON "orders" ("clientId");
      CREATE INDEX IF NOT EXISTS "IDX_orders_businessId" ON "orders" ("businessId");
      CREATE INDEX IF NOT EXISTS "IDX_orders_branchId" ON "orders" ("branchId");
      CREATE INDEX IF NOT EXISTS "IDX_orders_driverId" ON "orders" ("driverId");
      -- Index unique attendu par 1724200000000 (no-op) :
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_qr_code" ON "orders" ("qrCode");
    `);

    // 3.4 order_items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "productId" varchar(255) NOT NULL,
        "productName" varchar(255) NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "unitPrice" numeric(10,2) NOT NULL,
        "totalPrice" numeric(10,2) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId")
          REFERENCES "orders" ("id") ON DELETE CASCADE
      );
    `);

    // 3.5 products
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text NULL,
        "price" numeric(10,2) NOT NULL,
        "category" varchar(100) NOT NULL DEFAULT 'GÉNÉRAL',
        "type" varchar(100) NULL,
        "sku" varchar(100) NULL,
        "imageUrl" varchar(500) NULL,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "trackStock" boolean NOT NULL DEFAULT true,
        "stockQuantity" int NOT NULL DEFAULT 0,
        "minStockAlert" int NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_business" FOREIGN KEY ("businessId")
          REFERENCES "businesses" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_products_businessId" ON "products" ("businessId");
    `);

    // 3.6 transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" varchar(255) NOT NULL,
        "paymentGatewayId" varchar(255) NULL,
        "paymentMethod" "transactions_paymentMethod_enum" NOT NULL DEFAULT 'orange_money',
        "amount" numeric(10,2) NOT NULL,
        "commissionAmount" numeric(10,2) NOT NULL,
        "status" "transactions_status_enum" NOT NULL DEFAULT 'pending',
        "orderId" uuid NOT NULL,
        "processedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_transactions_order" FOREIGN KEY ("orderId")
          REFERENCES "orders" ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_transactions_orderId" ON "transactions" ("orderId");
    `);

    // 3.7 merchant_payouts — orderId est VARCHAR (entité). Pas de FK vers
    // orders(id) uuid (mismatch de types interdit par Postgres) ; l'unicité
    // est assurée par l'index UQ_merchant_payouts_orderId (1725200000000 no-op).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchant_payouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" varchar(255) NOT NULL,
        "businessId" varchar(255) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "status" "merchant_payouts_status_enum" NOT NULL DEFAULT 'PENDING',
        "provider" "merchant_payouts_provider_enum" NOT NULL,
        "recipientPhoneNumber" varchar(255) NOT NULL,
        "providerTransactionRef" varchar(255) NULL,
        "failureReason" text NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_merchant_payouts_id" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_merchant_payouts_orderId"
        ON "merchant_payouts" ("orderId");
      CREATE INDEX IF NOT EXISTS "IDX_merchant_payouts_businessId"
        ON "merchant_payouts" ("businessId");
    `);

    // 3.8 financial_ledger
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_ledger" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transactionRef" varchar(255) NOT NULL,
        "accountOwnerId" varchar(255) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "entryType" "financial_ledger_entryType_enum" NOT NULL,
        "description" varchar(255) NOT NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_financial_ledger_id" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_financial_ledger_transactionRef"
        ON "financial_ledger" ("transactionRef");
      CREATE INDEX IF NOT EXISTS "IDX_financial_ledger_accountOwnerId"
        ON "financial_ledger" ("accountOwnerId");
    `);

    // 3.9 receipts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "receiptNumber" varchar(40) NOT NULL,
        "type" "receipts_type_enum" NOT NULL,
        "status" "receipts_status_enum" NOT NULL DEFAULT 'COMPLETED',
        "amount" numeric(12,2) NOT NULL,
        "reference" varchar(255) NULL,
        "description" text NULL,
        "clientUserId" uuid NULL,
        "merchantUserId" uuid NULL,
        "driverUserId" uuid NULL,
        "businessId" uuid NULL,
        "walletTransactionId" uuid NULL,
        "orderId" uuid NULL,
        "balanceAfter" numeric(12,2) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_receipts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_receipts_receiptNumber" UNIQUE ("receiptNumber")
      );
      CREATE INDEX IF NOT EXISTS "IDX_receipts_receiptNumber" ON "receipts" ("receiptNumber");
      CREATE INDEX IF NOT EXISTS "IDX_receipts_reference" ON "receipts" ("reference");
      CREATE INDEX IF NOT EXISTS "IDX_receipts_clientUserId" ON "receipts" ("clientUserId");
      CREATE INDEX IF NOT EXISTS "IDX_receipts_merchantUserId" ON "receipts" ("merchantUserId");
      CREATE INDEX IF NOT EXISTS "IDX_receipts_driverUserId" ON "receipts" ("driverUserId");
    `);

    // 3.10 reviews
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" varchar(255) NOT NULL,
        "reviewerId" varchar(255) NOT NULL,
        "targetId" varchar(255) NOT NULL,
        "targetType" "reviews_targetType_enum" NOT NULL,
        "score" int NOT NULL,
        "comment" text NULL,
        "tipAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "tipPaid" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_order_target" UNIQUE ("orderId", "targetType")
      );
      CREATE INDEX IF NOT EXISTS "IDX_reviews_orderId" ON "reviews" ("orderId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordre inverse (les tables dépendantes d'abord)
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "financial_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchant_payouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "businesses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Enums (gardés : peuvent encore être référencés ailleurs)
    for (const type of [
      'reviews_targetType_enum',
      'receipts_status_enum',
      'receipts_type_enum',
      'financial_ledger_entryType_enum',
      'merchant_payouts_provider_enum',
      'merchant_payouts_status_enum',
      'transactions_status_enum',
      'transactions_paymentMethod_enum',
      'fulfillment_type_enum',
      'orders_orderType_enum',
      'orders_status_enum',
      'businesses_mobileMoneyProvider_enum',
      'business_category_enum',
      'users_preferredNotificationChannel_enum',
      'users_mobileMoneyProvider_enum',
      'users_role_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}"`);
    }

    // Extensions (postgis en dernier, CASCADE pour libérer les dépendances)
    await queryRunner.query(
      `DROP EXTENSION IF EXISTS "postgis" CASCADE`,
    );
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto";`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
  }
}