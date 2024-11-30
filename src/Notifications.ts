import {
  CIEvent,
  CINotificationWithUserAndEvent,
  CIRequestWithUser,
  CIServerNotification,
  NotificationType,
} from "./interface";
import { supabase } from "./Supabase";
import { sendMessage } from "./firebase-messages";
import { getEventListOfSubscribersData } from "./util";

const SUPSCRIPTION_BODY = "אירוע חדש";

const REMINDER_BODY = "תזכורת";

const RESPONSE_BODY = "תגובה לבקשה";

const RESPONSE_TITLE = "תגובה לבקשה";

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
            requestId: "",
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
      this.supabase.setCIEventsAsNotified(events.map((e: CIEvent) => e.id));
    }
  }

  async dueNotifications() {
    const notifications: CINotificationWithUserAndEvent[] =
      await this.supabase.getUnfulfilledDueNotifications();

    const notificationIds = notifications.map((n) => n.id);

    const formattedNotifications: CIServerNotification[] = notifications.map(
      (notification) => {
        const unreadCount = notification.users.alerts.filter(
          (alert) => !alert.viewed
        ).length;

        return {
          title: notification.ci_events.title,
          body: REMINDER_BODY,
          token: notification.users.push_notification_tokens[0].token,
          eventId: notification.ci_event_id,
          userId: notification.user_id,
          unreadCount: unreadCount,
          type: NotificationType.reminder,
          requestId: "",
        };
      }
    );

    const results = await Promise.allSettled(
      formattedNotifications.map((notification) => {
        return this.sendNotification(notification);
      })
    );

    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length) {
      //TODO report error
      console.error(
        `Failed to send ${failures.length} notifications:`,
        failures
      );
    }
    await this.supabase.setNotificationsAsSent(notificationIds);
  }

  async responseNotifications() {
    const requests: CIRequestWithUser[] =
      await this.supabase.getUnfulfilledRequestNotifications();

    const formattedRequests: CIServerNotification[] = requests.map(
      (request) => {
        const unreadCount = request.user.alerts.filter(
          (alert) => !alert.viewed
        ).length;
        return {
          title: RESPONSE_TITLE,
          body: RESPONSE_BODY,
          token: request.user.push_notification_tokens[0]?.token,
          eventId: "",
          userId: request.user_id,
          unreadCount: unreadCount,
          type: NotificationType.response,
          requestId: request.id,
        };
      }
    );

    const results = await Promise.allSettled(
      formattedRequests.map((request) => {
        return this.sendNotification(request);
      })
    );

    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length) {
      //TODO report error
      console.error(
        `Failed to send ${failures.length} notifications:`,
        failures
      );
    }

    await this.supabase.setRequestAlertsAsNotViewed(requests.map((r) => r.id));
  }

  async sendNotification({
    title,
    body,
    token,
    eventId,
    userId,
    unreadCount,
    type,
    requestId,
  }: CIServerNotification): Promise<any> {
    if (
      type === NotificationType.reminder ||
      type === NotificationType.subscription
    ) {
      await this.supabase.addUserAlert({
        userId,
        type,
        eventId,
        requestId: "",
      });
    } else if (type === NotificationType.response) {
      await this.supabase.addUserAlert({
        userId,
        type,
        eventId: "",
        requestId,
      });
    }

    //Create alerts but don't send if no token
    if (!token) {
      return;
    }

    let url = "";

    if (
      type === NotificationType.reminder ||
      type === NotificationType.subscription
    ) {
      url = "/event/" + eventId;
    } else if (type === NotificationType.response) {
      url = "/request/" + requestId;
    }

    const message = {
      data: {
        title: title,
        body: body,
        url: url,
        eventId: eventId,
        requestId: requestId,
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
