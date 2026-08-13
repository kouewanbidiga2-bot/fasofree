import * as Sentry from '@sentry/nestjs';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    // Taux d'échantillonnage des traces (1.0 = 100% en dev, ajuster à 0.2 en prod)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  console.log('✅ SDK Sentry initialisé pour le monitoring en temps réel.');
} else {
  console.log(
    '⚠️ SENTRY_DSN non renseigné. Le monitoring Sentry est désactivé.',
  );
}
