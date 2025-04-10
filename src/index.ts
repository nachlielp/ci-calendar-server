import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { notifications } from "./Notifications";
import cron from "node-cron";
import { WAUser, districtOptions, SelectOption } from "./interface";
import { twilio } from "./Twilio";
import { supabase } from "./Supabase";
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

app.get("/api/get-wa-users", async (req, res) => {
  const waUsers = await notifications.supabase.getWAUsers();
  res.send(waUsers);
});
app.get("/api/get-wa-ci-events", async (req, res) => {
  const waCiEvents = await notifications.supabase.getThisWeekCIEvents();

  let jreEventsCount = 0;
  let centerEventsCount = 0;
  let northEventsCount = 0;
  let southEventsCount = 0;
  waCiEvents.forEach((event: { district: string }) => {
    if (event.district === "jerusalem") jreEventsCount++;
    else if (event.district === "center") centerEventsCount++;
    else if (event.district === "south") southEventsCount++;
    else northEventsCount++;
  });
  res.send({
    jreEventsCount,
    centerEventsCount,
    northEventsCount,
    southEventsCount,
  });
});

app.get("/api/get-wa-ci-events-by-district", async (req, res) => {
  const waCiEvents = await notifications.supabase.getThisWeekCIEvents();

  let jreEventsCount = 0;
  let centerEventsCount = 0;
  let northEventsCount = 0;
  let southEventsCount = 0;
  waCiEvents.forEach((event: { district: string }) => {
    if (event.district === "jerusalem") jreEventsCount++;
    else if (event.district === "center") centerEventsCount++;
    else if (event.district === "south") southEventsCount++;
    else northEventsCount++;
  });

  const waUsers = await notifications.supabase.getWAUsers();
  console.log(waUsers);
  const formattedMessages: {
    phone: string;
    name: string;
    filters: string;
    eventsCount: number;
  }[] = waUsers.map((user: WAUser) => {
    const eventsCount = waCiEvents.filter((event: { district: string }) =>
      user.filter.includes(event.district)
    ).length;
    return {
      phone: user.phone,
      name: user.name,
      filters: user.filter
        .map((filter: string) => {
          const option = districtOptions.find(
            (option: SelectOption) => option.value === filter
          );
          return option?.label;
        })
        .join(", "),
      eventsCount,
    };
  });

  const results = await Promise.allSettled(
    formattedMessages.map((message) => {
      return twilio.sendTemplate(
        `whatsapp:+${message.phone}`,
        process.env.TWILIO_TEMPLATE_WEEKLY_SCHEDULE!,
        {
          "1": message.name,
          "2": message.filters,
          "3": message.eventsCount.toString(),
        }
      );
    })
  );

  const formattedLogResults = results.map((result, index) => {
    const user = waUsers.find(
      (user: WAUser) =>
        result.status === "fulfilled" && result.value.to.includes(user.phone)
    );
    return {
      wa_user_id: user?.id,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: user?.phone,
      result,
    };
  });

  await Promise.allSettled(
    formattedLogResults.map((logResult) => {
      return supabase.logTwilioResult(
        logResult.result,
        logResult.wa_user_id,
        logResult.from,
        logResult.to
      );
    })
  );
  res.send(formattedLogResults);
});

cron.schedule("0 10 * * 0", async () => {
  const waCiEvents = await notifications.supabase.getThisWeekCIEvents();

  let jreEventsCount = 0;
  let centerEventsCount = 0;
  let northEventsCount = 0;
  let southEventsCount = 0;
  waCiEvents.forEach((event: { district: string }) => {
    if (event.district === "jerusalem") jreEventsCount++;
    else if (event.district === "center") centerEventsCount++;
    else if (event.district === "south") southEventsCount++;
    else northEventsCount++;
  });

  const waUsers = await notifications.supabase.getWAUsers();
  console.log(waUsers);
  const formattedMessages: {
    phone: string;
    name: string;
    filters: string;
    eventsCount: number;
  }[] = waUsers.map((user: WAUser) => {
    const eventsCount = waCiEvents.filter((event: { district: string }) =>
      user.filter.includes(event.district)
    ).length;
    return {
      phone: user.phone,
      name: user.name,
      filters: user.filter
        .map((filter: string) => {
          const option = districtOptions.find(
            (option: SelectOption) => option.value === filter
          );
          return option?.label;
        })
        .join(", "),
      eventsCount,
    };
  });

  const results = await Promise.allSettled(
    formattedMessages.map((message) => {
      return twilio.sendTemplate(
        `whatsapp:+${message.phone}`,
        process.env.TWILIO_TEMPLATE_WEEKLY_SCHEDULE!,
        {
          "1": message.name,
          "2": message.filters,
          "3": message.eventsCount.toString(),
        }
      );
    })
  );

  const formattedLogResults = results.map((result, index) => {
    const user = waUsers.find(
      (user: WAUser) =>
        result.status === "fulfilled" && result.value.to.includes(user.phone)
    );
    return {
      wa_user_id: user?.id,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: user?.phone,
      result,
    };
  });

  await Promise.allSettled(
    formattedLogResults.map((logResult) => {
      return supabase.logTwilioResult(
        logResult.result,
        logResult.wa_user_id,
        logResult.from,
        logResult.to
      );
    })
  );
});
cron.schedule("0 10 * * 4", async () => {
  const waCiEvents = await notifications.supabase.getThisWeekCIEvents();

  let jreEventsCount = 0;
  let centerEventsCount = 0;
  let northEventsCount = 0;
  let southEventsCount = 0;

  waCiEvents.forEach((event: { district: string }) => {
    if (event.district === "jerusalem") jreEventsCount++;
    else if (event.district === "center") centerEventsCount++;
    else if (event.district === "south") southEventsCount++;
    else northEventsCount++;
  });

  const waUsers = await notifications.supabase.getWAUsers();
  console.log(waUsers);
  const formattedMessages: {
    phone: string;
    name: string;
    filters: string;
    eventsCount: number;
  }[] = waUsers.map((user: WAUser) => {
    const eventsCount = waCiEvents.filter((event: { district: string }) =>
      user.filter.includes(event.district)
    ).length;
    return {
      phone: user.phone,
      name: user.name,
      filters: user.filter
        .map((filter: string) => {
          const option = districtOptions.find(
            (option: SelectOption) => option.value === filter
          );
          return option?.label;
        })
        .join(", "),
      eventsCount,
    };
  });

  const results = await Promise.allSettled(
    formattedMessages.map((message) => {
      return twilio.sendTemplate(
        `whatsapp:+${message.phone}`,
        process.env.TWILIO_TEMPLATE_WEEKEND_SCHEDULE!,
        {
          "1": message.name,
          "2": message.filters,
          "3": message.eventsCount.toString(),
        }
      );
    })
  );

  const formattedLogResults = results.map((result, index) => {
    const user = waUsers.find(
      (user: WAUser) =>
        result.status === "fulfilled" && result.value.to.includes(user.phone)
    );
    return {
      wa_user_id: user?.id,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: user?.phone,
      result,
    };
  });

  await Promise.allSettled(
    formattedLogResults.map((logResult) => {
      return supabase.logTwilioResult(
        logResult.result,
        logResult.wa_user_id,
        logResult.from,
        logResult.to
      );
    })
  );
});

const PORT = process.env.LOCAL_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
