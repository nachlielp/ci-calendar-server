# CI Calendar Server

A Node.js server that handles notifications and scheduling for the CI Calendar application. The server manages event notifications, reminders, and request responses through Firebase Cloud Messaging (FCM) and Supabase.

## Features

- Scheduled notifications for new events
- Due date reminders for upcoming events
- Response notifications for user requests
- Automatic cleanup of old alerts and notifications
- Integration with Firebase Cloud Messaging for push notifications
- Supabase database integration for data persistence

## Tech Stack

- Node.js
- Express
- Firebase Cloud Messaging
- Supabase
- TypeScript
- node-cron

## Setup

1. Install dependencies
2. Create a `.env` file with the following variables:

- SUPABASE_URL
- SUPABASE_SERVICE_ACCOUNT_KEY
- ENV_NOTIFICATION_FLAG
- LOCAL_PORT

3. Set up Firebase credentials (requires service account configuration)

## API Test Endpoints

- `GET /api/notify-subscribers` - Notify subscribers about new events
- `GET /api/due-notifications` - Send due date reminders
- `GET /api/response-notifications` - Send response notifications
- `GET /api/cleanup-alerts` - Clean up old alerts and notifications

## Scheduled Tasks

The server runs automated tasks every 5 minutes to:

- Clean up old alerts and notifications
- Send notifications to subscribers
- Process due date reminders
- Handle response notifications
