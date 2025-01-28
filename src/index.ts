import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { notifications } from "./Notifications";
import cron from "node-cron";
import dayjs from "dayjs";
import { translateText } from "./translate";
import { Language } from "./interface";
import { fixCIEventSegments, updateIAddressWithEnglishAddress } from "./util";
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

app.get("/api/admin-notifications", async (req, res) => {
  await notifications.notifyAdminsOfNewRequests();
  res.send("ok");
});

app.get("/api/cleanup-alerts", async (req, res) => {
  await Promise.all([
    notifications.supabase.cleanupAlerts(),
    notifications.supabase.cleanupNotifications(),
  ]);
  res.send("ok");
});

app.post("/api/translate-title-by-id", async (req, res) => {
  const { id } = req.body;
  const event = await notifications.supabase.getCIEventById(id);
  const [enTitle, ruTitle] = await Promise.all([
    translateText(event.title, Language.en),
    translateText(event.title, Language.ru),
  ]);

  const fixedEvent = fixCIEventSegments(event);

  const iAddress = await updateIAddressWithEnglishAddress(event.address);

  const newCIEvent = {
    ...fixedEvent,
    lng_titles: { en: enTitle, ru: ruTitle },
    address: iAddress,
  };
  await notifications.supabase.updateCIEvent(newCIEvent);
  res.send(newCIEvent);
});

app.get("/api/update-translations", async (req, res) => {
  return;
  const events = await notifications.supabase.getAllFutureEvents();
  for (const event of events) {
    const [enTitle, ruTitle] = await Promise.all([
      translateText(event.title, Language.en),
      translateText(event.title, Language.ru),
    ]);

    const fixedEvent = fixCIEventSegments(event);

    const iAddress = await updateIAddressWithEnglishAddress(event.address);

    const newCIEvent = {
      ...fixedEvent,
      lng_titles: { en: enTitle, ru: ruTitle },
      address: iAddress,
    };
    await notifications.supabase.updateCIEvent(newCIEvent);
  }
  res.send(events);
});

// cron.schedule("*/5 * * * *", async () => {
//   console.log("Running cron job");
//   if (!process.env.IS_ACTIVE_SERVER) return;

//   const isActive = await notifications.supabase.isNotificationEnabled();

//   if (!isActive) {
//     console.log("Server is not active, skipping cron job");
//     return;
//   }

//   //TODO add logging
//   let startTime = new Date();
//   console.log("Running cron job");
//   console.log("startTime", dayjs(startTime).format("HH:mm:ss"));
//   await Promise.allSettled([
//     notifications.supabase.cleanupAlerts(),
//     notifications.supabase.cleanupNotifications(),
//   ]);
//   await Promise.allSettled([
//     notifications.notifySubscribers(),
//     notifications.responseNotifications(),
//     notifications.dueNotifications(),
//     notifications.notifyAdminsOfNewRequests(),
//   ]);
//   let endTime = new Date();
//   console.log(
//     `Cron job completed in ${endTime.getTime() - startTime.getTime()}ms ${dayjs(
//       endTime
//     ).format("HH:mm:ss")}`
//   );
// });

const PORT = process.env.LOCAL_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
