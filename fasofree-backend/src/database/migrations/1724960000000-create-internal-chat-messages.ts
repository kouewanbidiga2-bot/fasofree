import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInternalChatMessages1724960000000 implements MigrationInterface {
  name = 'create-internal-chat-messages-1724960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "internal_chat_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "channel" varchar(30) NOT NULL,
        "recipientId" uuid,
        "senderId" uuid NOT NULL,
        "message" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_internal_msg_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id"),
        CONSTRAINT "FK_internal_msg_recipient" FOREIGN KEY ("recipientId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_internal_msg_channel" ON "internal_chat_messages"("channel")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_internal_msg_sender" ON "internal_chat_messages"("senderId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_internal_msg_recipient" ON "internal_chat_messages"("recipientId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "internal_chat_messages"`);
  }
}
