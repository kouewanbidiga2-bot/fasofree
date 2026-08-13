import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('Mise à jour des rôles ENUM dans PostgreSQL...');
    // Note : PostgreSQL nécessite que ces requêtes soient hors transaction
    await dataSource.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'admin';`,
    );
    await dataSource.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'support';`,
    );
    console.log('✅ Succès : Les rôles "admin" et "support" ont été ajoutés !');
  } catch (error) {
    console.error('❌ Erreur :', error.message);
  } finally {
    await app.close();
  }
}

run();
