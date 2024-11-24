import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { CIUser, EventSubscribersData } from "./interface";

dayjs.extend(utc);
dayjs.extend(timezone);

export function getEventListOfSubscribersData(
  users: CIUser[],
  teacherIds: string[],
  orgIds: string[]
): EventSubscribersData[] {
  const subscribedUsers = users.filter((user: CIUser) => {
    const isTeacherSubscribed = user.subscriptions["teachers"].some(
      (teacherId) => teacherIds.includes(teacherId)
    );
    const isOrgSubscribed = user.subscriptions["orgs"].some((orgId) =>
      orgIds.includes(orgId)
    );
    return isTeacherSubscribed || isOrgSubscribed;
  });

  const userTokensAndCounts = subscribedUsers.map((user) => ({
    tokens: user.push_notification_tokens.map((token) => token.token),
    unreadCount: user.alerts.length,
  }));

  return userTokensAndCounts;
}
