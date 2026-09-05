import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderChatMessages1725600000000 implements MigrationInterface {
  name = 'create-order-chat-messages-1725600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_chat_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderId" varchar NOT NULL,
        "senderId" varchar NOT NULL,
        "senderRole" varchar NOT NULL,
        "channel" varchar(20) NOT NULL,
        "message" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_chat_orderId" ON "order_chat_messages"("orderId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_chat_senderId" ON "order_chat_messages"("senderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_chat_messages"`);
  }
}
