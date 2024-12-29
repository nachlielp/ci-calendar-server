import {
  CIEvent,
  CINotificationWithUserAndEvent,
  CIRequest,
  CIRequestWithUser,
  CIServerNotification,
  NotificationType,
} from "./interface";
import { supabase } from "./Supabase";
import { sendMessage } from "./firebase-messages";
import { getEventListOfSubscribersData } from "./util";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault("Asia/Jerusalem");

const SUPSCRIPTION_BODY = "אירוע חדש";

const REMINDER_BODY = "תזכורת";

const RESPONSE_BODY = "תגובה לבקשה";

const RESPONSE_TITLE = "תגובה לבקשה";

const ADMIN_NOTIFICATION_TITLE = "בקשה חדשה";

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
            token: subscriber.token,
            eventId: event.id,
            requestId: "",
            userId: event.user_id,
            unreadCount: subscriber.unreadCount,
            type: NotificationType.subscription,
          })
        )
      );

      const failures = results?.filter((r) => r.status === "rejected");

      //TODO: add logging
      console.log(
        `Sent ${events.length} notifications, ${failures.length} failures`
      );
      this.supabase.setCIEventsAsNotified(events.map((e: CIEvent) => e.id));
    }
  }

  async dueNotifications() {
    const notifications: CINotificationWithUserAndEvent[] =
      await this.supabase.getUnfulfilledDueNotifications();

    const filteredNotifications = notifications.filter((n) => {
      const startDate = dayjs(n.ci_events.start_date);
      if (n.ci_events.is_multi_day) {
        const targetDate = startDate.subtract(
          parseInt(n.remind_in_hours),
          "hours"
        );
        return targetDate.isBefore(dayjs());
      }
      const startHour = dayjs(n.ci_events.segments[0].startTime).hour();
      const startTime = startDate.hour(startHour);
      const targetDate = startTime.subtract(
        parseInt(n.remind_in_hours),
        "hours"
      );

      return targetDate.isBefore(dayjs());
    });

    const notificationIds = filteredNotifications.map((n) => n.id);

    const formattedNotifications: CIServerNotification[] =
      filteredNotifications.map((notification) => {
        const unreadCount = notification.users.alerts.filter(
          (alert) => !alert.viewed
        ).length;

        return {
          title: notification.ci_events.title,
          body: REMINDER_BODY,
          token: notification.users.fcm_token,
          eventId: notification.ci_event_id,
          userId: notification.user_id,
          unreadCount: unreadCount,
          type: NotificationType.reminder,
          requestId: "",
        };
      });

    const results = await Promise.allSettled(
      formattedNotifications.map((notification) => {
        return this.sendNotification(notification);
      })
    );

    const failures = results.filter((r) => r.status === "rejected");

    //TODO: add logging
    console.log(
      `Sent ${filteredNotifications.length} due notifications, ${failures.length} failures`
    );
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
          token: request.user.fcm_token,
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

    //TODO: add logging
    console.log(
      `Sent ${requests.length} response notifications, ${failures.length} failures`
    );

    await this.supabase.setRequestAlertsAsNotViewed(requests.map((r) => r.id));
  }

  async notifyAdminsOfNewRequests() {
    const admins = await this.supabase.getAdminUsers();
    const requests: CIRequestWithUser[] = await this.supabase.getNewRequests();

    const requestsData = requests.map((request: CIRequest) => {
      return {
        title: ADMIN_NOTIFICATION_TITLE,
        body: "בקשה מאת " + request.name,
      };
    });

    let formattedRequests = [];

    for (const admin of admins) {
      let openAlerts = 0;
      for (const alert of admin.alerts) {
        if (!alert.viewed) {
          openAlerts++;
        }
      }
      for (const request of requestsData) {
        openAlerts++;
        formattedRequests.push({
          title: request.title,
          body: request.body,
          token: admin.fcm_token,
          userId: admin.id,
          unreadCount: openAlerts,
          type: NotificationType.admin_response,
          requestId: "",
          eventId: "",
        });
      }
    }

    const results = await Promise.allSettled(
      formattedRequests.map((request) => {
        return this.sendNotification(request);
      })
    );

    const failures = results.filter((r) => r.status === "rejected");

    //TODO: add logging
    console.log(
      `Sent ${requests.length} response notifications, ${failures.length} failures`
    );

    await this.supabase.setRequestsAsAdminsNotified(requests.map((r) => r.id));
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
        title,
      });
    } else if (type === NotificationType.response) {
      await this.supabase.addUserAlert({
        userId,
        type,
        eventId: "",
        requestId,
        title: "",
      });
    } else if (type === NotificationType.admin_response) {
      await this.supabase.addUserAlert({
        userId,
        type,
        eventId: "",
        requestId: "",
        title: body,
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

    return await sendMessage(message);
  }
}

export const notifications = new Notifications();
