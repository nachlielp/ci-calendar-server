import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = JSON.parse(
  Buffer.from(process.env.SERVICE_ACCOUNT_KEY_BASE64, "base64").toString(
    "utf-8"
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export async function sendMessage(message) {
  return admin
    .messaging()
    .send(message)
    .then((response) => {
      return {
        success: true,
        messageId: response.messageId,
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
