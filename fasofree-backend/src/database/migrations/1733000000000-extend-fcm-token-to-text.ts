import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Étend la colonne fcmToken de varchar(255) vers TEXT.
 * Les tokens FCM web (VAPID) peuvent dépasser 255 caractères.
 */
export class ExtendFcmTokenToText1733000000000 implements MigrationInterface {
  name = 'ExtendFcmTokenToText1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "fcmToken" TYPE text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "fcmToken" TYPE varchar(255)`);
  }
}