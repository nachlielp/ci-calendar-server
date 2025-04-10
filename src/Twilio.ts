import dotenv from "dotenv";
import { Twilio as TwilioClient } from "twilio";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { tryCatch } from "./tryCatch";
dotenv.config();

class Twilio {
  private client: TwilioClient;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio credentials are not set");
    }

    this.client = new TwilioClient(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async sendText(to: string, body: string): Promise<MessageInstance> {
    const result = await tryCatch(
      this.client.messages.create({
        from: `whatsapp:${this.fromNumber}`,
        to: `${to}`,
        body,
      })
    );

    if (result.error) {
      throw new Error(`Failed to send WhatsApp text: ${result.error}`);
    }

    return result.data;
  }

  async sendTemplate(
    to: string,
    contentSid: string,
    contentVariables: Record<string, string> = {}
  ): Promise<MessageInstance> {
    if (!contentSid) {
      throw new Error("sendTemplate.Twilio template is not set");
    }

    const result = await tryCatch(
      this.client.messages.create({
        from: `whatsapp:${this.fromNumber}`,
        to: `${to}`,
        contentSid,
        contentVariables: JSON.stringify(contentVariables),
      })
    );

    if (result.error) {
      throw new Error(`Failed to send first question: ${result.error}`);
    }

    return result.data;
  }
}

export const twilio = new Twilio();
