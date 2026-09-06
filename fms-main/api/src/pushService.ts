import webpush, { PushSubscription as WebPushSubscription } from 'web-push';

export interface PushNotificationPayload {
  title: string;
  body: string;
  alertType?: string;
  flightNumber?: string;
  metadata?: any;
  url?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  tag?: string;
}

export interface StoredSubscription {
  id?: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_info?: string;
}

class PushService {
  private initialized = false;

  public initVapid(publicKey: string, privateKey: string, subject: string = 'mailto:admin@macl.aero') {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.initialized = true;
      console.log('[PushService] VAPID details initialized successfully.');
    } catch (error) {
      console.error('[PushService] Failed to initialize VAPID details:', error);
    }
  }

  public isReady(): boolean {
    return this.initialized;
  }

  public async sendNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; statusCode?: number; error?: string; shouldRemove?: boolean }> {
    if (!this.initialized) {
      return { success: false, error: 'Push service not initialized with VAPID keys' };
    }

    const pushSubscription: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    const notificationPayload = JSON.stringify(payload);
    const options: webpush.RequestOptions = {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: payload.urgency || 'high'
    };

    try {
      const response = await webpush.sendNotification(pushSubscription, notificationPayload, options);
      return { success: true, statusCode: response.statusCode };
    } catch (err: any) {
      const statusCode = err.statusCode || err.status;
      const isExpired = statusCode === 410 || statusCode === 404;
      return {
        success: false,
        statusCode,
        error: err.message || 'Send push failed',
        shouldRemove: isExpired
      };
    }
  }

  public async sendBatch(
    subscriptions: StoredSubscription[],
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number; invalidEndpoints: string[] }> {
    let sent = 0;
    let failed = 0;
    const invalidEndpoints: string[] = [];

    const promises = subscriptions.map(async (sub) => {
      const res = await this.sendNotification(sub, payload);
      if (res.success) {
        sent++;
      } else {
        failed++;
        if (res.shouldRemove) {
          invalidEndpoints.push(sub.endpoint);
        }
      }
    });

    await Promise.allSettled(promises);
    return { sent, failed, invalidEndpoints };
  }
}

export const pushService = new PushService();
