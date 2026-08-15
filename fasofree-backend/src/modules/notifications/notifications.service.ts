import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<boolean> {
    if (!fcmToken) return false;

    try {
      if (getApps().length > 0) {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
        });
      }
      return true;
    } catch (error) {
      this.logger.error("Échec d'envoi notification FCM:", error);
      return false;
    }
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    try {
      if (getApps().length > 0) {
        await getMessaging().send({
          topic,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`Échec d'envoi vers le topic ${topic}:`, error);
      return false;
    }
  }
}
