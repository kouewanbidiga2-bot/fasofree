import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBusinessOwnerId1722200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('businesses');
    if (table && !table.findColumnByName('ownerId')) {
      await queryRunner.addColumn(
        'businesses',
        new TableColumn({ name: 'ownerId', type: 'uuid', isNullable: true }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('businesses');
    if (table?.findColumnByName('ownerId')) {
      await queryRunner.dropColumn('businesses', 'ownerId');
    }
  }
}
