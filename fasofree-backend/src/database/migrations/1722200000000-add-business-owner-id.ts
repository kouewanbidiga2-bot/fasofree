/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
