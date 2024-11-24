import {
  CIEvent,
  CIServerNotification,
  FirebaseMessage,
  NotificationType,
} from "./interface.js";
import { supabase } from "./Supabase";
import { sendMessage } from "./firebase-messages";
import { getEventListOfSubscribersData } from "./util.js";

const SUPSCRIPTION_BODY = "אירוע חדש";

const REMINDER_BODY = "תזכורת";

const RESPONSE_BODY = "תגובה לבקשה";

class Notifications {
  supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  async notifySubscribers() {
    const isNotificationEnabled = await this.supabase.isNotificationEnabled();
    if (!isNotificationEnabled) {
      return;
    }

    const users = await this.supabase.getListOfUsersWithNotificationsEnabled();
    const events: CIEvent[] = await this.supabase.getNewActiveEvents();
    for (const event of events) {
      const subscribersData = getEventListOfSubscribersData(
        users,
        event.segments
          .map((segment) => segment.teachers.map((teacher) => teacher.value))
          .flat()
          .filter(Boolean)
          .filter((teacher) => teacher !== ""),
        event.organisations.map((org) => org.value)
      );

      for (const subscriber of subscribersData) {
        await this.sendNotification({
          title: event.title,
          body: SUPSCRIPTION_BODY,
          token: subscriber.tokens[0],
          eventId: event.id,
          userId: event.user_id,
          unreadCount: subscriber.unreadCount,
          type: NotificationType.subscription,
        });
      }
    }
  }

  // async alertUsers() {
  //   const isNotificationEnabled = await this.supabase.isNotificationEnabled();
  //   if (!isNotificationEnabled) {
  //     return;
  //   }

  //   const notifications: CINotificationWithUserAndEvent[] =
  //     await this.supabase.getUnfulfilledDueNotifications();

  //   for (const notification of notifications) {
  //     await this.sendNotification({
  //       title: notification.ci_events.title,
  //       body: REMINDER_BODY,
  //       token: notification.users.push_notification_tokens,
  //       eventId: notification.ci_events.id,
  //       userId: notification.users.user_id,
  //       unreadCount: notification.unread_count,
  //     });
  //   }
  // }

  async sendNotification({
    title,
    body,
    token,
    eventId,
    userId,
    unreadCount,
    type,
  }: CIServerNotification): Promise<any> {
    await this.supabase.addUserAlert(userId, eventId, type);

    const url = "/event/" + eventId;

    const message = {
      data: {
        title: title,
        body: body,
        url: url,
        eventId: eventId,
        click_action: url,
        badge: unreadCount.toString(),
      },
      webpush: {
        headers: {
          link: url,
        },
        fcm_options: {
          link: url,
        },
        notification: {
          click_action: url,
        },
      },
      token: token,
    };

    return await sendMessage(message);
  }
}

export const notifications = new Notifications();
