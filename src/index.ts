import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { notifications } from "./Notifications";

dotenv.config();

const app = express();

app.use(cors());

app.use(bodyParser.json());

app.get("/api/notify-subscribers", async (req, res) => {
  await notifications.notifySubscribers();
  res.send("ok");
});

const PORT = process.env.LOCAL_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
