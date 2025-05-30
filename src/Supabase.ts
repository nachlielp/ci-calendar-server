import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import dayjs from "dayjs";
import {
  AddUserAlertData,
  CIEvent,
  CINotificationWithUserAndEvent,
  CIRequest,
  CIRequestWithUser,
  CIUser,
  NotificationType,
  UserType,
  WAUser,
} from "./interface";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ACCOUNT_KEY;

class Supabase {
  supabase: any;

  constructor() {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials are not set");
    }
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async isNotificationEnabled(): Promise<boolean> {
    const env_notification_flag = process.env.ENV_NOTIFICATION_FLAG;

    try {
      const { data, error } = await this.supabase
        .from("config")
        .select("*")
        .eq("title", env_notification_flag)
        .single();

      if (error) {
        console.error("Error checking notification flag:", error);
        return false;
      }

      const flag = data.flag;
      return flag;
    } catch (error) {
      // TODO: handle error
      console.error("Error checking notification flag:", error);
      return false;
    }
  }

  //Cleanup viewed alerts and those that are regarding events that have already started
  async cleanupAlerts() {
    try {
      const { data: alertsToDelete, error: fetchError } = await this.supabase
        .from("alerts")
        .select(
          "id,viewed,ci_event_id,ci_events(start_date),request_id,requests(to_send)"
        );

      if (fetchError) {
        console.error("Error fetching alerts to delete:", fetchError);
        throw fetchError;
      }

      if (!alertsToDelete || !alertsToDelete?.length) {
        console.log("No alerts to clean up");
        return;
      }

      const alertIds = alertsToDelete
        .map((alert: any) => {
          if (alert.viewed) {
            return alert.id;
          }
          if (alert.request_id && alert.requests["to_send"]) {
            return alert.id;
          }

          if (
            alert.ci_event_id &&
            dayjs(alert.ci_events["start_date"])
              .startOf("day")
              .isBefore(dayjs().startOf("day"))
          ) {
            return alert.id;
          }
          return null;
        })
        .filter((id: string | null) => id !== null);

      const { error: deleteError } = await this.supabase
        .from("alerts")
        .delete()
        .in("id", alertIds);

      if (deleteError) {
        console.error("Error deleting alerts:", deleteError);
        throw deleteError;
      }

      console.log(`Cleaned up ${alertIds.length} alerts`);
    } catch (error) {
      console.error("Error in cleanupAlerts:", error);
      throw error;
    }
  }

  async cleanupNotifications() {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select("id,ci_event_id(start_date)");

      if (error) {
        console.error("Error fetching notifications to delete:", error);
        throw error;
      }
      const pastedDueNotificationIds = data
        .filter((notification: any) => {
          return dayjs(notification.ci_event_id.start_date).isBefore(
            dayjs().startOf("day")
          );
        })
        .map((notification: any) => notification.id);

      const { error: deleteError } = await this.supabase
        .from("notifications")
        .delete()
        .in("id", pastedDueNotificationIds);

      if (deleteError) {
        console.error("Error deleting notifications:", deleteError);
        throw deleteError;
      }
      //TODO: add logging
      console.log(
        `Cleaned up ${pastedDueNotificationIds.length} notifications`
      );
    } catch (error) {
      console.error("Error in cleanupNotifications:", error);
      throw error;
    }
  }

  async getNewActiveEvents(): Promise<CIEvent[]> {
    try {
      const { data, error } = await this.supabase
        .from("ci_events")
        .select("*")
        .gte("start_date", dayjs().format("YYYY-MM-DD"))
        .eq("hide", false)
        .eq("cancelled", false)
        .eq("is_notified", false);

      if (error) {
        console.error("Error getting new active events:", error);
        throw error;
      }

      return data as CIEvent[];
    } catch (error) {
      console.error("Error getting new active events:", error);
      throw error;
    }
  }

  async getListOfUsersWithNotificationsEnabled() {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("id, fcm_token,subscriptions,alerts(viewed)")
        .eq("receive_notifications", true);

      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      console.error(
        "Error getting list of users with notifications enabled:",
        error
      );
      throw error;
    }
  }

  async getUnfulfilledDueNotifications(): Promise<
    CINotificationWithUserAndEvent[]
  > {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select(
          "*, ci_events!inner (title, start_date,segments,is_multi_day),users!inner (id,fcm_token, alerts (viewed),receive_notifications)"
        )
        .eq("sent", false)
        .eq("ci_events.hide", false)
        .eq("ci_events.cancelled", false)
        .eq("users.alerts.viewed", false)
        .eq("users.receive_notifications", true)
        .gte(
          "ci_events.start_date",
          dayjs().startOf("day").format("YYYY-MM-DD")
        )
        .lte(
          "ci_events.start_date",
          dayjs().add(7, "day").endOf("day").format("YYYY-MM-DD")
        );

      if (error) {
        console.error("Error getting unfifilled due notifications:", error);
        throw error;
      }
      return data as CINotificationWithUserAndEvent[];
    } catch (error) {
      console.error("Error getting all unfifilled due notifications:", error);
      throw error;
    }
  }

  async getUnfulfilledRequestNotifications(): Promise<CIRequestWithUser[]> {
    try {
      const { data, error } = await this.supabase
        .from("requests")
        .select(
          "*,user:users!inner (id,fcm_token, alerts (viewed),receive_notifications)"
        )
        .eq("to_send", true);

      if (error) {
        console.error("Error getting unfifilled request notifications:", error);
        throw error;
      }
      return data as CIRequestWithUser[];
    } catch (error) {
      console.error(
        "Error getting all unfifilled request notifications:",
        error
      );
      throw error;
    }
  }

  async addUserAlert(data: AddUserAlertData) {
    const { userId, type, eventId, requestId, title } = data;
    console.log("__data", data);
    try {
      const alertData = {
        user_id: userId,
        type,
        ...(type === NotificationType.response
          ? { request_id: requestId }
          : type === NotificationType.reminder
          ? { ci_event_id: eventId }
          : {}),
        title,
      };

      const { data, error } = await this.supabase
        .from("alerts")
        .insert(alertData)
        .select();

      console.log("added alert", alertData);
      if (error) {
        console.error("Error adding user alert:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error adding user alert:", error);
      throw error;
    }
  }

  async setNotificationsAsSent(notificationIds: string[]) {
    try {
      await this.supabase
        .from("notifications")
        .update({ sent: true })
        .in("id", notificationIds);
    } catch (error) {
      console.error("Error setting notifications as sent:", error);
      throw error;
    }
  }

  async setCIEventAsNotified(eventId: string) {
    try {
      await this.supabase
        .from("ci_events")
        .update({ is_notified: true })
        .eq("id", eventId);
    } catch (error) {
      console.error("Error setting CI event as notified:", error);
      throw error;
    }
  }

  async setCIEventsAsNotified(eventIds: string[]) {
    try {
      await this.supabase
        .from("ci_events")
        .update({ is_notified: true })
        .in("id", eventIds);
    } catch (error) {
      console.error("Error setting CI events as notified:", error);
      throw error;
    }
  }

  async setRequestAlertsAsNotViewed(requestIds: string[]) {
    try {
      await this.supabase
        .from("requests")
        .update({ sent: true, to_send: false, viewed: false })
        .in("id", requestIds);
    } catch (error) {
      console.error("Error setting alerts as viewed:", error);
      throw error;
    }
  }

  async getAdminUsers() {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("id,fcm_token,alerts(viewed)")
        .eq("receive_notifications", true)
        .eq("user_type", UserType.admin);

      if (error) {
        console.error("Error getting admin users:", error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error getting admin users:", error);
      throw error;
    }
  }

  async getNewRequests(): Promise<CIRequest[]> {
    try {
      const { data, error } = await this.supabase
        .from("requests")
        .select("*")
        .or("admins_notified.is.null,admins_notified.eq.false");

      if (error) {
        console.error("Error getting new requests:", error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error getting new requests:", error);
      throw error;
    }
  }

  async setRequestsAsAdminsNotified(requestIds: string[]) {
    try {
      await this.supabase
        .from("requests")
        .update({ admins_notified: true })
        .in("id", requestIds);
    } catch (error) {
      console.error("Error setting requests as admins notified:", error);
      throw error;
    }
  }

  async getCIEventById(id: string) {
    try {
      const { data, error } = await this.supabase
        .from("ci_events")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error getting CI event by id:", error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error getting CI event by id:", error);
      throw error;
    }
  }

  async getAllFutureEvents() {
    try {
      const { data, error } = await this.supabase
        .from("ci_events")
        .select("*")
        .gte("start_date", dayjs().format("YYYY-MM-DD"));

      if (error) {
        console.error("Error getting all future events:", error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error getting all future events:", error);
      throw error;
    }
  }

  async updateCIEvent(ciEvent: CIEvent) {
    try {
      await this.supabase
        .from("ci_events")
        .update(ciEvent)
        .eq("id", ciEvent.id);
    } catch (error) {
      console.error("Error updating CI event title:", error);
      throw error;
    }
  }

  async getWAUsers() {
    try {
      const { data, error } = await this.supabase
        .from("wa_users")
        .select("*")
        .eq("is_subscribed", true);

      if (error) {
        console.error("Error getting WA users:", error);
        throw error;
      }
      if (!data) {
        return [];
      }
      return data as WAUser[];
    } catch (error) {
      console.error("Error getting WA users:", error);
      throw error;
    }
  }

  async getThisWeekCIEvents() {
    const today = dayjs();

    const currentDay = today.day();

    const daysToSaturday = currentDay === 6 ? 0 : 6 - currentDay;

    const formDate = today.format("YYYY-MM-DD");

    const toDate = dayjs(formDate)
      .add(daysToSaturday, "day")
      .format("YYYY-MM-DD");

    try {
      const { data, error } = await this.supabase
        .from("ci_events")
        .select("id,district,title")
        .gte("start_date", formDate)
        .lte("start_date", toDate)
        .not("hide", "is", true)
        .not("cancelled", "is", true);

      if (error) {
        console.error("Error getting this week CI events:", error);
        throw error;
      }
      return data as { id: string; district: string; title: string }[];
    } catch (error) {
      console.error("Error getting this week CI events:", error);
      throw error;
    }
  }

  async logTwilioResult(
    twilioResult: object,
    userId: string,
    from: string,
    to: string
  ) {
    try {
      const result = await this.supabase.from("wa_twilio_logs").insert({
        result: twilioResult,
        wa_users_id: userId,
        trigger: "cron_job",
        from,
        to,
      });
      return result.data;
    } catch (e) {
      console.error("Error logging twilio result:", e);
      throw new Error("Error logging twilio result");
    }
  }
}

export const supabase = new Supabase();
