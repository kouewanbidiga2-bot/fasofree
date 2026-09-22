import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFkNotificationsAndIndex1728000000000 implements MigrationInterface {
  name = 'AddFkNotificationsAndIndex1728000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Convertir orderId de varchar → uuid
    await queryRunner.query(`
      ALTER TABLE notifications
      ALTER COLUMN "orderId" TYPE UUID USING "orderId"::uuid
    `);

    // 2. FK userId → users(id) ON DELETE CASCADE
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_user
      FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
    `);

    // 3. FK orderId → orders(id) ON DELETE SET NULL
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_order
      FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE SET NULL
    `);

    // 4. Supprimer l'index redondant (composite userId+isRead le couvre déjà)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notifications_user_id"
    `);

    // 5. Index composite pour ORDER BY createdAt DESC
    await queryRunner.query(`
      CREATE INDEX "idx_notifications_user_created"
      ON notifications ("userId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_created"`);
    await queryRunner.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_order`);
    await queryRunner.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_user`);
    await queryRunner.query(`
      ALTER TABLE notifications
      ALTER COLUMN "orderId" TYPE VARCHAR
    `);
  }
}
