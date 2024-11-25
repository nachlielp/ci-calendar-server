import admin from "firebase-admin";
import dotenv from "dotenv";

interface MessageResponse {
  success: boolean;
  messageId: string | null;
  data: any; // or you can be more specific with `admin.messaging.MessagingError`
}

dotenv.config();

const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY_BASE64;

if (!serviceAccountKey) {
  throw new Error("SERVICE_ACCOUNT_KEY_BASE64 environment variable is not set");
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountKey, "base64").toString("utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export async function sendMessage(
  message: admin.messaging.Message
): Promise<MessageResponse> {
  return admin
    .messaging()
    .send(message)
    .then((response) => {
      return {
        success: true,
        messageId: response,
        data: response,
      };
    })
    .catch((error) => {
      return {
        success: false,
        messageId: null,
        data: error,
      };
    });
}
