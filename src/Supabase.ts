import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import dayjs from "dayjs";
import {
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
        .select("flag")
        .eq("title", env_notification_flag)
        .single();

      if (error) {
        console.error("Error checking notification flag:", error);
        return false;
      }

      const flag = data.flag;

      return flag;
    } catch (error) {
      console.error("Error checking notification flag:", error);
      throw error;
    } finally {
      return false;
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
    } finally {
      return [] as CIEvent[];
    }
  }

  async getListOfUsersWithNotificationsEnabled() {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("user_id")
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
    } finally {
      return [];
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
    } finally {
      return [] as CINotificationWithUserAndEvent[];
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
    } finally {
      return [];
    }
  }

  async addUserAlert(
    userId: string,
    type: NotificationType,
    eventId?: string,
    requestId?: string
  ) {
    try {
      const alertData = {
        user_id: userId,
        type,
        ...(type === NotificationType.response
          ? { request_id: requestId }
          : { ci_event_id: eventId }),
      };

      await this.supabase.from("alerts").insert(alertData);
    } catch (error) {
      console.error("Error adding user alert:", error);
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
