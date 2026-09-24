import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeVehicleTypes1724800000000 implements MigrationInterface {
  name = 'NormalizeVehicleTypes1724800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard : vehicleType peut manquer sur une base issue d'une entité plus ancienne.
    const col = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'vehicleType'
    `);
    if (col.length === 0) return;

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
