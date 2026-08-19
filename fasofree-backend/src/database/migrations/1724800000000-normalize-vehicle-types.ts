import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeVehicleTypes1724800000000 implements MigrationInterface {
  name = 'NormalizeVehicleTypes1724800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize old values to new standard values
    await queryRunner.query(`
      UPDATE users SET "vehicleType" = 'MOTORCYCLE' WHERE UPPER("vehicleType") IN ('MOTO', 'SCOOTER')
    `);
    await queryRunner.query(`
      UPDATE users SET "vehicleType" = 'BICYCLE' WHERE UPPER("vehicleType") IN ('VELO', 'PIED', 'FOOT')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op - the old values are lost
  }
}
