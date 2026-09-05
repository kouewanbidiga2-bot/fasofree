import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoriesTables1725700000000 implements MigrationInterface {
  name = 'CreateStoriesTables1725700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "businessId" UUID NOT NULL,
        "createdById" UUID,
        "mediaUrl" VARCHAR(500) NOT NULL,
        "mediaType" VARCHAR(20) DEFAULT 'IMAGE',
        caption VARCHAR(280),
        "viewsCount" INT DEFAULT 0,
        "likesCount" INT DEFAULT 0,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE stories ADD CONSTRAINT FK_stories_business
          FOREIGN KEY ("businessId") REFERENCES businesses(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE stories ADD CONSTRAINT FK_stories_createdBy
          FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_stories_business_expires
        ON stories ("businessId", "expiresAt");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS story_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "storyId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "viewedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE ("storyId", "userId")
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE story_views ADD CONSTRAINT FK_story_views_story
          FOREIGN KEY ("storyId") REFERENCES stories(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE story_views ADD CONSTRAINT FK_story_views_user
          FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS story_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "storyId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "likedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE ("storyId", "userId")
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE story_likes ADD CONSTRAINT FK_story_likes_story
          FOREIGN KEY ("storyId") REFERENCES stories(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE story_likes ADD CONSTRAINT FK_story_likes_user
          FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS story_likes;`);
    await queryRunner.query(`DROP TABLE IF EXISTS story_views;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stories;`);
  }
}
