import { CIEvent, CIServerNotification, NotificationType } from "./interface";
import { supabase } from "./Supabase";
import { sendMessage } from "./firebase-messages";
import { getEventListOfSubscribersData } from "./util";

const SUPSCRIPTION_BODY = "אירוע חדש";

const REMINDER_BODY = "תזכורת";

const RESPONSE_BODY = "תגובה לבקשה";

class Notifications {
  supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  async notifySubscribers() {
    const [users, events] = await Promise.all([
      this.supabase.getListOfUsersWithNotificationsEnabled(),
      this.supabase.getNewActiveEvents(),
    ]);
    for (const event of events) {
      const subscribersData = getEventListOfSubscribersData(
        users,
        event.segments
          .map((segment: any) =>
            segment.teachers.map((teacher: any) => teacher.value)
          )
          .flat()
          .filter(Boolean)
          .filter((teacher: any) => teacher !== ""),
        event.organisations.map((org: any) => org.value)
      );

      const results = await Promise.allSettled(
        subscribersData.map((subscriber) =>
          this.sendNotification({
            title: event.title,
            body: SUPSCRIPTION_BODY,
            token: subscriber.tokens[0],
            eventId: event.id,
            userId: event.user_id,
            unreadCount: subscriber.unreadCount,
            type: NotificationType.subscription,
          })
        )
      );

      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length) {
        //TODO report error
        console.error(
          `Failed to send ${failures.length} notifications:`,
          failures
        );
      }
      // TODO: uncomment
      this.supabase.setCIEventsAsNotified(events.map((e: CIEvent) => e.id));
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
    await this.supabase.addUserAlert({ userId, type, eventId, requestId: "" });

    const url = "/event/" + eventId;

    const message = {
      data: {
        title: title,
        body: body,
        url: url,
        eventId: eventId,
        click_action: url,
        badge: (unreadCount + 1).toString(),
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

    console.log("sendNotification.message", message);
    return await sendMessage(message);
  }
}

export const notifications = new Notifications();
