export interface CIUser {
  id: string;
  alerts: CIAlert[];
  receive_notifications: boolean;
  subscriptions: {
    teachers: string[];
    orgs: string[];
  };
  fcm_token: string;
}

export interface CIEvent {
  id: string;
  title: string;
  user_id: string;
  segments: CIEventSegments[];
  source_template_id: string | null;
  is_multi_day: boolean;
  multi_day_teachers: UserOption[] | null;
  organisations: UserOption[];
  start_date: string;
}
export interface UserOption {
  value: string;
  label: string;
}

export interface CIRequestWithUser extends CIRequest {
  user: CIUser;
}

export interface CIRequest {
  id: string;
  created_at: string;
  request_type: string;
  user_id: string;
  type: RequestType;
  status: RequestStatus;
  message: string;
  responses: CIRequestResponse[];
  phone: string;
  email: string;
  name: string;
  viewed_response: boolean;
  viewed_by: string[];
  number: number;
  sent: boolean;
  viewed: boolean;
}
export enum RequestType {
  make_profile = "make_profile",
  make_creator = "make_creator",
  make_org = "make_org",
  support = "support",
}
export enum RequestStatus {
  open = "open",
  closed = "closed",
}
export interface CIRequestResponse {
  response: string;
  created_at: string;
  responder_name: string;
}
export interface CIAlert {
  id: string;
  ci_event_id?: string;
  request_id?: string;
  viewed: boolean;
  type: NotificationType;
  title: string;
  start_date: string;
  firstSegment: CIEventSegments;
  address: IAddress;
}

export enum NotificationType {
  reminder = "reminder",
  subscription = "subscription",
  response = "response",
}
export interface CIEventSegments {
  endTime: string;
  type: string;
  startTime: string;
  teachers: UserOption[];
  tags: string[];
}
export interface IAddress {
  place_id: string;
  label: string;
}

export interface CINotification {
  id: string;
  created_at: string;
  ci_event_id: string;
  user_id: string;
  remind_in_hours: string;
  type: NotificationType;
  title: string;
  body: string;
  send_at: string;
  timezone: string;
  sent: boolean;
  is_multi_day: boolean;
}

export interface CINotificationWithUserAndEvent extends CINotification {
  ci_events: CIEvent;
  users: CIUser & { alerts: { viewed: boolean }[] };
}

export interface PushNotificationToken {
  token: string;
  created_at: string;
  device_id: string;
  is_pwa: boolean;
  branch: string;
}

export interface EventSubscribersData {
  token: string;
  unreadCount: number;
}

export interface FirebaseMessage {
  title: string;
  body: string;
  token: string;
  url: string;
  eventId: string;
  click_action: string;
  badge: string;
}

export interface CIServerNotification {
  title: string;
  body: string;
  token: string;
  eventId: string;
  requestId: string;
  userId: string;
  unreadCount: number;
  type: NotificationType;
}

export interface AddUserAlertData {
  userId: string;
  type: NotificationType;
  eventId?: string;
  requestId?: string;
}
