import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';

@Injectable()
export class FirebaseAdminProvider implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminProvider.name);
  static app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    if (getApps().length > 0) {
      FirebaseAdminProvider.app = getApps()[0];
      this.logger.log('[Firebase] SDK déjà initialisé (singleton)');
      return;
    }

    // 1. Priorité : FIREBASE_SERVICE_ACCOUNT_JSON (JSON complet)
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        FirebaseAdminProvider.app = initializeApp({
          credential: cert(serviceAccount),
        });
        this.logger.log('[Firebase] SDK initialisé via FIREBASE_SERVICE_ACCOUNT_JSON');
        return;
      } catch (error) {
        this.logger.error('[Firebase] Échec parsing FIREBASE_SERVICE_ACCOUNT_JSON:', error.message);
      }
    }

    // 2. Fallback : variables individuelles (FIREBASE_PROJECT_ID, etc.)
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('[Firebase] Clés Firebase non configurées — push notifications désactivées');
      return;
    }

    try {
      FirebaseAdminProvider.app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log('[Firebase] SDK initialisé via variables individuelles');
    } catch (error) {
      this.logger.error('[Firebase] Échec initialisation Firebase:', error);
    }
  }
}
