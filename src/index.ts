import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { notifications } from "./Notifications";
import cron from "node-cron";
import dayjs from "dayjs";
dotenv.config();

const app = express();

app.use(cors());

app.use(bodyParser.json());

app.get("/api/notify-subscribers", async (req, res) => {
  await notifications.notifySubscribers();
  res.send("ok");
});

app.get("/api/due-notifications", async (req, res) => {
  await notifications.dueNotifications();
  res.send("ok");
});

app.get("/api/response-notifications", async (req, res) => {
  await notifications.responseNotifications();
  res.send("ok");
});

app.get("/api/cleanup-alerts", async (req, res) => {
  await Promise.all([
    notifications.supabase.cleanupAlerts(),
    notifications.supabase.cleanupNotifications(),
  ]);
  res.send("ok");
});

cron.schedule("*/5 * * * *", async () => {
  //TODO add logging
  let startTime = new Date();
  console.log("Running cron job");
  console.log("startTime", dayjs(startTime).format("HH:mm:ss"));
  await Promise.allSettled([
    notifications.supabase.cleanupAlerts(),
    notifications.supabase.cleanupNotifications(),
  ]);
  await Promise.allSettled([
    notifications.notifySubscribers(),
    notifications.responseNotifications(),
    notifications.dueNotifications(),
  ]);
  let endTime = new Date();
  console.log(
    `Cron job completed in ${endTime.getTime() - startTime.getTime()}ms ${dayjs(
      endTime
    ).format("HH:mm:ss")}`
  );
});

const PORT = process.env.LOCAL_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
