import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import dayjs from "dayjs";
import {
  AddUserAlertData,
  CIEvent,
  CINotificationWithUserAndEvent,
  CIRequestWithUser,
  CIUser,
  NotificationType,
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

  // TODO: delete pasted due alerts
  async cleanupAlerts() {
    try {
      // First get the alerts to be deleted
      const { data: alertsToDelete, error: fetchError } = await this.supabase
        .from("alerts")
        .select("id,viewed,ci_event_id(start_date)");

      if (fetchError) {
        console.error("Error fetching alerts to delete:", fetchError);
        throw fetchError;
      }

      if (!alertsToDelete?.length) {
        console.log("No alerts to clean up");
        return;
      }

      const alertIds = alertsToDelete
        .map((alert: any) => {
          if (alert.viewed) {
            return alert.id;
          }
          if (
            dayjs(alert.ci_event_id.start_date).isBefore(dayjs().startOf("day"))
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

      console.log(`Cleaned up ${alertsToDelete.length} alerts`);
    } catch (error) {
      console.error("Error in cleanupAlerts:", error);
      throw error;
    }
  }

  async cleanupNotifications() {
    try {
      // TODO: delete pasted due notifications
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
        .select(
          "user_id, push_notification_tokens,subscriptions,alerts(viewed)"
        )
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
          "*, ci_events!inner (title, start_date,segments),users!inner (user_id,push_notification_tokens, alerts (viewed),receive_notifications)"
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
          "*,users!inner (user_id,push_notification_tokens, alerts (viewed),receive_notifications)"
        )
        .eq("sent", false);
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
    const { userId, type, eventId, requestId } = data;
    try {
      const alertData = {
        user_id: userId,
        type,
        ...(type === NotificationType.response
          ? { request_id: requestId }
          : { ci_event_id: eventId }),
      };

      const { data, error } = await this.supabase
        .from("alerts")
        .insert(alertData);
      if (error) {
        console.error("Error adding user alert:", error);
        throw error;
      }
      console.log("addUserAlert.data", data);
    } catch (error) {
      console.error("Error adding user alert:", error);
      throw error;
    }
  }

  async setCIEventAsNotified(eventId: string) {
    console.log("setCIEventAsNotified.eventId", eventId);
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

  async setCIRequestAsSent(requestId: string) {
    try {
      await this.supabase
        .from("requests")
        .update({ sent: true })
        .eq("id", requestId);
    } catch (error) {
      console.error("Error setting CI request as sent:", error);
      throw error;
    }
  }
}

export const supabase = new Supabase();
